import { describe, it, expect } from "vitest";
import {
  moveQuestion,
  renumber,
  orderChanged,
  dropIndex,
} from "@/lib/quiz/question-order";

const round = (...ids: string[]) => ids.map((id, i) => ({ id, question_no: i + 1 }));

describe("moveQuestion", () => {
  it("moves a question down and renumbers everything it passed", () => {
    expect(moveQuestion(round("a", "b", "c", "d"), 0, 2)).toEqual([
      { id: "b", question_no: 1 },
      { id: "c", question_no: 2 },
      { id: "a", question_no: 3 },
      { id: "d", question_no: 4 },
    ]);
  });

  it("moves a question up", () => {
    expect(moveQuestion(round("a", "b", "c"), 2, 0)).toEqual([
      { id: "c", question_no: 1 },
      { id: "a", question_no: 2 },
      { id: "b", question_no: 3 },
    ]);
  });

  it("returns the same list when the question does not move", () => {
    const questions = round("a", "b", "c");
    expect(moveQuestion(questions, 1, 1)).toBe(questions);
  });

  it("clamps a drop past the end onto the last place", () => {
    expect(moveQuestion(round("a", "b", "c"), 0, 99).map((q) => q.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("clamps a drop above the top onto the first place", () => {
    expect(moveQuestion(round("a", "b", "c"), 2, -5).map((q) => q.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("ignores a source index that is not in the list", () => {
    const questions = round("a", "b");
    expect(moveQuestion(questions, 7, 0)).toBe(questions);
  });

  it("keeps the rest of each question untouched", () => {
    const questions = [
      { id: "a", question_no: 1, answer_text: "Bolivia" },
      { id: "b", question_no: 2, answer_text: "The Romans" },
    ];
    expect(moveQuestion(questions, 1, 0)).toEqual([
      { id: "b", question_no: 1, answer_text: "The Romans" },
      { id: "a", question_no: 2, answer_text: "Bolivia" },
    ]);
  });
});

describe("renumber", () => {
  it("closes gaps left by a delete", () => {
    const questions = [
      { id: "a", question_no: 2 },
      { id: "b", question_no: 5 },
      { id: "c", question_no: 9 },
    ];
    expect(renumber(questions).map((q) => q.question_no)).toEqual([1, 2, 3]);
  });

  it("numbers questions that never had a number", () => {
    expect(renumber([{ id: "a" }, { id: "b" }])).toEqual([
      { id: "a", question_no: 1 },
      { id: "b", question_no: 2 },
    ]);
  });

  it("leaves an already-correct row as the same object", () => {
    const questions = round("a", "b");
    const result = renumber(questions);
    expect(result[0]).toBe(questions[0]);
  });
});

describe("orderChanged", () => {
  it("is false when nothing moved", () => {
    expect(orderChanged(round("a", "b", "c"), round("a", "b", "c"))).toBe(false);
  });

  it("is true when two questions swapped", () => {
    expect(orderChanged(round("a", "b", "c"), round("b", "a", "c"))).toBe(true);
  });

  it("is true when the lists are different lengths", () => {
    expect(orderChanged(round("a", "b"), round("a", "b", "c"))).toBe(true);
  });
});

describe("dropIndex", () => {
  const midpoints = [50, 150, 250];

  it("drops above the first card", () => {
    expect(dropIndex(midpoints, 10)).toBe(0);
  });

  it("drops into the middle once past a card's midpoint", () => {
    expect(dropIndex(midpoints, 60)).toBe(1);
    expect(dropIndex(midpoints, 160)).toBe(2);
  });

  it("drops below the last card", () => {
    expect(dropIndex(midpoints, 900)).toBe(3);
  });

  it("treats a pointer exactly on a midpoint as still above it", () => {
    expect(dropIndex(midpoints, 50)).toBe(0);
  });

  it("drops at the top when there is nothing to compare against", () => {
    expect(dropIndex([], 400)).toBe(0);
  });
});
