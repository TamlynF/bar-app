import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureSource, MarketingCompetitor } from "./types";
import {
  captureSourceForUrl,
  isJunkMenuUrl,
  mergeParsedMenus,
  rivalCaptureStarts,
  rivalMenuUrls,
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
      last_capture_error: null,
      last_capture_attempted_at: new Date().toISOString(),
      menu_urls: menuUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rival.id);
  if (updError) return { error: updError.message };

  return { count: rows.length };
}

async function menusFromHtmlPages(
  pages: { url: string; text: string }[],
): Promise<{ menus: ParsedMenu[]; note: string | null }> {
  const blob = pages
    .map((page) => `SOURCE: ${page.url}\n${page.text}`)
    .join("\n\n")
    .slice(0, 80_000);
  if (blob.length < 40) return { menus: [], note: "Pages had too little text to read." };
  const extracted = await extractMenuFromText(blob, true);
  if ("error" in extracted) return { menus: [], note: extracted.error };
  return { menus: [extracted.menu], note: null };
}

async function markCaptureAttempt(
  supabase: AnyClient,
  rivalId: string,
  extra: { last_capture_error?: string | null; menu_urls?: string[] },
) {
  await supabase
    .from("marketing_competitors")
    .update({
      last_capture_attempted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", rivalId);
}

export async function captureRivalFromUrl(
  supabase: AnyClient,
  rival: MarketingCompetitor,
): Promise<{ count: number; menuUrls: string[]; notes: string[] } | { error: string; notes: string[] }> {
  const notes: string[] = [];
  const starts = rivalCaptureStarts(rival);
  if (!starts.length) {
    const error = "Add a website or drinks menu URL first.";
    notes.push(error);
    await markCaptureAttempt(supabase, rival.id, { last_capture_error: error });
    return { error, notes };
  }

  notes.push(`Called ${starts.join(" → ")}`);

  try {
    const found = await discoverDrinkMenus(starts, rival.name);
    notes.push(
      found.files.length || found.pages.length
        ? `Opened ${found.pages.length} page${found.pages.length === 1 ? "" : "s"} and ${found.files.length} file${found.files.length === 1 ? "" : "s"}`
        : "No readable pages or files from those URLs",
    );
    if (found.pageUrls.length) notes.push(`Pages: ${found.pageUrls.slice(0, 8).join(", ")}`);
    if (found.files.length) notes.push(`Files: ${found.files.map((file) => file.url).join(", ")}`);
    for (const failure of found.failures.slice(0, 8)) notes.push(`${failure.url}: ${failure.error}`);

    const menus: ParsedMenu[] = [];
    for (const file of found.files) {
      const extracted = await extractMenuFromFile({
        bytes: file.bytes,
        mimeType: file.mimeType,
        drinksOnly: true,
      });
      if ("error" in extracted) notes.push(`${file.url}: ${extracted.error}`);
      else menus.push(extracted.menu);
    }
    const drinkPages = found.pages.filter((p) => /menu|drink|tenkites|hansom-cab/i.test(p.url));
    let html = await menusFromHtmlPages(drinkPages.length ? drinkPages : found.pages);
    if (!html.menus.length && drinkPages.length) html = await menusFromHtmlPages(found.pages);
    if (html.note) notes.push(html.note);
    menus.push(...html.menus);

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
    ]).filter((url) => !isJunkMenuUrl(url));
    const menuUrls = uniqueUrls(
      discovered.length ? discovered : [...rivalMenuUrls(rival), ...found.pageUrls],
    ).filter((url) => !isJunkMenuUrl(url));

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
      notes.push(saved.error);
      console.info("[rivals] capture prices skipped", rival.name, saved.error);
      await markCaptureAttempt(supabase, rival.id, {
        last_capture_error: notes.join("\n"),
        menu_urls: menuUrls.length ? menuUrls : undefined,
      });
      return { error: saved.error, notes };
    }
    console.info("[rivals] capture prices saved", rival.name, saved.count);
    notes.push(`Saved ${saved.count} drink prices`);
    return { count: saved.count, menuUrls, notes };
  } catch (err) {
    const error = fetchFailureMessage(err);
    notes.push(error);
    await markCaptureAttempt(supabase, rival.id, { last_capture_error: notes.join("\n") });
    return { error, notes };
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
