import type { SyntheticEvent } from "react";

/* Local previews use a blob: URL, and Safari won't load a blob: URL with a
   #t= media fragment on it (iPhones show the "can't play" icon). Seeking a
   frame in once the metadata is in gives the same poster frame instead. */
export function showFirstFrame(e: SyntheticEvent<HTMLVideoElement>) {
  if (e.currentTarget.currentTime === 0) e.currentTarget.currentTime = 0.1;
}
