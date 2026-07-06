"use client";

import { useMemo, useState, useTransition } from "react";
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
  ChevronDown,
  Pencil,
  Trash2,
  Save,
  LayoutDashboard,
  AlertCircle,
  Hash,
  Circle,
  RectangleHorizontal,
  Ruler,
  Armchair,
  Search,
  X,
  Check,
} from "lucide-react";
import { saveTableAction, deleteTableAction } from "../actions";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { ChairLayout } from "@/lib/floor-plan/types";

export type Table = {
  id: number;
  name: string;
  max_capacity: number;
  available: boolean;
  description: string | null;
  shape: "round" | "rect";
  diameter: number | null;
  width: number | null;
  length: number | null;
  chair_layout: ChairLayout | null;
};

type ShapeFilter = "all" | "round" | "rect";
type AvailFilter = "all" | "available" | "unavailable";

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
  const [shape, setShape] = useState<"round" | "rect">("round");
  const [chairMode, setChairMode] = useState<"auto" | "sides" | "bench">("auto");

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [shapeFilter, setShapeFilter] = useState<ShapeFilter>("all");
  const [availFilter, setAvailFilter] = useState<AvailFilter>("all");

  const anyFilterActive =
    query.trim() !== "" || shapeFilter !== "all" || availFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setShapeFilter("all");
    setAvailFilter("all");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialTables.filter((t) => {
      if (shapeFilter !== "all" && t.shape !== shapeFilter) return false;
      if (availFilter === "available" && !t.available) return false;
      if (availFilter === "unavailable" && t.available) return false;
      if (q) {
        const hay = `${t.name} ${t.id} ${t.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [initialTables, query, shapeFilter, availFilter]);

  // ── Edit-form collapsible sections ────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    details: true,
    capacity: true,
    shape: true,
    chairs: true,
  });
  const toggleSection = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

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
    setShape("round");
    setChairMode("auto");
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
    <div className="px-4 py-4 md:px-6 sm:py-0 space-y-4 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#5F624F]">
          {initialTables.length} table{initialTables.length !== 1 ? "s" : ""}
          {anyFilterActive && (
            <span className="text-[#5C4033]"> · {filtered.length} shown</span>
          )}
        </p>
        <Button
          onClick={openAdd}
          size="sm"
          className="h-11 sm:h-9 px-4 rounded-xl font-black uppercase tracking-wide text-[10px] bg-[#1B4332] text-white hover:bg-[#1B4332]/85"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Table
        </Button>
      </div>

      {/* ── Filter bar ── */}
      {initialTables.length > 0 && (
        <div className="space-y-2.5">
          {/* Search */}
          <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-[#E6DFC8] bg-white focus-within:border-[#5C4033]/40 transition-colors">
            <Search className="w-4 h-4 text-[#5F624F]/50 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by table name, ID or location..."
              aria-label="Search tables"
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[#1F1F1A] placeholder:text-[#5F624F]/40 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-[#5F624F]/60 hover:text-[#5C4033]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={shapeFilter === "all"} onClick={() => setShapeFilter("all")}>
              All shapes
            </Chip>
            <Chip active={shapeFilter === "round"} onClick={() => setShapeFilter("round")}>
              <Circle className="w-3 h-3" /> Round
            </Chip>
            <Chip active={shapeFilter === "rect"} onClick={() => setShapeFilter("rect")}>
              <RectangleHorizontal className="w-3 h-3" /> Rectangular
            </Chip>

            <span className="w-px h-4 bg-[#E6DFC8] mx-1" />

            <Chip active={availFilter === "all"} onClick={() => setAvailFilter("all")}>
              All
            </Chip>
            <Chip
              active={availFilter === "available"}
              onClick={() => setAvailFilter("available")}
            >
              <Check className="w-3 h-3" /> Available
            </Chip>
            <Chip
              active={availFilter === "unavailable"}
              onClick={() => setAvailFilter("unavailable")}
            >
              <X className="w-3 h-3" /> Unavailable
            </Chip>

            {anyFilterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto font-black text-[10px] uppercase tracking-wide text-[#5C4033] underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Card List ── */}
      {initialTables.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <LayoutDashboard className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No tables yet</p>
          <p className="text-[11px] text-[#5F624F] mt-1">
            Add your first table to get started
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[#E6DFC8] rounded-2xl py-14 text-center">
          <Search className="w-8 h-8 text-[#5F624F] opacity-30 mx-auto mb-3" />
          <p className="text-sm font-black text-[#1F1F1A]">No matching tables</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-black uppercase tracking-wide text-[#5C4033] underline underline-offset-2 mt-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((table) => (
            <div
              key={table.id}
              onClick={() => openView(table)}
              className="bg-white border border-[#E6DFC8] rounded-2xl px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:border-[#5C4033]/30 hover:shadow-sm transition-all active:scale-[0.99]"
            >
              {/* Shape icon */}
              <div className="w-10 h-10 rounded-xl bg-[#F7F4EA] flex items-center justify-center shrink-0 text-[#5C4033]">
                {table.shape === "rect" ? (
                  <RectangleHorizontal className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-1.5 py-0.5 rounded-md tabular-nums shrink-0">
                    #{table.id}
                  </span>
                  <p className="font-black text-[#1F1F1A] truncate">{table.name}</p>
                </div>
                {table.description && (
                  <p className="text-[11px] text-[#5F624F] font-medium truncate mt-0.5">
                    {table.description}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                <InfoBadge icon={<Users className="w-3 h-3" />}>
                  {table.max_capacity}
                </InfoBadge>
                <InfoBadge
                  className="hidden sm:inline-flex"
                  icon={
                    table.shape === "rect" ? (
                      <RectangleHorizontal className="w-3 h-3" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )
                  }
                >
                  {table.shape === "rect" ? "Rectangular" : "Round"}
                </InfoBadge>
                <InfoBadge
                  className="hidden md:inline-flex"
                  icon={<Armchair className="w-3 h-3" />}
                >
                  {chairBadge(table)}
                </InfoBadge>
              </div>

              <StatusPill available={table.available} />

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
            sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-140
            sm:h-auto sm:max-h-[80vh] sm:rounded-4xl sm:bottom-6
            sm:border-2 sm:border-[#E6DFC8]"
        >
          {/* Sticky header */}
          <div className="shrink-0 p-4 pb-3 border-b border-[#E6DFC8] bg-white/80 backdrop-blur-md sticky top-0 z-30 sm:rounded-t-4xl">
            <SheetTitle className="text-xl font-black text-[#1F1F1A] uppercase tracking-tighter leading-tight truncate">
              {isAdding ? "New Table" : isEditing ? "Edit Table" : (selected?.name ?? "")}
            </SheetTitle>
            {selected && !isAdding && (
              <div className="flex items-center gap-1.5 mt-1">
                <Hash className="w-3 h-3 text-[#5F624F]" />
                <span className="text-xs font-black text-[#5F624F] uppercase tracking-wide tabular-nums">
                  ID: {selected.id}
                </span>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 min-h-0 touch-pan-y">

            {/* ── VIEW MODE ── */}
            {!showForm && selected && (
              <div className="animate-in fade-in duration-200 sm:flex sm:flex-col sm:items-center">
                <div className="w-full sm:max-w-sm space-y-4">
                  <div className="bg-white border-2 border-[#E6DFC8] rounded-3xl overflow-hidden">
                    <DetailRow label="Table Name" value={selected.name} />
                    <DetailRow
                      label="Max Capacity"
                      value={`${selected.max_capacity} guests`}
                      icon={<Users className="w-4 h-4" />}
                    />
                    <DetailRow
                      label="Available"
                      value={selected.available ? "Yes — bookable" : "No — hidden"}
                      valueClassName={selected.available ? "text-green-700" : "text-red-600"}
                      icon={
                        selected.available ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )
                      }
                    />
                    <DetailRow
                      label="Shape"
                      value={selected.shape === "rect" ? "Rectangular" : "Round"}
                      icon={selected.shape === "rect"
                        ? <RectangleHorizontal className="w-4 h-4" />
                        : <Circle className="w-4 h-4" />}
                    />
                    <DetailRow
                      label="Size"
                      value={sizeText(selected)}
                      icon={<Ruler className="w-4 h-4" />}
                    />
                    {selected.shape === "rect" && (
                      <DetailRow
                        label="Chair Arrangement"
                        value={chairSummaryFull(selected)}
                        icon={<Armchair className="w-4 h-4" />}
                      />
                    )}
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
                className="animate-in fade-in duration-200 flex flex-col gap-3"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}

                {/* Details */}
                <Section
                  title="Details"
                  open={openSections.details}
                  onToggle={() => toggleSection("details")}
                >
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                </Section>

                {/* Capacity & Availability */}
                <Section
                  title="Capacity & Availability"
                  open={openSections.capacity}
                  onToggle={() => toggleSection("capacity")}
                >
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
                        aria-label="Max capacity"
                        className="flex-1 h-full px-3 text-sm font-bold bg-transparent outline-none text-[#1F1F1A] placeholder:text-[#5F624F]/40"
                      />
                    </div>
                  </div>

                  {/* Available toggle */}
                  <label className="flex items-center justify-between gap-3 cursor-pointer pt-1">
                    <span>
                      <span className="block text-sm font-black text-[#1F1F1A]">
                        Available for booking
                      </span>
                      <span className="block text-[11px] text-[#5F624F] font-medium mt-0.5">
                        Allow this table to be assigned to bookings
                      </span>
                    </span>
                    <span className="relative inline-block shrink-0">
                      <input
                        type="checkbox"
                        name="available"
                        defaultChecked={formDefault ? formDefault.available : true}
                        className="peer sr-only"
                      />
                      <span className="block w-11 h-6 rounded-full bg-[#E6DFC8] peer-checked:bg-green-500 transition-colors" />
                      <span className="pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>
                </Section>

                {/* Shape & Size */}
                <Section
                  title="Shape & Size"
                  open={openSections.shape}
                  onToggle={() => toggleSection("shape")}
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="table-shape"
                      className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                    >
                      Shape <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="table-shape"
                      name="shape"
                      title="Table shape"
                      aria-label="Table shape"
                      value={shape}
                      onChange={(e) => setShape(e.target.value as "round" | "rect")}
                      className="h-14 w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold text-[#1F1F1A] focus:border-[#5C4033] transition-all outline-none"
                    >
                      <option value="round">Round</option>
                      <option value="rect">Rectangular</option>
                    </select>
                  </div>

                  {shape === "round" ? (
                    <div className="space-y-2">
                      <Label
                        htmlFor="table-diameter"
                        className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                      >
                        Diameter (m)
                      </Label>
                      <Input
                        id="table-diameter"
                        name="diameter"
                        type="number"
                        min={0}
                        step={0.05}
                        placeholder="e.g. 1.2"
                        defaultValue={formDefault?.diameter ?? ""}
                        className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label
                          htmlFor="table-width"
                          className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                        >
                          Width (m)
                        </Label>
                        <Input
                          id="table-width"
                          name="width"
                          type="number"
                          min={0}
                          step={0.05}
                          placeholder="e.g. 0.8"
                          defaultValue={formDefault?.width ?? ""}
                          className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="table-length"
                          className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                        >
                          Length (m)
                        </Label>
                        <Input
                          id="table-length"
                          name="length"
                          type="number"
                          min={0}
                          step={0.05}
                          placeholder="e.g. 1.6"
                          defaultValue={formDefault?.length ?? ""}
                          className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                        />
                      </div>
                    </div>
                  )}
                </Section>

                {/* Chair Arrangement — rectangular only */}
                {shape === "rect" && (
                  <Section
                    title="Chair Arrangement"
                    open={openSections.chairs}
                    onToggle={() => toggleSection("chairs")}
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="table-chair-mode"
                        className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                      >
                        Arrangement
                      </Label>
                      <select
                        id="table-chair-mode"
                        name="chair_mode"
                        title="Chair arrangement"
                        aria-label="Chair arrangement"
                        value={chairMode}
                        onChange={(e) => setChairMode(e.target.value as "auto" | "sides" | "bench")}
                        className="h-14 w-full rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold text-[#1F1F1A] focus:border-[#5C4033] transition-all outline-none"
                      >
                        <option value="auto">Auto — spread around the table</option>
                        <option value="sides">Chairs per side</option>
                        <option value="bench">Bench down each long side</option>
                      </select>
                    </div>

                    {chairMode !== "auto" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label
                            htmlFor="table-chair-per-side"
                            className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                          >
                            {chairMode === "bench" ? "Seats per bench" : "Chairs per side"}
                          </Label>
                          <Input
                            id="table-chair-per-side"
                            name="chair_per_side"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="e.g. 3"
                            defaultValue={formDefault?.chair_layout?.perSide ?? ""}
                            className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                          />
                        </div>
                        {chairMode === "sides" && (
                          <div className="space-y-2">
                            <Label
                              htmlFor="table-chair-ends"
                              className="text-[10px] font-black uppercase tracking-wide text-[#5F624F] ml-1"
                            >
                              Chairs per end
                            </Label>
                            <Input
                              id="table-chair-ends"
                              name="chair_ends"
                              type="number"
                              min={0}
                              step={1}
                              placeholder="e.g. 0"
                              defaultValue={formDefault?.chair_layout?.ends ?? ""}
                              className="h-14 rounded-2xl border-2 border-[#E6DFC8] bg-white px-4 text-sm font-bold focus:border-[#5C4033] transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </Section>
                )}

                {formError && <ErrorBox message={formError} />}
              </form>
            )}

            <div className="h-4" />
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 p-5 pb-10 sm:pb-5 border-t-2 border-[#E6DFC8] bg-white/80 backdrop-blur-md z-40 sm:rounded-b-4xl">

            {/* View mode */}
            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3 sm:max-w-sm sm:mx-auto">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#E6DFC8] text-red-500 font-black uppercase tracking-widest text-[10px] bg-white"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Trash2 className="w-4 h-4 mr-2" />Delete</>
                  )}
                </Button>
                <Button
                  onClick={() => { setFormError(null); setShape(selected.shape ?? "round"); setChairMode(selected.chair_layout?.mode ?? "auto"); setIsEditing(true); }}
                  className="h-14 rounded-2xl bg-[#B45309] hover:bg-[#B45309]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
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
                  className="h-14 rounded-2xl bg-[#1B4332] hover:bg-[#1B4332]/85 text-white font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95"
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

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-11 sm:h-9 px-3 rounded-full text-[10px] font-black uppercase tracking-wide inline-flex items-center gap-1.5 border transition-colors",
        active
          ? "bg-[#5C4033] text-white border-[#5C4033]"
          : "bg-white text-[#5F624F] border-[#E6DFC8] hover:border-[#5C4033]/30"
      )}
    >
      {children}
    </button>
  );
}

function InfoBadge({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg whitespace-nowrap",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function StatusPill({ available }: { available: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-lg border",
        available
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-red-50 text-red-600 border-red-200"
      )}
    >
      {available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {available ? "Available" : "Unavailable"}
    </span>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border-2 border-[#E6DFC8] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-3 bg-[#F7F4EA]"
      >
        <span className="text-[10px] font-black uppercase tracking-wide text-[#5C4033]">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[#5F624F] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {/* Body stays mounted (hidden, not unmounted) so all fields submit. */}
      <div className={cn("p-4 space-y-4", !open && "hidden")}>{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E6DFC8] last:border-0">
      <div className="flex items-center gap-2 text-[#5F624F] opacity-60 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide whitespace-nowrap">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-sm font-black text-[#1F1F1A] text-right flex-1 leading-snug",
          valueClassName
        )}
      >
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

// ── Pure formatting helpers ────────────────────────────────────────────────────

function sizeText(t: Table): string {
  if (t.shape === "rect") {
    return t.width && t.length ? `${t.width} × ${t.length} m` : "Not set";
  }
  return t.diameter ? `${t.diameter} m ⌀` : "Not set";
}

/** Short label for the list-row chair badge. */
function chairBadge(t: Table): string {
  if (t.shape !== "rect") return "Auto";
  const cl = t.chair_layout;
  if (!cl || cl.mode === "auto") return "Auto";
  if (cl.mode === "bench") return "Bench";
  return `${cl.perSide ?? 0} per side`;
}

/** Full sentence for the view-sheet chair row. */
function chairSummaryFull(t: Table): string {
  if (t.shape !== "rect") return "Auto";
  const cl = t.chair_layout;
  if (!cl || cl.mode === "auto") return "Auto — spread evenly";
  if (cl.mode === "bench") return `Bench · ${cl.perSide ?? 0} per side`;
  return `${cl.perSide ?? 0} per side${cl.ends ? ` · ${cl.ends} per end` : ""}`;
}
