export type InstallPlatform = "ssr" | "installed" | "ios-safari" | "ios-other" | "other"

export type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export const IOS_IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|GSA\/|Gmail|Twitter|LinkedInApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly/i
export const IOS_THIRD_PARTY_BROWSER = /CriOS|FxiOS|EdgiOS|OPT\/|DuckDuckGo|Brave/

type NavigatorLike = { userAgent: string; maxTouchPoints: number; standalone?: boolean }

export function isIosDevice(nav: NavigatorLike): boolean {
    // iPadOS reports as Mac; the touch-points check catches it.
    return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.userAgent.includes("Mac") && nav.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
    if (typeof window === "undefined") return false
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        // Older iOS exposes this non-standard flag instead.
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
}

export function isIpadDevice(nav: NavigatorLike): boolean {
    const ua = nav.userAgent
    if (/iPad/.test(ua)) return true
    // iPhone UAs also say "like Mac OS X", so only a Mac without an iPhone/iPod token is an iPad in disguise.
    return !/iPhone|iPod/.test(ua) && ua.includes("Mac") && nav.maxTouchPoints > 1
}

export function isIpad(): boolean {
    if (typeof navigator === "undefined") return false
    return isIpadDevice(navigator)
}

export function classifyUserAgent(nav: NavigatorLike): Exclude<InstallPlatform, "ssr" | "installed"> {
    if (!isIosDevice(nav)) return "other"
    const ua = nav.userAgent
    // Real Safari carries "Safari" but none of the other browsers' markers.
    // In-app webviews usually drop the "Safari" token altogether.
    const inAppWebview = IOS_IN_APP_BROWSER.test(ua) || !/Safari/.test(ua)
    const thirdPartyBrowser = IOS_THIRD_PARTY_BROWSER.test(ua)
    return inAppWebview || thirdPartyBrowser ? "ios-other" : "ios-safari"
}

export function detectInstallPlatform(): InstallPlatform {
    if (typeof window === "undefined") return "ssr"
    if (isStandalone()) return "installed"
    return classifyUserAgent(navigator)
}
