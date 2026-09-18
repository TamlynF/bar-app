import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureSource, MarketingCompetitor } from "./types";
import {
  captureSourceForUrl,
  mergeParsedMenus,
  rivalMenuUrls,
  rivalStartUrls,
  rowsFromParsedMenu,
} from "./rivals";
import type { ParsedMenu } from "@/lib/menu-import";
import {
  discoverDrinkMenus,
  extractMenuFromFile,
  extractMenuFromText,
  fetchFailureMessage,
} from "./capture-menu";
import { uniqueUrls } from "./discover-drinks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function replaceRivalPrices(
  supabase: AnyClient,
  rival: MarketingCompetitor,
  menu: ParsedMenu,
  meta: { sourceUrl: string | null; sourceName: string; source: CaptureSource; menuUrls?: string[] },
): Promise<{ count: number } | { error: string }> {
  const rows = rowsFromParsedMenu(
    menu,
    {
      competitorId: rival.id,
      venueName: rival.name,
      area: rival.area ?? "",
      sourceUrl: meta.sourceUrl,
      sourceName: meta.sourceName,
    },
    true,
  );
  if (!rows.length) {
    return { error: "No drink prices on that page. Open the site, paste a drinks menu URL, or upload a board photo." };
  }

  const { error: delError } = await supabase.from("competitor_prices").delete().eq("competitor_id", rival.id);
  if (delError) return { error: delError.message };

  const { error: insError } = await supabase.from("competitor_prices").insert(rows);
  if (insError) return { error: insError.message };

  const menuUrls = meta.menuUrls ?? rivalMenuUrls(rival);
  const { error: updError } = await supabase
    .from("marketing_competitors")
    .update({
      last_captured_at: new Date().toISOString(),
      last_capture_source: meta.source,
      menu_urls: menuUrls,
      menu_url: menuUrls[0] ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rival.id);
  if (updError) return { error: updError.message };

  return { count: rows.length };
}

export async function captureRivalFromUrl(
  supabase: AnyClient,
  rival: MarketingCompetitor,
): Promise<{ count: number; menuUrls: string[] } | { error: string }> {
  const starts = rivalStartUrls(rival);
  if (!starts.length) return { error: "Add a website or drinks menu URL first." };

  try {
    const found = await discoverDrinkMenus(starts, rival.name);
    const menus: ParsedMenu[] = [];
    for (const file of found.files) {
      const extracted = await extractMenuFromFile({
        bytes: file.bytes,
        mimeType: file.mimeType,
        drinksOnly: true,
      });
      if (!("error" in extracted)) menus.push(extracted.menu);
    }
    const drinkPages = found.pages.filter((p) => /menu|drink|tenkites|hansom-cab/i.test(p.url));
    for (const page of drinkPages.length ? drinkPages : found.pages) {
      const extracted = await extractMenuFromText(page.text, true);
      if (!("error" in extracted)) menus.push(extracted.menu);
    }

    const merged = mergeParsedMenus(menus);
    const discovered = uniqueUrls([
      ...found.files.map((file) => file.url),
      ...found.pageUrls.filter((url) => /menu|drink|\.pdf|tenkites/i.test(url)),
    ]);
    const menuUrls = uniqueUrls(
      discovered.length ? discovered : [...rivalMenuUrls(rival), ...found.pageUrls],
    );

    if (menuUrls.length) {
      await supabase
        .from("marketing_competitors")
        .update({
          menu_urls: menuUrls,
          menu_url: menuUrls[0] ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rival.id);
    }

    const sourceUrl = found.files[0]?.url ?? found.pages[0]?.url ?? starts[0];
    const source = captureSourceForUrl(sourceUrl, menuUrls, rival.website);
    const saved = await replaceRivalPrices(supabase, rival, merged, {
      sourceUrl,
      sourceName: rival.name,
      source,
      menuUrls,
    });
    if ("error" in saved) return saved;
    return { count: saved.count, menuUrls };
  } catch (err) {
    return { error: fetchFailureMessage(err) };
  }
}

export async function captureRivalFromUpload(
  supabase: AnyClient,
  rival: MarketingCompetitor,
  files: { bytes: Buffer; mimeType: string }[],
): Promise<{ count: number } | { error: string }> {
  const menus: ParsedMenu[] = [];
  for (const file of files) {
    const extracted = await extractMenuFromFile({ ...file, drinksOnly: true });
    if (!("error" in extracted)) menus.push(extracted.menu);
  }
  const merged = mergeParsedMenus(menus);
  const when = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return replaceRivalPrices(supabase, rival, merged, {
    sourceUrl: null,
    sourceName: `Board photo ${when}`,
    source: "upload",
    menuUrls: rivalMenuUrls(rival),
  });
}
