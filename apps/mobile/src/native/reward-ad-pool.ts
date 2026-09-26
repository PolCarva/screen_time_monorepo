import {
  AD_POOL_SIZE,
  addAndTrim,
  nextRefreshAt,
  pruneExpired,
  retryDelayMs,
  slotsToFill,
  takeOldest,
  triggerMayBypassBackoff,
  type PooledAd,
} from "../lib/ad-pool";
import { pruneExpiredIntents } from "../lib/reward-intent-buffer";
import type { RewardIntent } from "./reward-provider";

export type RewardAdPoolStatus = "idle" | "preparing" | "ready" | "unavailable";

/**
 * Where the pool gets the intent each ad is loaded with. On iOS the SDK takes
 * the server-side verification at load time, so every pooled ad needs its own
 * intent before it loads (docs/ad-preload-plan.md, §1 and P6).
 */
export type RewardIntentSource = {
  /** A saved intent whose id is not in `busy`, else a new one; null if none. */
  acquire(busy: ReadonlySet<string>): Promise<RewardIntent | null>;
  /** Its ad is about to be shown: never hand it out again unless restored. */
  withdraw(id: string): Promise<void>;
  /** Its ad was not earned, so it can pay for another. */
  restore(intent: RewardIntent): Promise<void>;
};

export type RewardAdPoolDeps<Ad> = {
  prepare(): Promise<"ready" | "unavailable">;
  load(intent: RewardIntent): Promise<Ad | null>;
  intents: RewardIntentSource;
  now?: () => number;
};

/**
 * A load in flight since before the app was suspended, older than this, is
 * given up and started again on return (P8). Its result, if it ever comes, is
 * still kept when it is an ad.
 */
export const SUSPENDED_LOAD_ABANDON_MS = 30_000;

type Pooled<Ad> = { intent: RewardIntent; ad: Ad };
type Load = { startedAt: number; backgrounded: boolean };

/**
 * Keeps two rewarded ads loaded while the app runs (P1–P4, P8). Loads run one
 * at a time and only in the foreground; a failed one is retried on a growing
 * delay; returning to the foreground drops expired ads and tops the pool up.
 * Suspension is never counted as a failure.
 */
export class RewardAdPool<Ad> {
  private readonly now: () => number;
  private pool: PooledAd<Pooled<Ad>>[] = [];
  private loading: Load | null = null;
  /** Intents of loads still in flight, abandoned ones included. */
  private readonly busy = new Set<string>();
  private failures = 0;
  private lastAttemptAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private active = true;
  /** Bumped by `stop`, so loads started before it are ignored. */
  private generation = 0;
  private lastStatus: RewardAdPoolStatus = "idle";
  private readonly listeners = new Set<(status: RewardAdPoolStatus) => void>();

  constructor(private readonly deps: RewardAdPoolDeps<Ad>) {
    this.now = deps.now ?? Date.now;
  }

  get status(): RewardAdPoolStatus {
    return this.lastStatus;
  }

  subscribe(listener: (status: RewardAdPoolStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Ads became eligible: fill the pool. */
  start() {
    if (this.running) return;
    this.running = true;
    this.update();
    void this.fill();
  }

  /** Ads stopped being eligible (or consent was withdrawn): drop everything. */
  stop() {
    this.running = false;
    this.generation += 1;
    this.clearTimer();
    this.pool = [];
    this.loading = null;
    this.busy.clear();
    this.failures = 0;
    this.lastAttemptAt = null;
    this.update();
  }

  /** The app came to the foreground or left it (P8). */
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    if (!active) {
      this.clearTimer();
      if (this.loading) this.loading.backgrounded = true;
      return;
    }
    const now = this.now();
    if (
      this.loading?.backgrounded &&
      now - this.loading.startedAt > SUSPENDED_LOAD_ABANDON_MS
    )
      this.loading = null;
    this.pool = pruneExpired(this.pool, now);
    this.update();
    this.trigger();
  }

  /**
   * Something wants an ad soon (the pause opened, the app came back): top the
   * pool up, unless a retry is waiting and the last attempt is under 30 s old.
   * Returns the status right after, so a caller knows whether a load started.
   */
  trigger(): RewardAdPoolStatus {
    if (!this.running || !this.active) return this.status;
    if (
      this.failures > 0 &&
      !triggerMayBypassBackoff(this.lastAttemptAt, this.now())
    ) {
      this.schedule();
      return this.status;
    }
    void this.fill();
    return this.status;
  }

  /**
   * The oldest valid ad, taken out of the pool, and its intent withdrawn so a
   * crash mid-ad never reuses it. Its slot starts refilling at once.
   */
  async take(): Promise<Pooled<Ad> | null> {
    const { taken, rest } = takeOldest(this.pool, this.now());
    this.pool = rest;
    this.update();
    if (taken) await this.deps.intents.withdraw(taken.item.intent.id);
    void this.fill();
    return taken?.item ?? null;
  }

  /** Give an intent back after its ad was dismissed or failed to show. */
  async giveBack(intent: RewardIntent) {
    await this.deps.intents.restore(intent);
  }

  private async fill() {
    if (!this.running || !this.active || this.loading) return;
    const now = this.now();
    this.pool = pruneExpired(this.pool, now);
    if (slotsToFill(this.pool, now) === 0) {
      this.update();
      this.schedule();
      return;
    }
    this.clearTimer();
    const load: Load = { startedAt: now, backgrounded: false };
    const generation = this.generation;
    this.loading = load;
    this.lastAttemptAt = now;
    this.update();

    let loaded: Pooled<Ad> | null = null;
    let intentId: string | null = null;
    try {
      if ((await this.deps.prepare()) === "ready") {
        const intent = await this.deps.intents.acquire(this.inUse());
        if (intent && generation === this.generation) {
          intentId = intent.id;
          this.busy.add(intent.id);
          const ad = await this.deps.load(intent);
          if (ad) loaded = { intent, ad };
        }
      }
    } catch {
      loaded = null;
    } finally {
      if (intentId) this.busy.delete(intentId);
    }
    if (generation !== this.generation) return;

    const current = this.loading === load;
    if (current) this.loading = null;
    if (loaded) {
      this.failures = 0;
      this.pool = addAndTrim(this.pool, {
        item: loaded,
        loadedAt: this.now(),
      }).pool;
      this.update();
      void this.fill();
      return;
    }
    // An abandoned load failing changes nothing: its replacement is running.
    if (!current) return;
    if (load.backgrounded) {
      // Suspended mid-load: not a failure, just try again once back (P8).
      this.update();
      if (this.active) void this.fill();
      return;
    }
    this.failures += 1;
    this.update();
    this.schedule();
  }

  /** Intents held by pooled ads and by loads in flight. */
  private inUse(): Set<string> {
    return new Set([
      ...this.busy,
      ...this.pool.map((pooled) => pooled.item.intent.id),
    ]);
  }

  /** Posts the next retry, or the next renewal; only in the foreground. */
  private schedule() {
    this.clearTimer();
    if (!this.running || !this.active || this.loading) return;
    const now = this.now();
    const at =
      this.failures > 0
        ? (this.lastAttemptAt ?? now) + retryDelayMs(this.failures)
        : nextRefreshAt(this.pool);
    if (at === null) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        void this.fill();
      },
      Math.max(0, at - now),
    );
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private update() {
    const status = this.computeStatus();
    if (status === this.lastStatus) return;
    this.lastStatus = status;
    this.listeners.forEach((listener) => listener(status));
  }

  private computeStatus(): RewardAdPoolStatus {
    if (!this.running) return "idle";
    if (pruneExpired(this.pool, this.now()).length > 0) return "ready";
    if (this.loading) return "preparing";
    return this.failures > 0 ? "unavailable" : "preparing";
  }
}

/** Pool size, re-exported for the intent stash cap: one intent per slot. */
export const REWARD_AD_POOL_SIZE = AD_POOL_SIZE;

/**
 * Intents the iOS pool keeps on the phone, so a cold start loads without
 * waiting for the server (P6). They stay valid for a day and are reused until
 * their ad is earned. At most three wait at once: one per pooled ad plus the
 * one a renewal loads, well under the server's five pending per user.
 */
export const REWARD_INTENT_STASH_CAPACITY = AD_POOL_SIZE + 1;

export type StoredIntents = { deviceId: string; intents: RewardIntent[] };

export function createIntentStash(input: {
  deviceId: string;
  read(): Promise<StoredIntents | null>;
  write(value: StoredIntents): Promise<void>;
  create(): Promise<RewardIntent>;
  now?: () => number;
}): RewardIntentSource {
  const now = input.now ?? Date.now;
  let queue: Promise<unknown> = Promise.resolve();
  // One change at a time, so two quick calls never overwrite each other.
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const current = async () => {
    const stored = await input.read().catch(() => null);
    if (!stored || stored.deviceId !== input.deviceId) return [];
    return pruneExpiredIntents(stored.intents, now());
  };
  const save = (intents: RewardIntent[]) =>
    input.write({ deviceId: input.deviceId, intents });

  return {
    acquire: (busy) =>
      serial(async () => {
        const intents = await current();
        const free = intents.find((intent) => !busy.has(intent.id));
        if (free) {
          await save(intents);
          return free;
        }
        if (intents.length >= REWARD_INTENT_STASH_CAPACITY) return null;
        const created = await input.create();
        await save([...intents, created]);
        return created;
      }),
    withdraw: (id) =>
      serial(async () => {
        const intents = await current();
        await save(intents.filter((intent) => intent.id !== id));
      }),
    restore: (intent) =>
      serial(async () => {
        const intents = await current();
        const valid = pruneExpiredIntents([intent], now());
        if (
          valid.length === 0 ||
          intents.some((saved) => saved.id === intent.id) ||
          intents.length >= REWARD_INTENT_STASH_CAPACITY
        )
          return;
        await save([...intents, intent]);
      }),
  };
}
