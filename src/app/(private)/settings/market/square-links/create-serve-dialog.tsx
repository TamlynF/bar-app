"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGbp } from "@/lib/price";
import { normaliseName } from "@/lib/menu-import";
import {
  defaultMenuItem,
  hiddenServeLabel,
  type MenuCategoryOption,
  type MenuItemOption,
  type SquareItemRow,
} from "@/lib/market/square-item-rows";
import { createHiddenServeAction } from "../actions";
import { NEUTRAL_BUTTON, PRIMARY_BUTTON } from "../ui";

const NEW_ITEM = "new";
const FIELD =
  "h-11 w-full rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none focus-visible:ring-2 focus-visible:ring-admin-gold sm:h-9";

/* Gives a Square variation the menu has no serve for a hidden serve, on an
   item that already exists (hidden or not) or on a new hidden item, so it can
   trade on the market without appearing on the menu. Mounted per variation,
   so each opening starts from that variation's defaults. */
export default function CreateServeDialog({
  row,
  categories,
  items,
  onOpenChange,
}: {
  row: SquareItemRow | null;
  categories: MenuCategoryOption[];
  items: MenuItemOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initial = row ? defaultMenuItem(items, row.itemName, row.menuCategoryId) : null;
  const [choice, setChoice] = useState<string>(initial ? String(initial.id) : NEW_ITEM);
  const [name, setName] = useState(row?.itemName ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(row?.menuCategoryId ?? null);

  const serve = row ? hiddenServeLabel(row.variationName) : "";
  const existing = choice === NEW_ITEM ? null : (items.find((item) => String(item.id) === choice) ?? null);
  const byCategory = useMemo(() => {
    const out: { name: string; items: MenuItemOption[] }[] = [];
    for (const item of items) {
      const last = out[out.length - 1];
      if (last && last.name === item.categoryName) last.items.push(item);
      else out.push({ name: item.categoryName, items: [item] });
    }
    return out;
  }, [items]);

  const sameName =
    choice === NEW_ITEM && categoryId != null
      ? items.find(
          (item) => item.categoryId === categoryId && normaliseName(item.name) === normaliseName(name),
        )
      : undefined;
  const target = existing ?? sameName ?? null;
  const canCreate =
    row?.price != null && (existing != null || (name.trim().length > 0 && categoryId != null));

  function plan(): string {
    if (target) {
      if (target.serves.includes(serve)) {
        return `"${target.name}" already has a ${serve} serve, so that serve is linked instead.`;
      }
      const reused = target === sameName ? `${target.categoryName} already has "${target.name}". ` : "";
      return `${reused}Adds a hidden ${serve} serve to it${target.hidden ? "" : "; the item stays on the menu as it is"}.`;
    }
    if (!name.trim()) return "Give the new item a name.";
    if (categoryId == null) return "Pick the menu category it belongs to.";
    const category = categories.find((option) => option.id === categoryId)?.name ?? "";
    return `Creates "${name.trim()}" in ${category} with a ${serve} serve. Neither shows on the public menu.`;
  }

  function create() {
    if (!row || !canCreate) return;
    startTransition(async () => {
      const result = await createHiddenServeAction(
        row.variationId,
        existing ? { menuItemId: existing.id } : { categoryId: categoryId!, name: name.trim() },
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.createdItem
          ? `${result.itemName} created, hidden from the menu, and linked.`
          : result.createdServe
            ? `Hidden ${serve} serve added to ${result.itemName} and linked.`
            : "Link saved.",
      );
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={row != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(28rem,calc(100%-2rem))] gap-0 overflow-hidden rounded-3xl border-2 border-admin-line bg-admin-surface p-0">
        <DialogHeader className="border-b border-admin-line px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-base font-bold tracking-tight text-admin-ink">New hidden serve</DialogTitle>
          <DialogDescription className="text-[13px] text-admin-muted">
            For Square items the menu does not list. It can trade on market nights but stays off the public menu.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-3 px-5 py-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-admin-line bg-admin-card px-4 py-3 text-[13px]">
              <dt className="text-admin-muted">Square item</dt>
              <dd className="font-semibold text-admin-ink">
                {row.itemName}
                {row.variationName && <span className="font-medium text-admin-muted"> · {row.variationName}</span>}
              </dd>
              <dt className="text-admin-muted">Serve</dt>
              <dd className="font-semibold text-admin-ink">{serve}</dd>
              <dt className="text-admin-muted">Price</dt>
              <dd className="font-semibold text-admin-ink">{row.price != null ? formatGbp(row.price) : "No fixed price"}</dd>
            </dl>

            <label className="block space-y-1">
              <span className="text-[12px] font-semibold text-admin-ink">Menu item</span>
              <select
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
                className={`${FIELD} cursor-pointer`}
              >
                <option value={NEW_ITEM}>New item</option>
                {byCategory.map((group) => (
                  <optgroup key={group.name} label={group.name}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.hidden ? " (hidden)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            {existing ? (
              <p className="text-[12px] text-admin-muted">
                In {existing.categoryName}
                {existing.hidden ? ", hidden from the menu" : ", on the menu"}
                {existing.serves.length ? ` · serves: ${existing.serves.join(", ")}` : ""}
              </p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold text-admin-ink">Item name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={120}
                    className={FIELD}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold text-admin-ink">Menu category</span>
                  <select
                    value={categoryId ?? ""}
                    onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : null)}
                    className={`${FIELD} cursor-pointer`}
                  >
                    <option value="">Pick a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <p className="text-[12px] text-admin-muted">{plan()}</p>
          </div>
        )}
        <DialogFooter className="border-t border-admin-line px-5 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={NEUTRAL_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={create} disabled={isPending || !canCreate} className={PRIMARY_BUTTON}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create and link
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
