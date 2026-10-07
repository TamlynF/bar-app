import { describe, expect, it } from "vitest";
import { withRetry } from "../retry";

const noSleep = async () => {};

describe("withRetry", () => {
  it("returns on the first success without waiting", async () => {
    const out = await withRetry(async () => "ok", { sleep: noSleep });
    expect(out).toEqual({ value: "ok", attempts: 1 });
  });

  it("retries failures and reports how many goes it took", async () => {
    let calls = 0;
    const waited: number[] = [];
    const out = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error(`boom ${calls}`);
        return calls;
      },
      { attempts: 3, delaysMs: [10, 20], sleep: async (ms) => void waited.push(ms) }
    );
    expect(out).toEqual({ value: 3, attempts: 3 });
    expect(waited).toEqual([10, 20]);
  });

  it("rethrows the last error once attempts run out", async () => {
    await expect(
      withRetry(async (attempt) => {
        throw new Error(`fail ${attempt}`);
      }, { attempts: 2, sleep: noSleep })
    ).rejects.toThrow("fail 2");
  });

  it("stops early when the error is not worth retrying", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("auth");
        },
        { attempts: 3, sleep: noSleep, shouldRetry: () => false }
      )
    ).rejects.toThrow("auth");
    expect(calls).toBe(1);
  });
});
