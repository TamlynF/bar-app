/* The home page's Instagram strip. Until the Graph API token is in place
   (see instagram-publish.ts for what Meta needs), the feed is this fixed list
   of @donfenticas reels, with covers cropped from the profile; swapping in
   the live feed means returning the same shape from loadInstagramFeed. */

export type InstagramPost = {
  id: string;
  kind: "reel" | "image" | "carousel";
  imageUrl: string;
  caption: string;
  permalink: string;
  views: number | null;
};

export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/donfenticas/";

const REELS_URL = `${INSTAGRAM_PROFILE_URL}reels/`;

const PLACEHOLDER_FEED: InstagramPost[] = [
  {
    id: "halloween",
    kind: "reel",
    imageUrl: "/instagram/reel-halloween.jpg",
    caption: "Halloween at Don Fenticas - Sat 31 Oct, 7pm to 2am. Free entry, best dressed comp, karaoke, live music and a DJ.",
    permalink: REELS_URL,
    views: 4003,
  },
  {
    id: "quiz-thursdays",
    kind: "reel",
    imageUrl: "/instagram/reel-quiz-thursdays.jpg",
    caption: "Quiz Thursdays - doors 7pm, quiz 8pm. Teams of 4 to 6, a large Papa Johns pizza for £10 when you enter.",
    permalink: REELS_URL,
    views: 36900,
  },
  {
    id: "hawkstone",
    kind: "reel",
    imageUrl: "/instagram/reel-hawkstone.jpg",
    caption: "Hawkstone lager, fresh on the taps.",
    permalink: REELS_URL,
    views: 6668,
  },
  {
    id: "open-mic",
    kind: "reel",
    imageUrl: "/instagram/reel-open-mic.jpg",
    caption: "Open Mic & Jam Night with Casey and Leanne Barrs, every 2nd Wednesday. Doors 7pm, slots from 7:30pm, all abilities welcome.",
    permalink: REELS_URL,
    views: 16500,
  },
  {
    id: "karaoke",
    kind: "reel",
    imageUrl: "/instagram/reel-karaoke.jpg",
    caption: "Friday at Don Fenticas - World Famous Karaoke from 10pm, then the DF Disco till late.",
    permalink: REELS_URL,
    views: 12900,
  },
  {
    id: "in-this-picture",
    kind: "reel",
    imageUrl: "/instagram/reel-in-this-picture.jpg",
    caption: "In this picture...",
    permalink: REELS_URL,
    views: 22600,
  },
];

export async function loadInstagramFeed(): Promise<InstagramPost[]> {
  return PLACEHOLDER_FEED;
}

/* "36.9k views", the way Instagram abbreviates it. */
export function viewsLabel(views: number | null): string | null {
  if (views == null) return null;
  const n = views >= 1000 ? `${(views / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(views);
  return `${n} views`;
}
