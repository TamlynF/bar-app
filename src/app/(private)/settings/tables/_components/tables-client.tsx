"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  ChevronRight,
  Pencil,
  Trash2,
  Save,
  LayoutDashboard,
  AlertCircle,
  Hash,
} from "lucide-react";
import { saveTableAction, deleteTableAction } from "../actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type Table = {
  id: number;
  name: string;
  max_capacity: number;
  available: boolean;
  description: string | null;
};

export default function TablesClient({
  initialTables = [],
}: {
  initialTables: Table[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [selected, setSelected] = useState<Table | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // ── Sheet helpers ─────────────────────────────────────────────────────────
  const isSheetOpen = !!selected || isAdding;

  const openView = (table: Table) => {
    setFormError(null);
    setIsEditing(false);
    setIsAdding(false);
    setSelected(table);
  };

  const openAdd = () => {
    setFormError(null);
    setIsEditing(false);
    setSelected(null);
    setIsAdding(true);
  };

  const closeSheet = () => {
    setSelected(null);
    setIsAdding(false);
    setIsEditing(false);
    setFormError(null);
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSubmit = (formData: FormData) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveTableAction(formData);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete table",
      description: "Delete this table? This cannot be undone if it has booking history.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteTableAction(selected.id);
      if (result?.error) {
        setFormError(result.error);
      } else {
        closeSheet();
      }
    });
  };

  const showForm = isAdding || isEditing;
  const formDefault = isEditing ? selected : null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
          {initialTables.length} table{initialTables.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={openAdd}
          size="sm"
          className="h-11 sm:h-9 px-4 rounded-xl font-black uppercase tracking-wide text-[10px] bg-[#5C4033] text-white hover:bg-[#5C4033]/90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Table
        </Button>
      </div>

      {/* ── Card List ── */}
      {initialTables.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <LayoutDashboard className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No tables yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            Add your first table to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {initialTables.map((table) => (
            <div
              key={table.id}
              onClick={() => openView(table)}
              className="bg-white border border-[#E6DFC8] rounded-2xl px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:border-[#5C4033]/30 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#F7F4EA] flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4 text-[#5C4033]" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#1F1F1A] truncate">{table.name}</p>
                {table.description && (
                  <p className="text-[11px] text-[#5F624F] font-medium truncate mt-0.5">
                    {table.description}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg">
                  <Users className="w-3 h-3" />
                  {table.max_capacity}
                </span>
                {table.available ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-[#5F624F] opacity-40 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════
          BOTTOM SHEET
      ══════════════════════════════ */}
      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-[#F7F4EA] border-t-2 border-[#E6DFC8] rounded-t-[2.5rem] p-0 h-[85vh]
            flex flex-col outline-none shadow-2xl
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px]
            sm:h-auto sm:max-h-[80vh] sm:rounded-[2rem] sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sticky header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-[2rem]">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
              {isAdding ? "New Table" : isEditing ? "Edit Table" : (selected?.name ?? "")}
            </SheetTitle>
            {selected && !isEditing && (
              <div className="flex items-center gap-1.5 mt-1">
                <Hash className="w-3 h-3 text-[#5F624F]" />
                <span className="text-xs font-black text-[#5F624F] uppercase tracking-wide tabular-nums">
                  ID: {selected.id}
                </span>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 touch-pan-y space-y-5">

            {/* ── VIEW MODE ── */}
            {!showForm && selected && (
              <div className="space-y-5 animate-in fade-in duration-200 sm:flex sm:flex-col sm:items-center">
                <div className="w-full sm:max-w-sm space-y-5">
                  <div className={cn(
                    "flex items-center gap-3 px-5 py-4 rounded-2xl border-2",
                    selected.available
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  )}>
                    {selected.available ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm font-black uppercase tracking-wide",
                      selected.available ? "text-green-700" : "text-red-600"
                    )}>
                      {selected.available ? "Available for booking" : "Not available"}
                    </span>
                  </div>

                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <DetailRow label="Table Name" value={selected.name} />
                    <DetailRow
                      label="Max Capacity"
                      value={`${selected.max_capacity} guests`}
                      icon={<Users className="w-4 h-4" />}
                    />
                    {selected.description && (
                      <DetailRow label="Location / Notes" value={selected.description} />
                    )}
                  </div>

                  {formError && <ErrorBox message={formError} />}
                </div>
              </div>
            )}

            {/* ── EDIT / ADD FORM ── */}
            {showForm && (
              <form
                id="table-form"
                action={handleSubmit}
                className="animate-in fade-in duration-200"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}

                {/* Mobile: stacked · Desktop: 2-column grid */}
                <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">

                  {/* Table Name — full width */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">
                      Table Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="name"
                      placeholder="e.g. Window Booth 1"
                      defaultValue={formDefault?.name ?? ""}
                      required
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-base sm:text-sm font-bold focus:border-[#5C4033] transition-all"
                    />
                  </div>

                  {/* Max Capacity */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">
                      Max Capacity <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white focus-within:border-[#5C4033] transition-all overflow-hidden">
                      <div className="flex items-center justify-center px-4 h-full border-r-2 border-[#E6DFC8] shrink-0">
                        <Users className="w-4 h-4 text-[#5F624F]" />
                      </div>
                      <input
                        name="capacity"
                        type="number"
                        min={1}
                        placeholder="4"
                        required
                        defaultValue={formDefault?.max_capacity ?? ""}
                        className="flex-1 h-full px-3 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                      />
                    </div>
                  </div>

                  {/* Available checkbox — beside capacity on desktop */}
                  <div className="flex items-center justify-between bg-white border-2 border-[#E6DFC8] rounded-2xl px-5 py-4">
                    <div>
                      <p className="text-sm font-black text-[#1F1F1A]">Available for booking</p>
                      <p className="text-[11px] text-[#5F624F] font-medium mt-0.5">
                        Allow this table to be assigned to bookings
                      </p>
                    </div>
                    <input
                      title="Available for booking"
                      type="checkbox"
                      name="available"
                      className="h-5 w-5 rounded accent-[#5C4033] shrink-0 cursor-pointer"
                      defaultChecked={formDefault ? formDefault.available : true}
                    />
                  </div>

                  {/* Location / Notes — full width */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1">
                      Location / Notes
                    </Label>
                    <Input
                      name="description"
                      placeholder="e.g. Near the fireplace, quiet corner..."
                      defaultValue={formDefault?.description ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                    />
                  </div>

                  {formError && (
                    <div className="sm:col-span-2">
                      <ErrorBox message={formError} />
                    </div>
                  )}
                </div>
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 p-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-[2rem]">

            {/* View mode */}
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:mx-auto">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5C4033] font-black uppercase tracking-[0.1em] text-[10px] bg-white"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Trash2 className="w-4 h-4 mr-2" />Delete</>
                  )}
                </Button>
                <Button
                  onClick={() => { setFormError(null); setIsEditing(true); }}
                  className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  <Pencil className="w-4 h-4 mr-2" />Edit
                </Button>
              </div>
            )}

            {/* Edit / Add mode */}
            {showForm && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:mx-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-[#5F624F] font-black uppercase tracking-wide text-[10px] bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="table-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#5C4033] text-white font-black uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save</>
                  )}
                </Button>
              </div>
            )}
          </div>
          {ConfirmDialogUI}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span className="text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <p className="text-sm text-red-700 font-bold leading-snug">{message}</p>
    </div>
  );
}
