import { createClient } from "@/lib/supabase/server";
import GalleryClient from "./gallery-client";

export default async function GalleryPage() {
  const supabase = await createClient();

  const { data: images, error } = await supabase
    .from("gallery_images")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) console.error("Error fetching gallery images:", error);

  return <GalleryClient initialImages={images || []} />;
}
