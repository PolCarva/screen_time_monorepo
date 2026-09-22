import { describe, expect, it } from "vitest";

import {
  emptySheetQueue,
  enqueueSheet,
  settleSheet,
  sheetKey,
  type SheetChoice,
} from "./sheet-queue";

type Options = { title: string };

function request(id: number, title: string, listener = (_: SheetChoice) => {}) {
  return { id, key: sheetKey(title), options: { title }, listener };
}

describe("sheet queue", () => {
  it("shows the first sheet and queues the rest in order", () => {
    let state = emptySheetQueue<Options>();
    state = enqueueSheet(state, request(1, "A"));
    state = enqueueSheet(state, request(2, "B"));
    state = enqueueSheet(state, request(3, "C"));

    expect(state.visible?.options.title).toBe("A");
    expect(state.waiting.map((sheet) => sheet.options.title)).toEqual([
      "B",
      "C",
    ]);
  });

  it("promotes the next sheet when the visible one settles", () => {
    let state = emptySheetQueue<Options>();
    state = enqueueSheet(state, request(1, "A"));
    state = enqueueSheet(state, request(2, "B"));

    const first = settleSheet(state);
    expect(first.settled?.options.title).toBe("A");
    expect(first.state.visible?.options.title).toBe("B");

    const second = settleSheet(first.state);
    expect(second.settled?.options.title).toBe("B");
    expect(second.state.visible).toBeNull();
    expect(settleSheet(second.state).settled).toBeNull();
  });

  it("shares the answer of an identical visible or waiting sheet", () => {
    const answers: string[] = [];
    let state = emptySheetQueue<Options>();
    state = enqueueSheet(state, request(1, "A", () => answers.push("a1")));
    state = enqueueSheet(state, request(2, "B", () => answers.push("b1")));
    state = enqueueSheet(state, request(3, "A", () => answers.push("a2")));
    state = enqueueSheet(state, request(4, "B", () => answers.push("b2")));

    expect(state.waiting).toHaveLength(1);
    const { settled } = settleSheet(state);
    for (const listener of settled?.listeners ?? []) listener(0);
    expect(answers).toEqual(["a1", "a2"]);
  });

  it("keys sheets by title and message", () => {
    expect(sheetKey("Title", "Body")).not.toBe(sheetKey("Title"));
    expect(sheetKey("Title")).toBe(sheetKey("Title", undefined));
  });
});
