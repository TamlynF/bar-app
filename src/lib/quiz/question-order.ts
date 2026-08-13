/* Reordering a round is "take one question out, put it back somewhere else" -
   every other question closes the gap and the whole round is numbered 1..N again,
   so the numbers on screen always match the order the host will read them in. */

export type OrderableQuestion = {
  id: string;
  question_no?: number | null;
};

export function moveQuestion<T extends OrderableQuestion>(
  questions: T[],
  from: number,
  to: number
): T[] {
  if (from === to) return questions;
  if (from < 0 || from >= questions.length) return questions;

  const target = Math.max(0, Math.min(to, questions.length - 1));
  if (from === target) return questions;

  const next = [...questions];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return renumber(next);
}

export function renumber<T extends OrderableQuestion>(questions: T[]): T[] {
  return questions.map((q, i) => (q.question_no === i + 1 ? q : { ...q, question_no: i + 1 }));
}

export function orderChanged(before: OrderableQuestion[], after: OrderableQuestion[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((q, i) => q.id !== after[i].id);
}

/* Where a dragged card should land, given the vertical midpoints of the cards it
   is being dragged over. Comparing against midpoints is what makes a card swap
   once you are halfway across its neighbour rather than only at its edge. */
export function dropIndex(midpoints: number[], pointerY: number): number {
  let index = 0;
  while (index < midpoints.length && pointerY > midpoints[index]) index++;
  return index;
}
