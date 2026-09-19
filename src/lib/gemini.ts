/* Provider-neutral clean-up of a model's JSON answer. Calls themselves go
   through src/lib/ai/client.ts, which picks the provider and model set on
   Settings > AI settings for the area doing the asking. */

export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "```").trim();

  const fenceMatch = cleaned.match(/```\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  /* Whichever bracket opens first is the outer value. Trying the array slice
     first regardless would hand back the inner array of an object like
     {"categories": [...]}, which parses cleanly and is the wrong thing. */
  const firstArr = cleaned.indexOf("[");
  const lastArr = cleaned.lastIndexOf("]");
  const firstObj = cleaned.indexOf("{");
  const lastObj = cleaned.lastIndexOf("}");
  const arrSlice = firstArr !== -1 && lastArr > firstArr ? cleaned.slice(firstArr, lastArr + 1) : null;
  const objSlice = firstObj !== -1 && lastObj > firstObj ? cleaned.slice(firstObj, lastObj + 1) : null;
  const objectOpensFirst = firstObj !== -1 && (firstArr === -1 || firstObj < firstArr);
  for (const slice of objectOpensFirst ? [objSlice, arrSlice] : [arrSlice, objSlice]) {
    if (slice) candidates.push(slice);
  }

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
    }
  }
  return null;
}
