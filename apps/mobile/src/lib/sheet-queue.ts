/**
 * The order in which Still's sheets appear and settle, kept free of React
 * Native so it can be tested. One sheet is visible at a time. A request that
 * matches one already visible or waiting shares that sheet's answer instead of
 * stacking a duplicate the user would have to dismiss twice.
 */

/** Index of the action the user chose, or null when the sheet was dismissed. */
export type SheetChoice = number | null;

export type QueuedSheet<Options> = {
  id: number;
  key: string;
  options: Options;
  listeners: ReadonlyArray<(choice: SheetChoice) => void>;
};

export type SheetQueueState<Options> = {
  visible: QueuedSheet<Options> | null;
  waiting: ReadonlyArray<QueuedSheet<Options>>;
};

export function emptySheetQueue<Options>(): SheetQueueState<Options> {
  return { visible: null, waiting: [] };
}

/** Two requests with the same title and message are the same sheet. */
export function sheetKey(title: string, message?: string): string {
  return `${title}\u0000${message ?? ""}`;
}

export function enqueueSheet<Options>(
  state: SheetQueueState<Options>,
  request: {
    id: number;
    key: string;
    options: Options;
    listener: (choice: SheetChoice) => void;
  },
): SheetQueueState<Options> {
  const join = (sheet: QueuedSheet<Options>): QueuedSheet<Options> => ({
    ...sheet,
    listeners: [...sheet.listeners, request.listener],
  });
  if (state.visible?.key === request.key) {
    return { ...state, visible: join(state.visible) };
  }
  if (state.waiting.some((sheet) => sheet.key === request.key)) {
    return {
      ...state,
      waiting: state.waiting.map((sheet) =>
        sheet.key === request.key ? join(sheet) : sheet,
      ),
    };
  }
  const sheet: QueuedSheet<Options> = {
    id: request.id,
    key: request.key,
    options: request.options,
    listeners: [request.listener],
  };
  return state.visible
    ? { ...state, waiting: [...state.waiting, sheet] }
    : { ...state, visible: sheet };
}

/**
 * Closes the visible sheet and promotes the next one. The caller notifies the
 * settled sheet's listeners and runs the chosen action only after the sheet
 * has left the screen, so an action that presents native UI (Google sign-in,
 * the app picker, a URL) never collides with the closing modal.
 */
export function settleSheet<Options>(state: SheetQueueState<Options>): {
  state: SheetQueueState<Options>;
  settled: QueuedSheet<Options> | null;
} {
  const [next = null, ...rest] = state.waiting;
  return {
    state: { visible: next, waiting: rest },
    settled: state.visible,
  };
}
