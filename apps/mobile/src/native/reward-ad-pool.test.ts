import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIntentStash,
  REWARD_INTENT_STASH_CAPACITY,
  RewardAdPool,
  type RewardIntentSource,
  type StoredIntents,
} from "./reward-ad-pool";
import type { RewardIntent } from "./reward-provider";

vi.mock("./reward-provider", () => ({}));

const minute = 60_000;

function intent(id: string, expiresInMinutes = 24 * 60): RewardIntent {
  return {
    id,
    customData: "signed-custom-data-payload",
    userId: "anonymous",
    expiresAt: new Date(Date.now() + expiresInMinutes * minute).toISOString(),
  };
}

/** Loads that answer only when the test says so. */
function controlledLoads() {
  const pending: Array<{
    intent: RewardIntent;
    resolve: (ad: string | null) => void;
  }> = [];
  let count = 0;
  return {
    pending,
    load: vi.fn(
      (forIntent: RewardIntent) =>
        new Promise<string | null>((resolve) => {
          pending.push({ intent: forIntent, resolve });
        }),
    ),
    /** Answers the oldest load still waiting with an ad (or a failure). */
    async answer(ok = true) {
      const next = pending.shift();
      if (!next) throw new Error("no load waiting");
      next.resolve(ok ? `ad-${++count}` : null);
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

/** Hands out fresh intents in order and remembers what was withdrawn. */
function intentsSource(): RewardIntentSource & { withdrawn: string[] } {
  let next = 0;
  const withdrawn: string[] = [];
  const saved: RewardIntent[] = [];
  return {
    withdrawn,
    acquire: vi.fn(async (busy: ReadonlySet<string>) => {
      const free = saved.find((it) => !busy.has(it.id));
      if (free) return free;
      const created = intent(`intent-${++next}`);
      saved.push(created);
      return created;
    }),
    withdraw: vi.fn(async (id: string) => {
      withdrawn.push(id);
      const index = saved.findIndex((it) => it.id === id);
      if (index >= 0) saved.splice(index, 1);
    }),
    restore: vi.fn(async (restored: RewardIntent) => {
      saved.push(restored);
    }),
  };
}

function setup() {
  const loads = controlledLoads();
  const intents = intentsSource();
  const prepare = vi.fn(async () => "ready" as const);
  const pool = new RewardAdPool<string>({
    prepare,
    load: loads.load,
    intents,
  });
  const statuses: string[] = [];
  pool.subscribe((status) => statuses.push(status));
  return { pool, loads, intents, prepare, statuses };
}

describe("RewardAdPool", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fills two ads, one load at a time", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(pool.status).toBe("preparing");
    expect(loads.pending).toHaveLength(1);

    await loads.answer();
    expect(pool.status).toBe("ready");
    expect(loads.pending).toHaveLength(1);

    await loads.answer();
    expect(loads.pending).toHaveLength(0);
    expect(loads.load).toHaveBeenCalledTimes(2);
    // Each ad carries its own intent.
    expect(loads.load.mock.calls.map(([it]) => it.id)).toEqual([
      "intent-1",
      "intent-2",
    ]);
  });

  it("gives out the oldest ad, withdraws its intent and refills the slot", async () => {
    const { pool, loads, intents } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer();
    await vi.advanceTimersByTimeAsync(minute);
    await loads.answer();

    const taken = await pool.take();
    expect(taken).toMatchObject({ ad: "ad-1", intent: { id: "intent-1" } });
    expect(intents.withdrawn).toEqual(["intent-1"]);
    expect(pool.status).toBe("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(loads.pending).toHaveLength(1);
    // The refill does not reuse the withdrawn intent nor the pooled one.
    expect(loads.pending[0]!.intent.id).toBe("intent-3");
  });

  it("retries a failed load after 30 s, then 1 min, and holds triggers meanwhile", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer(false);
    expect(pool.status).toBe("unavailable");

    expect(pool.trigger()).toBe("unavailable");
    expect(loads.pending).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(loads.pending).toHaveLength(1);
    expect(pool.status).toBe("preparing");
    await loads.answer(false);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(loads.pending).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(loads.pending).toHaveLength(1);
    await loads.answer();
    expect(pool.status).toBe("ready");
  });

  it("counts the retry wait from the failure, not from the start of a slow load", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(90_000);
    await loads.answer(false);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(loads.pending).toHaveLength(0);
    expect(pool.trigger()).toBe("unavailable");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(loads.pending).toHaveLength(1);
  });

  it("lets a trigger through once the last attempt is 30 s old", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer(false);
    await vi.advanceTimersByTimeAsync(30_000);
    await loads.answer(false);
    // A minute of retry wait is left; 30 s after the attempt a trigger loads.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(pool.trigger()).toBe("preparing");
    await vi.advanceTimersByTimeAsync(0);
    expect(loads.pending).toHaveLength(1);
  });

  it("renews an ad from 50 min on and keeps it usable meanwhile", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer();
    await loads.answer();

    await vi.advanceTimersByTimeAsync(50 * minute - 1);
    expect(loads.pending).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(loads.pending).toHaveLength(1);
    expect(pool.status).toBe("ready");
    await loads.answer();

    // Both old ads were due; the second renewal follows the first.
    expect(loads.pending).toHaveLength(1);
    await loads.answer();
    const first = await pool.take();
    expect(first?.ad).toBe("ad-3");
  });

  it("drops expired ads on return and tops the pool up", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer();
    await loads.answer();

    pool.setActive(false);
    // Suspended: no renewal while away.
    await vi.advanceTimersByTimeAsync(56 * minute);
    expect(loads.pending).toHaveLength(0);

    pool.setActive(true);
    expect(pool.status).toBe("preparing");
    await vi.advanceTimersByTimeAsync(0);
    expect(loads.pending).toHaveLength(1);
    expect(await pool.take()).toBeNull();
  });

  it("does not count a load cut short by suspension as a failure", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    pool.setActive(false);
    await loads.answer(false);
    expect(pool.status).not.toBe("unavailable");

    pool.setActive(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(loads.pending).toHaveLength(1);
    expect(pool.status).toBe("preparing");
  });

  it("gives up a load stuck across a suspension but keeps its late ad", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    pool.setActive(false);
    await vi.advanceTimersByTimeAsync(31_000);
    pool.setActive(true);
    await vi.advanceTimersByTimeAsync(0);
    // The old load and a fresh one, each with its own intent.
    expect(loads.pending.map((load) => load.intent.id)).toEqual([
      "intent-1",
      "intent-2",
    ]);

    await loads.answer();
    expect(pool.status).toBe("ready");
    await loads.answer();
    expect((await pool.take())?.ad).toBe("ad-1");
  });

  it("drops everything when stopped and ignores loads that answer later", async () => {
    const { pool, loads } = setup();
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    await loads.answer();
    await vi.advanceTimersByTimeAsync(0);
    pool.stop();
    expect(pool.status).toBe("idle");

    await loads.answer();
    expect(pool.status).toBe("idle");
    expect(await pool.take()).toBeNull();
  });

  it("counts an unavailable AdMob as a failed attempt", async () => {
    const { pool, prepare, loads } = setup();
    prepare.mockResolvedValue("unavailable" as never);
    pool.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(loads.load).not.toHaveBeenCalled();
    expect(pool.status).toBe("unavailable");
  });
});

describe("createIntentStash", () => {
  function stash(initial: StoredIntents | null, deviceId = "device-1") {
    let stored = initial;
    let created = 0;
    const create = vi.fn(async () => intent(`new-${++created}`));
    const source = createIntentStash({
      deviceId,
      read: async () => stored,
      write: async (value) => {
        stored = value;
      },
      create,
    });
    return { source, create, stored: () => stored };
  }

  it("reuses a saved intent before asking the server", async () => {
    const saved = intent("saved");
    const { source, create } = stash({
      deviceId: "device-1",
      intents: [saved],
    });
    await expect(source.acquire(new Set())).resolves.toEqual(saved);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates one when every saved intent is busy, up to three", async () => {
    const { source, create, stored } = stash(null);
    const busy = new Set<string>();
    for (let index = 0; index < REWARD_INTENT_STASH_CAPACITY; index += 1) {
      const next = await source.acquire(busy);
      busy.add(next!.id);
    }
    expect(create).toHaveBeenCalledTimes(3);
    await expect(source.acquire(busy)).resolves.toBeNull();
    expect(stored()?.intents).toHaveLength(3);
  });

  it("ignores intents saved for another device and expired ones", async () => {
    const { source, create } = stash({
      deviceId: "device-0",
      intents: [intent("other-device")],
    });
    await expect(source.acquire(new Set())).resolves.toMatchObject({
      id: "new-1",
    });
    expect(create).toHaveBeenCalledOnce();

    const expiring = stash({
      deviceId: "device-1",
      intents: [intent("expiring", 0.5)],
    });
    await expect(expiring.source.acquire(new Set())).resolves.toMatchObject({
      id: "new-1",
    });
  });

  it("never hands out a withdrawn intent until it is restored", async () => {
    const saved = intent("saved");
    const { source, stored } = stash({
      deviceId: "device-1",
      intents: [saved],
    });
    await source.withdraw("saved");
    expect(stored()?.intents).toEqual([]);

    await source.restore(saved);
    expect(stored()?.intents).toEqual([saved]);
    // Restoring twice keeps one copy.
    await source.restore(saved);
    expect(stored()?.intents).toEqual([saved]);
  });
});
