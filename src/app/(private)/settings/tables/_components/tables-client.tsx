"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Users,
  ChevronDown,
  LayoutDashboard,
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
import type { ChairLayout } from "@/lib/floor-plan/types";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  FilterChip,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  ErrorBox,
} from "@/components/admin";

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
  const sheet = useRecordSheet<Table>();
  const { selected, mode } = sheet;
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

  const openAdd = () => {
    setShape("round");
    setChairMode("auto");
    sheet.openAdd();
  };

  const startEdit = () => {
    if (selected) {
      setShape(selected.shape ?? "round");
      setChairMode(selected.chair_layout?.mode ?? "auto");
    }
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Delete table",
      description:
        "Delete this table? This cannot be undone if it has booking history.",
      action: () => deleteTableAction(selected.id),
    });
  };

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const title =
    mode === "add"
      ? "New table"
      : mode === "edit"
        ? "Edit table"
        : (selected?.name ?? "");

  const detailPanel = (
  <RecordSheet
    open={sheet.open}
    onClose={sheet.close}
    mode={mode}
    title={title}
    recordId={selected?.id}
    formId="table-form"
    isPending={sheet.isPending}
    onEdit={startEdit}
    onDelete={handleDelete}
    onCancel={cancel}
    confirmUI={sheet.ConfirmDialogUI}
    layout="split"
    emptyState={
      <>
        <LayoutDashboard className="mb-3 h-8 w-8 text-admin-muted opacity-30" />
        <p className="text-sm font-semibold text-admin-ink">No table selected</p>
        <p className="mt-1 text-[11px] text-admin-muted">
          Pick a table from the list to see its details here.
        </p>
      </>
    }
  >
    {!showForm && selected && (
      <div className="animate-in duration-200 fade-in">
        <DetailCard>
          <DetailCell label="Table name" value={selected.name} />
          <DetailCell
            label="Max capacity"
            value={`${selected.max_capacity} guests`}
            icon={<Users className="h-4 w-4" />}
          />
          <DetailCell
            label="Available"
            value={selected.available ? "Yes - bookable" : "No - hidden"}
            valueClassName={
              selected.available ? "text-admin-success" : "text-admin-error"
            }
            icon={
              selected.available ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )
            }
          />
          <DetailCell
            label="Shape"
            value={selected.shape === "rect" ? "Rectangular" : "Round"}
            icon={
              selected.shape === "rect" ? (
                <RectangleHorizontal className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )
            }
          />
          <DetailCell
            label="Size"
            value={sizeText(selected)}
            icon={<Ruler className="h-4 w-4" />}
          />
          {selected.shape === "rect" && (
            <DetailCell
              label="Chair arrangement"
              value={chairSummaryFull(selected)}
              icon={<Armchair className="h-4 w-4" />}
            />
          )}
          {selected.description && (
            <DetailCell label="Location / notes" value={selected.description} />
          )}
        </DetailCard>

        {sheet.formError && (
          <div className="mt-4">
            <ErrorBox message={sheet.formError} />
          </div>
        )}
      </div>
    )}

    {showForm && (
      <form
        id="table-form"
        action={sheet.submit(saveTableAction)}
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
            <Label className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted">
              Table name <span className="text-admin-error">*</span>
            </Label>
            <Input
              name="name"
              placeholder="e.g. Window Booth 1"
              defaultValue={formDefault?.name ?? ""}
              required
              className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-base font-semibold transition-all focus:border-admin-primary sm:text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted">
              Location / notes
            </Label>
            <Input
              name="description"
              placeholder="e.g. Near the fireplace, quiet corner..."
              defaultValue={formDefault?.description ?? ""}
              className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
            />
          </div>
        </Section>

        <Section
          title="Capacity & availability"
          open={openSections.capacity}
          onToggle={() => toggleSection("capacity")}
        >
          <div className="space-y-2">
            <Label className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted">
              Max capacity <span className="text-admin-error">*</span>
            </Label>
            <div className="flex h-14 items-center overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card transition-all focus-within:border-admin-primary">
              <div className="flex h-full shrink-0 items-center justify-center border-r-2 border-admin-line px-4">
                <Users className="h-4 w-4 text-admin-muted" />
              </div>
              <input
                name="capacity"
                type="number"
                min={1}
                placeholder="4"
                required
                defaultValue={formDefault?.max_capacity ?? ""}
                aria-label="Max capacity"
                className="h-full flex-1 bg-transparent px-3 text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
            <span>
              <span className="block text-sm font-semibold text-admin-ink">
                Available for booking
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-admin-muted">
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
              <span className="block h-6 w-11 rounded-full bg-admin-line transition-colors peer-checked:bg-admin-success" />
              <span className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </Section>

        <Section
          title="Shape & size"
          open={openSections.shape}
          onToggle={() => toggleSection("shape")}
        >
          <div className="space-y-2">
            <Label
              htmlFor="table-shape"
              className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
            >
              Shape <span className="text-admin-error">*</span>
            </Label>
            <select
              id="table-shape"
              name="shape"
              title="Table shape"
              aria-label="Table shape"
              value={shape}
              onChange={(e) => setShape(e.target.value as "round" | "rect")}
              className="h-14 w-full rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold text-admin-ink transition-all outline-none focus:border-admin-primary"
            >
              <option value="round">Round</option>
              <option value="rect">Rectangular</option>
            </select>
          </div>

          {shape === "round" ? (
            <div className="space-y-2">
              <Label
                htmlFor="table-diameter"
                className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
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
                className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label
                  htmlFor="table-width"
                  className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
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
                  className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="table-length"
                  className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
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
                  className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
                />
              </div>
            </div>
          )}
        </Section>

        {shape === "rect" && (
          <Section
            title="Chair arrangement"
            open={openSections.chairs}
            onToggle={() => toggleSection("chairs")}
          >
            <div className="space-y-2">
              <Label
                htmlFor="table-chair-mode"
                className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
              >
                Arrangement
              </Label>
              <select
                id="table-chair-mode"
                name="chair_mode"
                title="Chair arrangement"
                aria-label="Chair arrangement"
                value={chairMode}
                onChange={(e) =>
                  setChairMode(e.target.value as "auto" | "sides" | "bench")
                }
                className="h-14 w-full rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold text-admin-ink transition-all outline-none focus:border-admin-primary"
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
                    className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
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
                    className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
                  />
                </div>
                {chairMode === "sides" && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="table-chair-ends"
                      className="ml-1 text-[11px] font-semibold tracking-wide text-admin-muted"
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
                      className="h-14 rounded-2xl border-2 border-admin-line bg-admin-card px-4 text-sm font-semibold transition-all focus:border-admin-primary"
                    />
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {sheet.formError && <ErrorBox message={sheet.formError} />}
      </form>
    )}
  </RecordSheet>
  );

  return (
    <div className="max-w-4xl space-y-4 px-4 pt-0 pb-4 sm:py-0 md:px-6 xl:h-full xl:max-w-none xl:space-y-0 xl:overflow-hidden">
      <div className="space-y-4 xl:h-full xl:min-h-0">
      {initialTables.length === 0 ? (
        <EmptyState
          icon={LayoutDashboard}
          title="No tables yet"
          description="Add your first table to get started"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="text-[11px] font-semibold tracking-wide text-admin-primary underline underline-offset-2"
            >
              Add your first table
            </button>
          }
        />
      ) : null}
      {initialTables.length === 0 && detailPanel}
      {initialTables.length > 0 && (
        <RecordList
          variant="cards"
          onAdd={openAdd}
          addLabel="Add table"
          countLabel={
            <>
              {initialTables.length} table
              {initialTables.length !== 1 ? "s" : ""}
              {anyFilterActive && (
                <span className="text-admin-primary"> · {filtered.length} shown</span>
              )}
            </>
          }
          detail={detailPanel}
          activeFilterCount={
            (shapeFilter !== "all" ? 1 : 0) + (availFilter !== "all" ? 1 : 0)
          }
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search by table name, ID or location..."
              label="Search tables"
            />
          }
          filters={
            <div className="flex flex-wrap items-center gap-1.5">
                <FilterChip
                  active={shapeFilter === "all"}
                  onClick={() => setShapeFilter("all")}
                >
                  All shapes
                </FilterChip>
                <FilterChip
                  active={shapeFilter === "round"}
                  onClick={() => setShapeFilter("round")}
                >
                  <Circle className="h-3 w-3" /> Round
                </FilterChip>
                <FilterChip
                  active={shapeFilter === "rect"}
                  onClick={() => setShapeFilter("rect")}
                >
                  <RectangleHorizontal className="h-3 w-3" /> Rectangular
                </FilterChip>

                <span className="mx-1 h-4 w-px bg-admin-line" />

                <FilterChip
                  active={availFilter === "all"}
                  onClick={() => setAvailFilter("all")}
                >
                  All
                </FilterChip>
                <FilterChip
                  active={availFilter === "available"}
                  onClick={() => setAvailFilter("available")}
                >
                  <Check className="h-3 w-3" /> Available
                </FilterChip>
                <FilterChip
                  active={availFilter === "unavailable"}
                  onClick={() => setAvailFilter("unavailable")}
                >
                  <X className="h-3 w-3" /> Unavailable
                </FilterChip>

                {anyFilterActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-auto text-[11px] font-semibold tracking-wide text-admin-primary underline underline-offset-2"
                  >
                    Clear
                  </button>
                )}
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching tables"
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-semibold tracking-wide text-admin-primary underline underline-offset-2"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((table) => (
                <ListRow
                  key={table.id}
                  variant="card"
                  onClick={() => sheet.openView(table)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-admin-surface text-admin-primary">
                    {table.shape === "rect" ? (
                      <RectangleHorizontal className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-admin-ink">
                      {table.name}
                    </p>
                    {table.description && (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted">
                        {table.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <InfoBadge
                      className="min-w-14 justify-start"
                      icon={<Users className="h-3 w-3" />}
                    >
                      {table.max_capacity}
                    </InfoBadge>
                  </div>

                  <StatusPill
                    className="min-w-28 justify-center"
                    tone={table.available ? "success" : "error"}
                    icon={
                      table.available ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )
                    }
                  >
                    {table.available ? "Available" : "Unavailable"}
                  </StatusPill>
                </ListRow>
              ))}
            </div>
          )}
        </RecordList>
      )}
      </div>
    </div>
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
    <div className="overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-admin-line px-5 py-3"
      >
        <span className="text-[11px] font-semibold tracking-wide text-admin-primary">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-admin-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <div className={cn("space-y-4 p-4", !open && "hidden")}>{children}</div>
    </div>
  );
}

function sizeText(t: Table): string {
  if (t.shape === "rect") {
    return t.width && t.length ? `${t.width} × ${t.length} m` : "Not set";
  }
  return t.diameter ? `${t.diameter} m ⌀` : "Not set";
}

function chairSummaryFull(t: Table): string {
  if (t.shape !== "rect") return "Auto";
  const cl = t.chair_layout;
  if (!cl || cl.mode === "auto") return "Auto - spread evenly";
  if (cl.mode === "bench") return `Bench · ${cl.perSide ?? 0} per side`;
  return `${cl.perSide ?? 0} per side${cl.ends ? ` · ${cl.ends} per end` : ""}`;
}
