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
  const metaRows = {
    competitorId: rival.id,
    venueName: rival.name,
    area: rival.area ?? "",
    sourceUrl: meta.sourceUrl,
    sourceName: meta.sourceName,
  };
  const drinkRows = rowsFromParsedMenu(menu, metaRows, true);
  const rows = drinkRows.length ? drinkRows : rowsFromParsedMenu(menu, metaRows, false);
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", rival.id);
  if (updError) return { error: updError.message };

  return { count: rows.length };
}

async function menusFromHtmlPages(
  pages: { url: string; text: string }[],
): Promise<ParsedMenu[]> {
  const blob = pages
    .map((page) => `SOURCE: ${page.url}\n${page.text}`)
    .join("\n\n")
    .slice(0, 80_000);
  if (blob.length < 40) return [];
  const extracted = await extractMenuFromText(blob, true);
  return "error" in extracted ? [] : [extracted.menu];
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
    let htmlMenus = await menusFromHtmlPages(drinkPages.length ? drinkPages : found.pages);
    if (!htmlMenus.length && drinkPages.length) htmlMenus = await menusFromHtmlPages(found.pages);
    menus.push(...htmlMenus);

    const merged = mergeParsedMenus(menus);
    console.info("[rivals] capture", rival.name, {
      starts,
      files: found.files.map((file) => file.url),
      pages: found.pages.map((page) => page.url),
      categories: merged.categories.map((category) => `${category.name}:${category.items.length}`),
    });
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
    if ("error" in saved) {
      console.info("[rivals] capture prices skipped", rival.name, saved.error);
      return saved;
    }
    console.info("[rivals] capture prices saved", rival.name, saved.count);
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
