"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  hiddenServeLabel,
  type MenuCategoryOption,
  type ServeOption,
  type SquareItemRow,
} from "@/lib/market/square-item-rows";
import { createHiddenServeAction } from "../actions";
import { NEUTRAL_BUTTON, PRIMARY_BUTTON } from "../ui";

function planText(row: SquareItemRow, serve: string, categoryId: number | null, serves: ServeOption[]): string {
  if (categoryId == null) return "Pick the menu category it belongs to.";
  const existing = serves.filter(
    (option) => option.categoryId === categoryId && normaliseName(option.itemName) === normaliseName(row.itemName),
  );
  if (existing.length === 0) {
    return `Creates "${row.itemName}" with a ${serve} serve. Neither shows on the public menu.`;
  }
  if (existing.some((option) => option.serve === serve)) {
    return `"${existing[0].itemName}" already has a ${serve} serve, so that serve is linked instead.`;
  }
  return `Adds a hidden ${serve} serve to "${existing[0].itemName}". The item stays on the menu as it is.`;
}

/* Gives a Square variation the menu has no serve for a hidden menu row of its
   own, so it can trade on the market without appearing on the menu. */
export default function CreateServeDialog({
  row,
  categories,
  serves,
  onOpenChange,
}: {
  row: SquareItemRow | null;
  categories: MenuCategoryOption[];
  serves: ServeOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [picked, setPicked] = useState<{ variationId: string; categoryId: number | null } | null>(null);
  const categoryId =
    row && picked?.variationId === row.variationId ? picked.categoryId : (row?.menuCategoryId ?? null);
  const serve = row ? hiddenServeLabel(row.variationName) : "";

  function create() {
    if (!row || categoryId == null) return;
    startTransition(async () => {
      const result = await createHiddenServeAction(row.variationId, categoryId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.createdItem
          ? `${row.itemName} added to the menu, hidden, and linked.`
          : result.createdServe
            ? `Hidden ${serve} serve added to ${row.itemName} and linked.`
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
          <DialogTitle className="text-base font-bold tracking-tight text-admin-ink">Create hidden menu serve</DialogTitle>
          <DialogDescription className="text-[13px] text-admin-muted">
            For Square items the menu does not list. It can trade on market nights but stays off the public menu.
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-3 px-5 py-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-admin-line bg-admin-card px-4 py-3 text-[13px]">
              <dt className="text-admin-muted">Item</dt>
              <dd className="font-semibold text-admin-ink">{row.itemName}</dd>
              <dt className="text-admin-muted">Serve</dt>
              <dd className="font-semibold text-admin-ink">{serve}</dd>
              <dt className="text-admin-muted">Price</dt>
              <dd className="font-semibold text-admin-ink">{row.price != null ? formatGbp(row.price) : "No fixed price"}</dd>
            </dl>
            <label className="block space-y-1">
              <span className="text-[12px] font-semibold text-admin-ink">Menu category</span>
              <select
                value={categoryId ?? ""}
                onChange={(event) =>
                  setPicked({
                    variationId: row.variationId,
                    categoryId: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="h-11 w-full cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none sm:h-9"
              >
                <option value="">Pick a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[12px] text-admin-muted">{planText(row, serve, categoryId, serves)}</p>
          </div>
        )}
        <DialogFooter className="border-t border-admin-line px-5 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className={NEUTRAL_BUTTON}>
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={isPending || categoryId == null || row?.price == null}
            className={cn(PRIMARY_BUTTON)}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create and link
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
