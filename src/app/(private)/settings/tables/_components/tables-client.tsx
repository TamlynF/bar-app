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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    details: true,
    capacity: true,
    shape: true,
    chairs: true,
  });
  const toggleSection = (key: string) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

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
    <div className="max-w-4xl space-y-4 px-4 py-4 sm:py-0 md:px-6">

      <div className="flex items-center justify-between gap-3">
        <p className="font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
          {initialTables.length} table{initialTables.length !== 1 ? "s" : ""}
          {anyFilterActive && (
            <span className="text-[#34451F]"> · {filtered.length} shown</span>
          )}
        </p>
        <Button
          onClick={openAdd}
          size="sm"
          className="h-11 rounded-xl bg-[#34451F] px-4 font-black text-[10px] tracking-wide text-white uppercase hover:bg-[#283719] sm:h-9"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Table
        </Button>
      </div>

      {initialTables.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex h-11 items-center gap-2 rounded-xl border border-[#D8D5C8] bg-white px-3 transition-colors focus-within:border-[#34451F]/40">
            <Search className="h-4 w-4 shrink-0 text-[#5E6654]/50" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by table name, ID or location..."
              aria-label="Search tables"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="shrink-0 text-[#5E6654]/60 hover:text-[#34451F]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={shapeFilter === "all"} onClick={() => setShapeFilter("all")}>
              All shapes
            </Chip>
            <Chip active={shapeFilter === "round"} onClick={() => setShapeFilter("round")}>
              <Circle className="h-3 w-3" /> Round
            </Chip>
            <Chip active={shapeFilter === "rect"} onClick={() => setShapeFilter("rect")}>
              <RectangleHorizontal className="h-3 w-3" /> Rectangular
            </Chip>

            <span className="mx-1 h-4 w-px bg-[#D8D5C8]" />

            <Chip active={availFilter === "all"} onClick={() => setAvailFilter("all")}>
              All
            </Chip>
            <Chip
              active={availFilter === "available"}
              onClick={() => setAvailFilter("available")}
            >
              <Check className="h-3 w-3" /> Available
            </Chip>
            <Chip
              active={availFilter === "unavailable"}
              onClick={() => setAvailFilter("unavailable")}
            >
              <X className="h-3 w-3" /> Unavailable
            </Chip>

            {anyFilterActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto font-black text-[10px] tracking-wide text-[#34451F] uppercase underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {initialTables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <LayoutDashboard className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="font-black text-sm text-[#20231A]">No tables yet</p>
          <p className="mt-1 text-[11px] text-[#5E6654]">
            Add your first table to get started
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8D5C8] py-14 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-[#5E6654] opacity-30" />
          <p className="font-black text-sm text-[#20231A]">No matching tables</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 font-black text-[11px] tracking-wide text-[#34451F] uppercase underline underline-offset-2"
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
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#D8D5C8] bg-white px-4 py-2.5 transition-all hover:border-[#34451F]/30 hover:shadow-sm active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F1E8] text-[#34451F]">
                {table.shape === "rect" ? (
                  <RectangleHorizontal className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded-md border border-[#D8D5C8] bg-[#F4F1E8] px-1.5 py-0.5 font-black text-[10px] text-[#5E6654] tabular-nums">
                    #{table.id}
                  </span>
                  <p className="truncate font-black text-[#20231A]">{table.name}</p>
                </div>
                {table.description && (
                  <p className="mt-0.5 truncate text-[11px] font-medium text-[#5E6654]">
                    {table.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <InfoBadge icon={<Users className="h-3 w-3" />}>
                  {table.max_capacity}
                </InfoBadge>
                <InfoBadge
                  className="hidden sm:inline-flex"
                  icon={
                    table.shape === "rect" ? (
                      <RectangleHorizontal className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )
                  }
                >
                  {table.shape === "rect" ? "Rectangular" : "Round"}
                </InfoBadge>
                <InfoBadge
                  className="hidden md:inline-flex"
                  icon={<Armchair className="h-3 w-3" />}
                >
                  {chairBadge(table)}
                </InfoBadge>
              </div>

              <StatusPill available={table.available} />

              <ChevronRight className="h-4 w-4 shrink-0 text-[#5E6654] opacity-40" />
            </div>
          ))}
        </div>
      )}

      <Sheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[85vh] flex-col rounded-t-[2.5rem] border-t-2 border-[#D8D5C8]
            bg-[#F4F1E8] p-0 shadow-2xl outline-none
            sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:h-auto
            sm:max-h-[80vh] sm:w-140 sm:-translate-x-1/2 sm:rounded-4xl
            sm:border-2 sm:border-[#D8D5C8]"
        >
          <div className="sticky top-0 z-30 shrink-0 border-b border-[#D8D5C8] bg-white/80 p-4 pb-3 backdrop-blur-md sm:rounded-t-4xl">
            <SheetTitle className="truncate font-black text-xl leading-tight tracking-tighter text-[#20231A] uppercase">
              {isAdding ? "New Table" : isEditing ? "Edit Table" : (selected?.name ?? "")}
            </SheetTitle>
            {selected && !isAdding && (
              <div className="mt-1 flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-[#5E6654]" />
                <span className="font-black text-xs tracking-wide text-[#5E6654] uppercase tabular-nums">
                  ID: {selected.id}
                </span>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 py-5">

            {!showForm && selected && (
              <div className="animate-in duration-200 fade-in sm:flex sm:flex-col sm:items-center">
                <div className="w-full space-y-4 sm:max-w-sm">
                  <div className="overflow-hidden rounded-3xl border-2 border-[#D8D5C8] bg-white">
                    <DetailRow label="Table Name" value={selected.name} />
                    <DetailRow
                      label="Max Capacity"
                      value={`${selected.max_capacity} guests`}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <DetailRow
                      label="Available"
                      value={selected.available ? "Yes - bookable" : "No - hidden"}
                      valueClassName={selected.available ? "text-green-700" : "text-red-600"}
                      icon={
                        selected.available ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )
                      }
                    />
                    <DetailRow
                      label="Shape"
                      value={selected.shape === "rect" ? "Rectangular" : "Round"}
                      icon={selected.shape === "rect"
                        ? <RectangleHorizontal className="h-4 w-4" />
                        : <Circle className="h-4 w-4" />}
                    />
                    <DetailRow
                      label="Size"
                      value={sizeText(selected)}
                      icon={<Ruler className="h-4 w-4" />}
                    />
                    {selected.shape === "rect" && (
                      <DetailRow
                        label="Chair Arrangement"
                        value={chairSummaryFull(selected)}
                        icon={<Armchair className="h-4 w-4" />}
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

            {showForm && (
              <form
                id="table-form"
                action={handleSubmit}
                className="flex animate-in flex-col gap-3 duration-200 fade-in"
              >
                {formDefault && (
                  <input type="hidden" name="id" value={formDefault.id} />
                )}

                <Section
                  title="Details"
                  open={openSections.details}
                  onToggle={() => toggleSection("details")}
                >
                  <div className="space-y-2">
                    <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                      Table Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      name="name"
                      placeholder="e.g. Window Booth 1"
                      defaultValue={formDefault?.name ?? ""}
                      required
                      className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-base font-bold transition-all focus:border-[#34451F] sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                      Location / Notes
                    </Label>
                    <Input
                      name="description"
                      placeholder="e.g. Near the fireplace, quiet corner..."
                      defaultValue={formDefault?.description ?? ""}
                      className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
                    />
                  </div>
                </Section>

                <Section
                  title="Capacity & Availability"
                  open={openSections.capacity}
                  onToggle={() => toggleSection("capacity")}
                >
                  <div className="space-y-2">
                    <Label className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase">
                      Max Capacity <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex h-14 items-center overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white transition-all focus-within:border-[#34451F]">
                      <div className="flex h-full shrink-0 items-center justify-center border-r-2 border-[#D8D5C8] px-4">
                        <Users className="h-4 w-4 text-[#5E6654]" />
                      </div>
                      <input
                        name="capacity"
                        type="number"
                        min={1}
                        placeholder="4"
                        required
                        defaultValue={formDefault?.max_capacity ?? ""}
                        aria-label="Max capacity"
                        className="h-full flex-1 bg-transparent px-3 text-sm font-bold text-[#20231A] outline-none placeholder:text-[#5E6654]/40"
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
                    <span>
                      <span className="block font-black text-sm text-[#20231A]">
                        Available for booking
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[#5E6654]">
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
                      <span className="block h-6 w-11 rounded-full bg-[#D8D5C8] transition-colors peer-checked:bg-green-500" />
                      <span className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                    </span>
                  </label>
                </Section>

                <Section
                  title="Shape & Size"
                  open={openSections.shape}
                  onToggle={() => toggleSection("shape")}
                >
                  <div className="space-y-2">
                    <Label
                      htmlFor="table-shape"
                      className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                      className="h-14 w-full rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold text-[#20231A] transition-all outline-none focus:border-[#34451F]"
                    >
                      <option value="round">Round</option>
                      <option value="rect">Rectangular</option>
                    </select>
                  </div>

                  {shape === "round" ? (
                    <div className="space-y-2">
                      <Label
                        htmlFor="table-diameter"
                        className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                        className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label
                          htmlFor="table-width"
                          className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                          className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="table-length"
                          className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                          className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
                        />
                      </div>
                    </div>
                  )}
                </Section>

                {shape === "rect" && (
                  <Section
                    title="Chair Arrangement"
                    open={openSections.chairs}
                    onToggle={() => toggleSection("chairs")}
                  >
                    <div className="space-y-2">
                      <Label
                        htmlFor="table-chair-mode"
                        className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                        className="h-14 w-full rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold text-[#20231A] transition-all outline-none focus:border-[#34451F]"
                      >
                        <option value="auto">Auto - spread around the table</option>
                        <option value="sides">Chairs per side</option>
                        <option value="bench">Bench down each long side</option>
                      </select>
                    </div>

                    {chairMode !== "auto" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label
                            htmlFor="table-chair-per-side"
                            className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                            className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
                          />
                        </div>
                        {chairMode === "sides" && (
                          <div className="space-y-2">
                            <Label
                              htmlFor="table-chair-ends"
                              className="ml-1 font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
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
                              className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white px-4 text-sm font-bold transition-all focus:border-[#34451F]"
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

          <div className="z-40 shrink-0 border-t-2 border-[#D8D5C8] bg-white/80 p-5 pb-10 backdrop-blur-md sm:rounded-b-4xl sm:pb-5">

            {!showForm && selected && (
              <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-sm">
                <Button
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-widest text-red-500 uppercase"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Trash2 className="mr-2 h-4 w-4" />Delete</>
                  )}
                </Button>
                <Button
                  onClick={() => { setFormError(null); setShape(selected.shape ?? "round"); setChairMode(selected.chair_layout?.mode ?? "auto"); setIsEditing(true); }}
                  className="h-14 rounded-2xl border border-[#34451F] font-black text-[10px] tracking-widest text-[#34451F] uppercase hover:bg-[#E5EBD8] active:scale-95"
                >
                  <Pencil className="mr-2 h-4 w-4" />Edit
                </Button>
              </div>
            )}

            {showForm && (
              <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-sm">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormError(null);
                    if (isAdding) closeSheet();
                    else setIsEditing(false);
                  }}
                  disabled={isPending}
                  className="h-14 rounded-2xl border-2 border-[#D8D5C8] bg-white font-black text-[10px] tracking-wide text-[#5E6654] uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="table-form"
                  disabled={isPending}
                  className="h-14 rounded-2xl bg-[#34451F] font-black text-[10px] tracking-widest text-white uppercase shadow-lg hover:bg-[#283719] active:scale-95"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Save</>
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
        "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 font-black text-[10px] tracking-wide uppercase transition-colors sm:h-9",
        active
          ? "border-[#34451F] bg-[#34451F] text-white"
          : "border-[#D8D5C8] bg-white text-[#5E6654] hover:border-[#34451F]/30"
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
        "inline-flex items-center gap-1 rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2 py-1 font-black text-[10px] whitespace-nowrap text-[#5E6654]",
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
        "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 font-black text-[9px] tracking-wide uppercase",
        available
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-600"
      )}
    >
      {available ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
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
    <div className="overflow-hidden rounded-2xl border-2 border-[#D8D5C8] bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-[#F4F1E8] px-5 py-3"
      >
        <span className="font-black text-[10px] tracking-wide text-[#34451F] uppercase">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[#5E6654] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      <div className={cn("space-y-4 p-4", !open && "hidden")}>{children}</div>
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
    <div className="flex items-center gap-3 border-b border-[#D8D5C8] px-5 py-3.5 last:border-0">
      <div className="flex shrink-0 items-center gap-2 text-[#5E6654] opacity-60">
        {icon}
        <span className="font-black text-[10px] tracking-wide whitespace-nowrap uppercase">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "flex-1 text-right font-black text-sm leading-snug text-[#20231A]",
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
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug font-bold text-red-700">{message}</p>
    </div>
  );
}


function sizeText(t: Table): string {
  if (t.shape === "rect") {
    return t.width && t.length ? `${t.width} × ${t.length} m` : "Not set";
  }
  return t.diameter ? `${t.diameter} m ⌀` : "Not set";
}

function chairBadge(t: Table): string {
  if (t.shape !== "rect") return "Auto";
  const cl = t.chair_layout;
  if (!cl || cl.mode === "auto") return "Auto";
  if (cl.mode === "bench") return "Bench";
  return `${cl.perSide ?? 0} per side`;
}

function chairSummaryFull(t: Table): string {
  if (t.shape !== "rect") return "Auto";
  const cl = t.chair_layout;
  if (!cl || cl.mode === "auto") return "Auto - spread evenly";
  if (cl.mode === "bench") return `Bench · ${cl.perSide ?? 0} per side`;
  return `${cl.perSide ?? 0} per side${cl.ends ? ` · ${cl.ends} per end` : ""}`;
}
