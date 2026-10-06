"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { GalleryCategory } from "@/lib/gallery-categories";
import {
  deleteGalleryCategoryAction,
  moveGalleryCategoryAction,
  saveGalleryCategoryAction,
  setGalleryCategoryActiveAction,
} from "./actions";

type MediaOption = { id: number; title: string; media_type: string; category_ids: number[] };

const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink disabled:pointer-events-none disabled:opacity-30 sm:h-8 sm:w-8";
const TEXT_INPUT =
  "h-11 min-w-0 flex-1 rounded-lg border border-admin-line bg-white px-3 text-[13px] text-admin-ink outline-none placeholder:text-admin-muted/60 focus:border-admin-primary sm:h-9";

export function GalleryCategoriesPanel({
  categories,
  media,
}: {
  categories: GalleryCategory[];
  media: MediaOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCover, setEditCover] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { confirm, ConfirmDialogUI } = useConfirm();

  const itemsIn = (id: number) => media.filter((m) => m.category_ids.includes(id));
  const uncategorised = media.filter((m) => m.category_ids.length === 0).length;

  function run(id: number | null, action: () => Promise<{ error?: string }>, done?: () => void) {
    setBusyId(id);
    startTransition(async () => {
      const res = await action();
      setBusyId(null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      done?.();
    });
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    run(null, () => saveGalleryCategoryAction({ name }), () => {
      setNewName("");
      toast.success(`Added "${name}"`);
    });
  }

  function startEdit(c: GalleryCategory) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditCover(c.cover_image_id ? String(c.cover_image_id) : "");
  }

  function saveEdit(c: GalleryCategory) {
    run(
      c.id,
      () => saveGalleryCategoryAction({ id: c.id, name: editName, cover_image_id: editCover ? Number(editCover) : null }),
      () => {
        setEditingId(null);
        toast.success("Category saved");
      }
    );
  }

  async function remove(c: GalleryCategory) {
    const count = itemsIn(c.id).length;
    const ok = await confirm({
      title: "Delete category",
      description:
        count > 0
          ? `Delete "${c.name}"? Its ${count} ${count === 1 ? "item stays" : "items stay"} in the gallery - they just lose this category.`
          : `Delete "${c.name}"?`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (ok) run(c.id, () => deleteGalleryCategoryAction(c.id), () => toast.success("Category deleted"));
  }

  return (
    <section
      aria-labelledby="gallery-categories-heading"
      className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm"
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-admin-line bg-admin-primary-soft px-4 py-2 sm:px-5">
        <Tags className="h-4 w-4 text-admin-primary" aria-hidden="true" />
        <h2 id="gallery-categories-heading" className="flex-1 text-[14px] font-bold text-admin-ink">
          Categories
        </h2>
        <span className="text-[12px] text-admin-muted">
          {uncategorised > 0 ? `${uncategorised} uncategorised` : "Everything sorted"}
        </span>
      </div>

      <ul className="divide-y divide-admin-line">
        {categories.map((c, i) => {
          const items = itemsIn(c.id);
          const busy = busyId === c.id && isPending;
          if (editingId === c.id) {
            return (
              <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <input
                  aria-label="Category name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={TEXT_INPUT}
                />
                <select
                  aria-label="Cover image"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  className={cn(TEXT_INPUT, "sm:max-w-60")}
                >
                  <option value="">Cover: newest photo</option>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>
                      Cover: {m.title}
                      {m.media_type === "video" ? " (video)" : ""}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveEdit(c)}
                    disabled={busy}
                    className="flex h-11 items-center gap-1.5 rounded-lg border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] sm:h-9"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-11 items-center rounded-lg border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] transition-colors hover:bg-[#ECE9DE] sm:h-9"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li key={c.id} className="flex items-center gap-1 px-2 py-1.5 sm:px-3">
              <div className="flex flex-col sm:flex-row">
                <button
                  type="button"
                  aria-label={`Move ${c.name} up`}
                  title="Move up"
                  disabled={i === 0 || isPending}
                  onClick={() => run(c.id, () => moveGalleryCategoryAction(c.id, -1))}
                  className={ICON_BUTTON}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${c.name} down`}
                  title="Move down"
                  disabled={i === categories.length - 1 || isPending}
                  onClick={() => run(c.id, () => moveGalleryCategoryAction(c.id, 1))}
                  className={ICON_BUTTON}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1 px-1">
                <p className={cn("truncate text-sm font-semibold", c.is_active ? "text-admin-ink" : "text-admin-muted")}>
                  {c.name}
                </p>
                <p className="text-[12px] text-admin-muted">
                  {items.length} {items.length === 1 ? "item" : "items"}
                  <span className="hidden sm:inline"> · /gallery/{c.slug}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => run(c.id, () => setGalleryCategoryActiveAction(c.id, !c.is_active))}
                disabled={isPending}
                aria-label={`${c.name} is ${c.is_active ? "shown" : "hidden"}. ${c.is_active ? "Hide" : "Show"} it`}
                className={cn(
                  "flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors sm:h-8 sm:min-w-0",
                  c.is_active
                    ? "bg-admin-success-bg text-admin-success hover:brightness-95"
                    : "bg-admin-error-bg text-admin-error hover:brightness-95"
                )}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : c.is_active ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">{c.is_active ? "Shown" : "Hidden"}</span>
              </button>
              <button
                type="button"
                aria-label={`Edit ${c.name}`}
                title="Edit"
                onClick={() => startEdit(c)}
                className={ICON_BUTTON}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${c.name}`}
                title="Delete"
                onClick={() => remove(c)}
                disabled={isPending}
                className={cn(ICON_BUTTON, "hover:bg-admin-error-bg hover:text-admin-error")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex gap-2 border-t border-admin-line px-4 py-3 sm:px-5"
      >
        <input
          aria-label="New category name"
          placeholder="New category, e.g. Beer garden"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={TEXT_INPUT}
        />
        <button
          type="submit"
          disabled={!newName.trim() || isPending}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:opacity-50 sm:h-9"
        >
          {isPending && busyId === null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add category
        </button>
      </form>
      {ConfirmDialogUI}
    </section>
  );
}
