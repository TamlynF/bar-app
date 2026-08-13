import { createClient } from "@/lib/supabase/client";
import type { PictureRoundItem } from "@/app/(private)/event-setups/quiz-generator/actions";

/* Generated pictures arrive as data URIs. A full round of them is well past the
   request body limit, so they go to storage straight from the browser and the
   save action receives URLs. */
export async function uploadPictureDrafts(
  items: PictureRoundItem[],
  eventId: number
): Promise<PictureRoundItem[]> {
  const supabase = createClient();

  return Promise.all(
    items.map(async (item) => {
      if (!item.imageUrl?.startsWith("data:")) return item;

      const blob = await (await fetch(item.imageUrl)).blob();
      const contentType = blob.type || "image/png";
      const ext = contentType === "image/jpeg" ? "jpg" : "png";
      const path = `quiz-pictures/${eventId}/${crypto.randomUUID()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("gallery")
        .upload(path, blob, { contentType });

      if (error || !data) {
        throw new Error(`Could not upload the picture for "${item.answer}".`);
      }

      const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(data.path);
      return { ...item, imageUrl: publicUrl };
    })
  );
}
