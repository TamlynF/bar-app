"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Plus, Loader2, Save, Pencil, Trash2, AlertCircle, Scale } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SERVES } from "@/lib/menu-price";
import { cn } from "@/lib/utils";
import { savePriceRoundAction, deletePriceRoundAction } from "./actions";

export type PriceRound = {
  id: number;
  key: string;
  label: string;
  serves: string;
  display_order: number;
  is_active: boolean;
  created_at?: string | null;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
};

export type EmployeeOption = { id: number; full_name: string | null };

type SheetMode = { type: "view"; id: number } | { type: "edit"; id: number | null };

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PriceRoundsClient({
  initialRounds = [],
  employees = [],
}: {
  initialRounds: PriceRound[];
  employees?: EmployeeOption[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetMode | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [pickedServes, setPickedServes] = useState<string[]>(["each"]);

  const employeeById = new Map(employees.map((e) => [e.id, e.full_name ?? "-"] as const));
  const employeeName = (id?: number | null) => (id ? employeeById.get(id) ?? "-" : "-");

  const current =
    sheet && sheet.id != null ? initialRounds.find((r) => r.id === sheet.id) ?? null : null;

  const closeSheet = () => {
    setSheet(null);
    setFormError(null);
  };

  const startEdit = (round: PriceRound | null) => {
    setFormError(null);
    setIsActive(round?.is_active ?? true);
    setPickedServes(round ? round.serves.split(",").map((s) => s.trim()) : ["each"]);
    setSheet({ type: "edit", id: round?.id ?? null });
  };

  const toggleServe = (serve: string) => {
    setPickedServes((prev) =>
      prev.includes(serve) ? prev.filter((s) => s !== serve) : [...prev, serve]
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setFormError(null);
    startTransition(async () => {
      const result = await savePriceRoundAction(formData);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  const handleDelete = async (round: PriceRound) => {
    const ok = await confirm({
      title: "Delete round",
      description: `"${round.label}" will stop being compared. Menu items pointed at it fall back to matching by name.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deletePriceRoundAction(round.id);
      if (result?.error) setFormError(result.error);
      else closeSheet();
    });
  };

  return (
    <div className="space-y-3 px-2 py-2 sm:px-8 sm:py-0">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-[#20231A]">Price rounds</h3>
          <p className="text-[11px] font-medium text-[#5E6654]">
            {initialRounds.length} rounds compared on the price page
          </p>
        </div>
        <button
          type="button"
          onClick={() => startEdit(null)}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#34451F] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719] sm:h-9"
        >
          <Plus className="h-4 w-4" />
          Round
        </button>
      </div>

      {initialRounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <Scale className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="text-sm font-bold text-[#20231A]">No rounds yet</p>
          <p className="mt-1 text-[11px] text-[#5E6654]">
            Add a round to start comparing prices against it
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white">
          <div className="divide-y divide-[#D8D5C8]/50">
            {initialRounds.map((round) => (
              <div
                key={round.id}
                onClick={() => setSheet({ type: "view", id: round.id })}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#F4F1E8]"
              >
                <span className="w-6 shrink-0 text-[12px] font-semibold text-[#5E6654] tabular-nums">
                  {round.display_order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#20231A]">
                    {round.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#5E6654]">
                    {round.key} &middot; priced off {round.serves.split(",").join(", ")}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                    round.is_active
                      ? "border-[#22613F]/30 bg-[#E7F3EC] text-[#22613F]"
                      : "border-[#D8D5C8] bg-[#ECE9DE] text-[#5E6654]"
                  )}
                >
                  {round.is_active ? "Active" : "Off"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={!!sheet} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent
          side="bottom"
          className="flex h-[85vh] flex-col gap-0 rounded-t-3xl border-[#D8D5C8] bg-[#F4F1E8] p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-4xl"
        >
          <div className="shrink-0 border-b-2 border-[#D8D5C8] bg-white/80 px-6 py-4 backdrop-blur-md sm:rounded-t-4xl">
            <SheetTitle className="text-[15px] font-bold text-[#20231A]">
              {sheet?.type === "view"
                ? "View round"
                : sheet?.id
                  ? "Edit round"
                  : "New round"}
            </SheetTitle>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {sheet?.type === "view" && current && (
              <div className="space-y-3">
                <DetailCell label="Label" value={current.label} />
                <DetailCell label="Key" value={current.key} />
                <DetailCell label="Priced off" value={current.serves.split(",").join(", ")} />
                <DetailCell label="Order" value={String(current.display_order)} />
                <DetailCell label="Status" value={current.is_active ? "Active" : "Off"} />
                <DetailCell label="Created" value={formatDateTime(current.created_at)} />
                <DetailCell label="Created by" value={employeeName(current.created_by)} />
                <DetailCell label="Updated" value={formatDateTime(current.updated_at)} />
                <DetailCell label="Updated by" value={employeeName(current.updated_by)} />
                {formError && <ErrorBox message={formError} />}
              </div>
            )}

            {sheet?.type === "edit" && (
              <form id="round-form" onSubmit={handleSubmit} className="space-y-3">
                {current && <input type="hidden" name="id" value={current.id} />}
                <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />

                <div className="divide-y divide-[#D8D5C8]/50 overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
                  <FormRow label="Label" required>
                    <input
                      name="label"
                      required
                      aria-label="Label"
                      placeholder="e.g. Pint (Cider)"
                      defaultValue={current?.label ?? ""}
                      className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
                    />
                  </FormRow>
                  <FormRow label="Key" required>
                    <input
                      name="key"
                      required
                      aria-label="Key"
                      placeholder="e.g. pint_cider"
                      defaultValue={current?.key ?? ""}
                      className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
                    />
                  </FormRow>
                  <FormRow label="Order">
                    <input
                      name="display_order"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      aria-label="Display order"
                      defaultValue={current?.display_order ?? initialRounds.length + 1}
                      className="flex-1 bg-transparent text-right text-[13px] font-semibold text-[#20231A] outline-none"
                    />
                  </FormRow>
                  <FormRow label="Status">
                    <div className="flex flex-1 justify-end gap-1.5">
                      {[true, false].map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setIsActive(value)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-[12px] font-semibold",
                            isActive === value
                              ? "border-[#34451F] bg-[#E5EBD8] text-[#34451F]"
                              : "border-[#D8D5C8] bg-white text-[#5E6654]"
                          )}
                        >
                          {value ? "Active" : "Off"}
                        </button>
                      ))}
                    </div>
                  </FormRow>
                </div>

                <div className="rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-wide text-[#5E6654] uppercase opacity-60">
                    Priced off
                  </p>
                  <p className="mt-1 mb-2.5 text-[12px] leading-snug text-[#5E6654]">
                    Only items sold in one of these measures can price this round.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVES.map((serve) => {
                      const picked = pickedServes.includes(serve);
                      return (
                        <label
                          key={serve}
                          className={cn(
                            "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold",
                            picked
                              ? "border-[#34451F] bg-[#E5EBD8] text-[#34451F]"
                              : "border-[#D8D5C8] bg-white text-[#5E6654]"
                          )}
                        >
                          <input
                            type="checkbox"
                            name="serves"
                            value={serve}
                            checked={picked}
                            onChange={() => toggleServe(serve)}
                            aria-label={serve}
                            className="sr-only"
                          />
                          {serve}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {formError && <ErrorBox message={formError} />}
              </form>
            )}
          </div>

          <div className="z-40 shrink-0 border-t-2 border-[#D8D5C8] bg-white/80 px-6 py-4 pb-8 backdrop-blur-md sm:rounded-b-4xl sm:pb-4">
            {sheet?.type === "view" && current && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="ghost"
                  onClick={() => handleDelete(current)}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-[#D8D5C8] bg-white text-[13px] font-semibold text-[#B33A32] hover:border-[#B33A32]/30 hover:bg-[#FDECEA] hover:text-[#B33A32]"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-4 w-4" />
                  )}
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => startEdit(current)}
                  className="h-12 rounded-2xl border border-[#34451F] bg-white text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] hover:text-[#34451F] active:scale-95"
                >
                  <Pencil className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
              </div>
            )}

            {sheet?.type === "edit" && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeSheet}
                  disabled={isPending}
                  className="h-12 rounded-2xl border border-[#D8D5C8] bg-white text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="round-form"
                  disabled={isPending}
                  className="h-12 rounded-2xl bg-[#34451F] text-[13px] font-semibold text-white shadow-lg hover:bg-[#283719] active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" />
                      Save
                    </>
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

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5 text-[#5E6654] opacity-60">
        <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
        {required && <span className="text-[11px] font-semibold text-[#B33A32]">*</span>}
      </div>
      {children}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#D8D5C8] bg-white px-4 py-2.5">
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-[#5E6654] uppercase opacity-60">
        {label}
      </span>
      <span className="flex-1 text-right text-[13px] font-semibold break-all text-[#20231A]">
        {value}
      </span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#B33A32]/30 bg-[#FDECEA] p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B33A32]" />
      <p className="text-[13px] leading-snug font-semibold text-[#B33A32]">{message}</p>
    </div>
  );
}
