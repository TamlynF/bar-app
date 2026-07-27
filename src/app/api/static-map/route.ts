import { NextResponse } from "next/server";
import { getCompanyInfo } from "@/lib/company-info";

const CACHE_SECONDS = 60 * 60 * 24;

export async function GET() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const info = await getCompanyInfo();
  const address = info?.address?.trim();

  if (!key || !address) {
    return new NextResponse(null, { status: 404 });
  }

  const params = new URLSearchParams({
    center: address,
    zoom: "17",
    size: "640x360",
    scale: "2",
    maptype: "roadmap",
    key,
  });
  params.append("markers", `color:0xFDCC4B|${address}`);
  params.append("style", "feature:poi|visibility:off");
  params.append("style", "feature:transit|visibility:off");

  const upstream = await fetch(
    `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`,
    { next: { revalidate: CACHE_SECONDS } }
  );

  if (!upstream.ok) {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
    },
  });
}
