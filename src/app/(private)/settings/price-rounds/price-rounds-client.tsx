"use client";

import { useMemo, useState } from "react";
import { Plus, Scale, SearchX, Check, X } from "lucide-react";
import { SERVES } from "@/lib/menu-price";
import { cn } from "@/lib/utils";
import { savePriceRoundAction, deletePriceRoundAction } from "./actions";
import {
  planSave,
  planDelete,
  describeChanges,
  nextPosition,
  type ChangeDescription,
  type OrderRow,
} from "@/lib/merchandise-order";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

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

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const FIELD_SELECT =
  "flex-1 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none";

function servesOf(round: PriceRound | null | undefined): string[] {
  if (!round?.serves) return [];
  return round.serves
    .split(",")
    .map((serve) => serve.trim())
    .filter(Boolean);
}

function servesLabel(round: PriceRound): string {
  const serves = servesOf(round);
  return serves.length > 0 ? serves.join(", ") : "-";
}

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-admin-line overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      {changes.map((change) => (
        <li key={change.id} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-admin-ink">
            {change.name}
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-admin-muted tabular-nums">
            {change.from} → {change.to}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PriceRoundsClient({
  initialRounds = [],
  employees = [],
}: {
  initialRounds: PriceRound[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<PriceRound>({
    records: initialRounds,
    getId: (record) => record.id,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [position, setPosition] = useState(1);

  const orderRows: OrderRow[] = useMemo(
    () =>
      initialRounds.map((round) => ({
        id: round.id,
        name: round.label,
        display_order: round.display_order,
        is_active: round.is_active,
      })),
    [initialRounds],
  );

  const activeCount = orderRows.filter((row) => row.is_active).length;

  const employeeById = new Map(employees.map((e) => [e.id, e.full_name ?? "-"] as const));
  const employeeName = (id?: number | null) => (id ? (employeeById.get(id) ?? "-") : "-");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialRounds;
    return initialRounds.filter((round) =>
      [round.label, round.key, servesLabel(round)].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [initialRounds, query]);

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;
  const defaultServes = formDefault ? servesOf(formDefault) : ["each"];
  const wasActive = formDefault?.is_active ?? false;
  const canChoosePosition = !!formDefault && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: formDefault?.id ?? null,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const loadForm = (record: PriceRound | null) => {
    setIsActive(record?.is_active ?? true);
    setPosition(record?.display_order || nextPosition(orderRows));
  };

  const openAdd = () => {
    loadForm(null);
    sheet.openAdd();
  };

  const startEdit = () => {
    loadForm(selected);
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const reorderPrompt = (label: string) => {
    if (wasActive && !isActive) {
      return `Switching "${label}" off will move it to position 0 and update:`;
    }
    if (!wasActive && isActive) {
      return `Switching "${label}" on will place it at position ${plan.position} and update:`;
    }
    return `Moving "${label}" to position ${plan.position} will also update:`;
  };

  // Submitted by hand rather than as a form action, so the reorder warning can be
  // answered before anything is written.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submit = sheet.submit(savePriceRoundAction);

    if (affected.length === 0) {
      submit(formData);
      return;
    }

    const ok = await sheet.confirm({
      title: "Reorder price rounds",
      description: reorderPrompt(formData.get("label")?.toString().trim() || "this round"),
      content: <ChangeList changes={affected} />,
      confirmLabel: "Update order",
    });
    if (ok) submit(formData);
  };

  const handleDelete = () => {
    if (!selected) return;
    const cascade = describeChanges(orderRows, planDelete(orderRows, selected.id));
    sheet.confirmDelete({
      title: "Delete round",
      description:
        cascade.length > 0
          ? `"${selected.label}" will stop being compared. Menu items pointed at it fall back to matching by name. These positions will shift up:`
          : `"${selected.label}" will stop being compared. Menu items pointed at it fall back to matching by name.`,
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
      action: () => deletePriceRoundAction(selected.id),
    });
  };

  const title =
    mode === "add" ? "New round" : mode === "edit" ? "Edit round" : "View round";

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialRounds.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No rounds yet"
          description="Add a round to start comparing prices against it"
          action={
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create round
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Price rounds"
          count={shown.length}
          onAdd={openAdd}
          addLabel="Round"
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search price rounds"
              placeholder="Search by label, key or serve"
            />
          }
        >
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <SearchX className="mb-1 h-7 w-7 text-admin-muted opacity-30" />
              <p className="text-sm font-semibold text-admin-ink">No matches</p>
              <p className="text-[11px] text-admin-muted">
                Nothing here matches &ldquo;{query.trim()}&rdquo;
              </p>
            </div>
          ) : (
            shown.map((round) => (
              <ListRow
                key={round.id}
                onClick={() => sheet.openView(round)}
                status={
                  <StatusPill
                    tone={round.is_active ? "success" : "error"}
                    icon={
                      round.is_active ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )
                    }
                    className="sm:w-24 sm:justify-center"
                  >
                    {round.is_active ? "Active" : "Off"}
                  </StatusPill>
                }
              >
                <span
                  className="w-6 shrink-0 text-center text-xs font-semibold text-admin-muted tabular-nums opacity-60"
                  title={
                    round.is_active
                      ? `Position ${round.display_order}`
                      : "Rounds that are off have no position"
                  }
                >
                  {round.is_active ? round.display_order : "-"}
                </span>

                {/* Fixed tracks rather than content-sized ones, so the key of
                    every row starts in the same place. */}
                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] sm:items-center sm:gap-3">
                  <p
                    className={cn(
                      "min-w-0 truncate text-sm leading-snug font-semibold",
                      round.is_active ? "text-admin-ink" : "text-admin-muted",
                    )}
                  >
                    {round.label}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                    {round.key}
                  </p>

                  <p
                    className="hidden truncate text-[11px] font-medium text-admin-muted sm:block"
                    title={`Priced off ${servesLabel(round)}`}
                  >
                    Priced off {servesLabel(round)}
                  </p>
                </div>
              </ListRow>
            ))
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="round-form"
        isPending={sheet.isPending}
        onEdit={startEdit}
        onDelete={handleDelete}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <StatusPill
              tone={selected.is_active ? "success" : "error"}
              icon={
                selected.is_active ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )
              }
              showLabelOnMobile
            >
              {selected.is_active ? "Active" : "Off"}
            </StatusPill>
          )
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                createdAt: selected.created_at,
                createdBy: employeeName(selected.created_by),
                updatedAt: selected.updated_at,
                updatedBy: employeeName(selected.updated_by),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell dense label="Label" value={selected.label} />
              <DetailCell
                dense
                label="Key"
                value={selected.key}
                valueClassName="font-mono"
              />
              <DetailCell dense label="Priced off" value={servesLabel(selected)} />
              <DetailCell
                dense
                label="Position"
                value={selected.is_active ? String(selected.display_order) : "0 (off)"}
              />
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="round-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault && <input type="hidden" name="id" value={formDefault.id} />}

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Label" required>
                <input
                  name="label"
                  required
                  aria-label="Label"
                  placeholder="e.g. Pint (Cider)"
                  defaultValue={formDefault?.label ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Key" required>
                <input
                  name="key"
                  required
                  aria-label="Key"
                  placeholder="e.g. pint_cider"
                  defaultValue={formDefault?.key ?? ""}
                  className={cn(FIELD_INPUT, "font-mono")}
                />
              </FormRow>

              <FormRow label="Status">
                <select
                  name="is_active"
                  aria-label="Status"
                  value={isActive ? "true" : "false"}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  className={FIELD_SELECT}
                >
                  <option value="true">Active</option>
                  <option value="false">Off</option>
                </select>
              </FormRow>

              <FormRow label="Position">
                {canChoosePosition ? (
                  <input
                    name="display_order"
                    type="number"
                    min={1}
                    max={activeCount}
                    inputMode="numeric"
                    aria-label="Position on the price page"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className={cn(FIELD_INPUT, "tabular-nums")}
                  />
                ) : (
                  <input
                    name="display_order"
                    type="number"
                    readOnly
                    aria-label="Position on the price page"
                    value={plan.position}
                    className="flex-1 cursor-not-allowed bg-transparent text-right text-sm font-semibold text-admin-muted opacity-60 outline-none tabular-nums"
                  />
                )}
              </FormRow>

              <div className="px-4 pt-0 pb-3 sm:px-5">
                <p className="text-[11px] font-medium text-admin-muted opacity-70">
                  {!isActive
                    ? "Rounds that are off have no position and are left out of the comparison."
                    : canChoosePosition
                      ? `Positions run 1 to ${activeCount}. Changing this reorders the others.`
                      : "New rounds are added to the end of the list."}
                </p>
              </div>

              <div className="px-4 py-3 sm:px-5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    Priced off
                  </span>
                  <span className="text-[11px] font-semibold text-admin-error">*</span>
                </div>
                <p className="mb-2.5 text-[11px] leading-snug font-medium text-admin-muted opacity-70">
                  Only items sold in one of these measures can price this round.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SERVES.map((serve) => (
                    <label key={serve} className="relative cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="serves"
                        value={serve}
                        defaultChecked={defaultServes.includes(serve)}
                        className="peer sr-only"
                      />
                      <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-admin-line bg-admin-surface px-3 text-[11px] font-semibold tracking-wide text-admin-muted transition-colors peer-checked:border-admin-primary peer-checked:bg-admin-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-admin-primary">
                        {serve}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}
