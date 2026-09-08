import { describe, it, expect } from "vitest";
import { classifyUserAgent, isIpadDevice } from "@/lib/pwa-install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0";
const IPHONE_FACEBOOK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0;]";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const DESKTOP_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("classifyUserAgent", () => {
  it("treats real iPhone Safari as installable via Add to Home Screen", () => {
    expect(classifyUserAgent({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe("ios-safari");
  });

  it("sends in-app webviews to Safari first", () => {
    expect(classifyUserAgent({ userAgent: IPHONE_INSTAGRAM, maxTouchPoints: 5 })).toBe("ios-other");
    expect(classifyUserAgent({ userAgent: IPHONE_FACEBOOK, maxTouchPoints: 5 })).toBe("ios-other");
  });

  it("sends third-party iOS browsers to Safari first", () => {
    expect(classifyUserAgent({ userAgent: IPHONE_CHROME, maxTouchPoints: 5 })).toBe("ios-other");
  });

  it("catches an iPad that reports itself as a Mac", () => {
    expect(classifyUserAgent({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe("ios-safari");
  });

  it("leaves a real Mac and Android alone", () => {
    expect(classifyUserAgent({ userAgent: DESKTOP_MAC, maxTouchPoints: 0 })).toBe("other");
    expect(classifyUserAgent({ userAgent: ANDROID_CHROME, maxTouchPoints: 5 })).toBe("other");
  });
});

describe("isIpadDevice", () => {
  it("does not mistake an iPhone for an iPad because its UA mentions Mac OS X", () => {
    expect(isIpadDevice({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })).toBe(false);
  });

  it("catches an iPad reporting as a Mac", () => {
    expect(isIpadDevice({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
    expect(isIpadDevice({ userAgent: DESKTOP_MAC, maxTouchPoints: 0 })).toBe(false);
  });
});
