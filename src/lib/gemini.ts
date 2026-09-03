/* Provider-neutral clean-up of a model's JSON answer. Calls themselves go
   through src/lib/ai/client.ts, which picks the provider and model set on
   Settings > AI settings for the area doing the asking. */

export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```json/gi, "```").trim();

  const fenceMatch = cleaned.match(/```\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenceMatch) candidates.push(fenceMatch[1].trim());

  const firstArr = cleaned.indexOf("[");
  const lastArr = cleaned.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(cleaned.slice(firstArr, lastArr + 1));
  const firstObj = cleaned.indexOf("{");
  const lastObj = cleaned.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(cleaned.slice(firstObj, lastObj + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
    }
  }
  return null;
}
