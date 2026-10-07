export type RetryOptions = {
  attempts?: number;
  delaysMs?: number[];
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
};

export type RetryOutcome<T> = { value: T; attempts: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* Runs `fn` up to `attempts` times, waiting the matching delay between goes
   (the last delay repeats when there are more attempts than delays). The
   final error is rethrown unchanged so callers see the real cause. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<RetryOutcome<T>> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delays = options.delaysMs ?? [1000, 3000];
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return { value: await fn(attempt), attempts: attempt };
    } catch (error) {
      lastError = error;
      const retry = attempt < attempts && (options.shouldRetry?.(error, attempt) ?? true);
      if (!retry) throw error;
      options.onRetry?.(error, attempt);
      const delay = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
      if (delay > 0) await sleep(delay);
    }
  }
  throw lastError;
}
