/* The React Compiler cannot compile a component whose own body holds a
   try/catch around conditional or optional-chained code, or any try/finally.
   Handlers hand their work to this instead, and run what used to sit in
   `finally` on the line after awaiting it - onError catches everything, so that
   line always runs. */
export async function attempt(
  work: () => Promise<void>,
  onError: (err: unknown) => void
): Promise<void> {
  try {
    await work();
  } catch (err) {
    onError(err);
  }
}
