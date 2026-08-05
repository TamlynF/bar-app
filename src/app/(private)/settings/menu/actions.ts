"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import {
  planSave,
  planDelete,
  type OrderChange,
  type OrderRow,
} from "@/lib/merchandise-order";
import { isBenchmarkKey, matchBenchmark } from "@/app/(private)/marketing/lib/compare";
import { readPriceBenchmarks } from "@/app/(private)/marketing/lib/menu-data";
import type { PriceBenchmark } from "@/app/(private)/marketing/lib/types";
import {
  SERVES,
  isLosslessPriceText,
  parsePriceText,
  type MenuItemPrice,
  type Serve,
} from "@/lib/menu-price";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
type OrderedTable = "menu_categories" | "menu_items";

async function loadCategoryRows(supabase: ServerClient): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, display_order, is_active");
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function loadItemRows(
  supabase: ServerClient,
  categoryId: number
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, display_order, is_active")
    .eq("category_id", categoryId);
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

async function applyChanges(
  supabase: ServerClient,
  table: OrderedTable,
  changes: OrderChange[]
) {
  for (const change of changes) {
    const { error } = await supabase
      .from(table)
      .update({ display_order: change.display_order })
      .eq("id", change.id);
    if (error) throw error;
  }
}

function readTargetPosition(formData: FormData): number | null {
  const raw = formData.get("display_order")?.toString().trim() ?? "";
  return raw === "" ? null : Number(raw);
}

/* Blank stays null rather than 0 so "no mixer" and "the mixer is free" don't
   read the same to the price comparison. */
function readMixerSurcharge(formData: FormData): number | null {
  const raw = formData.get("mixer_surcharge")?.toString().trim() ?? "";
  if (!raw) return null;
  const value = Number(raw.replace(/[£\s]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function saveCategoryAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();

  const name = formData.get("name")?.toString().trim() || "";
  const isActive = formData.get("is_active") !== "false";

  if (!name) return { error: "Category name is required." };

  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadCategoryRows(supabase);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition: readTargetPosition(formData),
    });

    const payload = {
      name,
      note: formData.get("note")?.toString() || null,
      mixer_surcharge: readMixerSurcharge(formData),
      display_order: plan.position,
      is_active: isActive,
    };

    if (id) {
      const { error } = await supabase
        .from("menu_categories")
        .update({ ...payload, updated_at: now, updated_by: currentEmployeeId })
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("menu_categories").insert({
        ...payload,
        created_at: now,
        updated_at: now,
        created_by: currentEmployeeId,
        updated_by: currentEmployeeId,
      });
      if (error) throw error;
    }

    await applyChanges(supabase, "menu_categories", plan.changes);

    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error saving category:", error);
    return { error: error instanceof Error ? error.message : "Failed to save category." };
  }
}

export async function deleteCategoryAction(id: number) {
  const supabase = await createClient();
  try {
    const rows = await loadCategoryRows(supabase);

    const { error } = await supabase.from("menu_categories").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, "menu_categories", planDelete(rows, id));

    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error deleting category:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete category." };
  }
}


// Left on "Auto", the round is worked out once and written down, so the menu
// carries its own answer instead of the comparison re-guessing on every render.
async function suggestBenchmarkKey(
  supabase: ServerClient,
  categoryId: number,
  name: string,
  benchmarks: PriceBenchmark[],
): Promise<string | null> {
  const { data } = await supabase
    .from("menu_categories")
    .select("name")
    .eq("id", categoryId)
    .maybeSingle();
  return matchBenchmark(name, data?.name ?? null, benchmarks)?.key ?? null;
}

function readServes(formData: FormData): MenuItemPrice[] {
  const raw = formData.get("serves")?.toString();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const serve = typeof row?.serve === "string" ? row.serve.trim().toLowerCase() : "";
      const amount = Number(row?.amount);
      if (!serve || !SERVES.includes(serve as Serve)) return [];
      if (!Number.isFinite(amount) || amount <= 0) return [];
      return [{ serve, amount: Math.round(amount * 100) / 100 }];
    });
  } catch {
    return [];
  }
}

// Replaced wholesale rather than diffed - a handful of rows per item, and the
// editor always sends the full set.
async function writeServes(
  supabase: ServerClient,
  menuItemId: number,
  serves: MenuItemPrice[],
  employeeId: number | null,
  now: string,
): Promise<void> {
  const { error: clearError } = await supabase
    .from("menu_item_prices")
    .delete()
    .eq("menu_item_id", menuItemId);
  if (clearError) throw clearError;
  if (!serves.length) return;

  const { error } = await supabase.from("menu_item_prices").insert(
    serves.map((s, index) => ({
      menu_item_id: menuItemId,
      serve: s.serve,
      amount: s.amount,
      display_order: index + 1,
      created_at: now,
      updated_at: now,
      created_by: employeeId,
      updated_by: employeeId,
    })),
  );
  if (error) throw error;
}

export async function saveItemAction(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id")?.toString();

  const categoryId = parseInt(formData.get("category_id")?.toString() || "0", 10);
  const name = formData.get("name")?.toString().trim() || "";
  const price = formData.get("price")?.toString().trim() || "";
  const isActive = formData.get("is_active") !== "false";
  const benchmarkKey = formData.get("benchmark_key")?.toString().trim() || "";

  if (!name || !price) return { error: "Name and price are required." };
  if (!categoryId) return { error: "Category is required." };

  const benchmarks = await readPriceBenchmarks(supabase);
  if (benchmarkKey && !isBenchmarkKey(benchmarkKey, benchmarks)) {
    return { error: "Unknown comparison round." };
  }

  const serves = readServes(formData);
  const currentEmployeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  try {
    const rows = await loadItemRows(supabase, categoryId);
    const plan = planSave(rows, {
      id: id ? Number(id) : null,
      isActive,
      targetPosition: readTargetPosition(formData),
    });

    const payload = {
      category_id: categoryId,
      name,
      price,
      display_order: plan.position,
      is_active: isActive,
      benchmark_key:
        benchmarkKey || (await suggestBenchmarkKey(supabase, categoryId, name, benchmarks)),
    };

    let savedId = id ? Number(id) : null;

    if (savedId) {
      const { error } = await supabase
        .from("menu_items")
        .update({ ...payload, updated_at: now, updated_by: currentEmployeeId })
        .eq("id", savedId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase
        .from("menu_items")
        .insert({
          ...payload,
          created_at: now,
          updated_at: now,
          created_by: currentEmployeeId,
          updated_by: currentEmployeeId,
        })
        .select("id")
        .single();
      if (error) throw error;
      savedId = inserted.id as number;
    }

    await writeServes(supabase, savedId, serves, currentEmployeeId, now);
    await applyChanges(supabase, "menu_items", plan.changes);

    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error saving item:", error);
    return { error: error instanceof Error ? error.message : "Failed to save item." };
  }
}

// Fills the blanks only - a round someone chose by hand is never overwritten.
export async function autoFillBenchmarkKeysAction(): Promise<
  { success: true; filled: number; unmatched: number } | { error: string }
> {
  const supabase = await createClient();
  try {
    const [{ data, error }, benchmarks] = await Promise.all([
      supabase.from("menu_categories").select("name, menu_items(id, name, benchmark_key)"),
      readPriceBenchmarks(supabase),
    ]);
    if (error) throw error;

    const idsByKey = new Map<string, number[]>();
    let unmatched = 0;

    (data ?? []).forEach(
      (cat: { name: string; menu_items?: { id: number; name: string; benchmark_key: string | null }[] }) => {
        (cat.menu_items ?? []).forEach((item) => {
          if (item.benchmark_key) return;
          const key = matchBenchmark(item.name, cat.name, benchmarks)?.key;
          if (!key) {
            unmatched += 1;
            return;
          }
          idsByKey.set(key, [...(idsByKey.get(key) ?? []), item.id]);
        });
      },
    );

    const currentEmployeeId = await getCurrentEmployeeId(supabase);
    const now = new Date().toISOString();
    let filled = 0;

    for (const [key, ids] of idsByKey) {
      const { error: updateError } = await supabase
        .from("menu_items")
        .update({ benchmark_key: key, updated_at: now, updated_by: currentEmployeeId })
        .in("id", ids);
      if (updateError) throw updateError;
      filled += ids.length;
    }

    revalidatePath("/settings/menu");
    revalidatePath("/marketing/trends");
    return { success: true, filled, unmatched };
  } catch (error) {
    console.error("Error auto-filling comparison rounds:", error);
    return { error: error instanceof Error ? error.message : "Failed to auto-fill rounds." };
  }
}

// Reads the serves out of the display text every item already carries. Items
// that already list serves are left alone, and no display text is rewritten:
// where it round-trips exactly a rewrite would change nothing, and where it
// does not - a multibuy tail like "6 for £20.00" is not a serve - a rewrite
// would drop wording the menu needs. Those are counted and reported instead.
export async function backfillServesAction(): Promise<
  { success: true; filled: number; partial: number; skipped: number } | { error: string }
> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, price, menu_item_prices(id)");
    if (error) throw error;

    const rows = (data ?? []) as { id: number; price: string; menu_item_prices: { id: number }[] }[];
    const currentEmployeeId = await getCurrentEmployeeId(supabase);
    const now = new Date().toISOString();

    let filled = 0;
    let partial = 0;
    let skipped = 0;

    for (const row of rows) {
      if (row.menu_item_prices.length) continue;
      const serves = parsePriceText(row.price);
      if (!serves.length) {
        skipped += 1;
        continue;
      }

      await writeServes(supabase, row.id, serves, currentEmployeeId, now);
      filled += 1;
      if (!isLosslessPriceText(row.price)) partial += 1;
    }

    revalidatePath("/settings/menu");
    revalidatePath("/marketing/trends");
    return { success: true, filled, partial, skipped };
  } catch (error) {
    console.error("Error backfilling serves:", error);
    return { error: error instanceof Error ? error.message : "Failed to read prices." };
  }
}

export async function deleteItemAction(id: number) {
  const supabase = await createClient();
  try {
    const { data: item, error: lookupError } = await supabase
      .from("menu_items")
      .select("category_id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const rows = item ? await loadItemRows(supabase, item.category_id) : [];

    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) throw error;

    await applyChanges(supabase, "menu_items", planDelete(rows, id));

    revalidatePath("/settings/menu");
    revalidatePath("/menu");
    return { success: true };
  } catch (error) {
    console.error("Error deleting item:", error);
    return { error: error instanceof Error ? error.message : "Failed to delete item." };
  }
}
