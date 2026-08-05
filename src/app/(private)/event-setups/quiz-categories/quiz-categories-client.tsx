"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Check,
  X,
  SearchX,
  Music,
  Hash,
  ImageIcon,
  ArrowUpDown,
} from "lucide-react";
import {
  saveQuizCategoryAction,
  deleteQuizCategoryAction,
  QuizCategoryConfig,
} from "./actions";
import { cn } from "@/lib/utils";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
} from "@/components/admin";

export type EmployeeOption = { id: number; full_name: string };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const CHECKBOX = "h-5 w-5 cursor-pointer rounded accent-admin-primary";

function roundLabel(config: QuizCategoryConfig): string {
  return `${config.question_count} Q · ${config.points_per_question} pt`;
}

export default function QuizCategoriesClient({
  initialConfigs = [],
  employees = [],
}: {
  initialConfigs: QuizCategoryConfig[];
  employees?: EmployeeOption[];
}) {
  const sheet = useRecordSheet<QuizCategoryConfig>({
    records: initialConfigs,
    getId: (record) => record.id ?? -1,
  });
  const { selected, mode } = sheet;
  const [query, setQuery] = useState("");

  const employeeName = (id?: number | null) =>
    employees.find((employee) => employee.id === id)?.full_name ?? "-";

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return initialConfigs;
    return initialConfigs.filter((config) =>
      [config.category_name, config.short_name, `round ${config.order_no}`].some((field) =>
        field?.toLowerCase().includes(needle),
      ),
    );
  }, [initialConfigs, query]);

  const showForm = mode === "add" || mode === "edit";
  const formDefault = mode === "edit" ? selected : null;

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const handleDelete = () => {
    if (!selected?.id) return;
    sheet.confirmDelete({
      title: "Delete category",
      description: "Delete this quiz category? This cannot be undone.",
      action: () => deleteQuizCategoryAction(selected.id as number),
    });
  };

  const title =
    mode === "add"
      ? "New category"
      : mode === "edit"
        ? "Edit category"
        : "View category";

  return (
    <div className="mx-auto w-full space-y-3 px-2 py-3 sm:space-y-4 sm:px-4 sm:py-0 md:px-6">
      {initialConfigs.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No categories yet"
          description="Add your first quiz category to get started"
          action={
            <button
              type="button"
              onClick={sheet.openAdd}
              className="inline-flex h-9 items-center rounded-lg bg-admin-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create category
            </button>
          }
        />
      ) : (
        <RecordList
          variant="panel"
          title="Quiz categories"
          count={shown.length}
          onAdd={sheet.openAdd}
          toolbar={
            <ListSearchInput
              value={query}
              onChange={setQuery}
              label="Search quiz categories"
              placeholder="Search by name, short name or round"
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
            shown.map((config) => {
              const inactive = !config.is_active;
              return (
                <ListRow
                  key={config.id}
                  onClick={() => sheet.openView(config)}
                  status={
                    <StatusPill
                      tone={config.is_active ? "success" : "error"}
                      icon={
                        config.is_active ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )
                      }
                      className="sm:w-24 sm:justify-center"
                    >
                      {config.is_active ? "Active" : "Inactive"}
                    </StatusPill>
                  }
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-admin-line bg-admin-surface text-[11px] font-semibold tabular-nums",
                      inactive ? "text-admin-muted" : "text-admin-primary",
                    )}
                    title={`Round ${config.order_no}`}
                  >
                    {config.order_no}
                  </span>

                  {/* Fixed tracks rather than content-sized ones, so the counts of
                      every row line up down the list. */}
                  <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_8rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p
                        className={cn(
                          "min-w-0 truncate text-sm leading-snug font-semibold",
                          inactive ? "text-admin-muted" : "text-admin-ink",
                        )}
                      >
                        {config.category_name}
                      </p>
                    </div>

                    <p className="mt-0.5 truncate text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                      Round {config.order_no}
                    </p>

                    <p className="hidden text-[12px] font-medium text-admin-muted tabular-nums sm:block">
                      {roundLabel(config)}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-0">
                      <span className="text-[11px] font-medium text-admin-muted tabular-nums sm:hidden">
                        {roundLabel(config)}
                      </span>
                      {config.short_name && (
                        <InfoBadge icon={null}>{config.short_name}</InfoBadge>
                      )}
                      {config.include_spotify && (
                        <InfoBadge icon={<Music className="h-3 w-3" />}>
                          <span className="hidden sm:inline">Spotify</span>
                        </InfoBadge>
                      )}
                      {config.is_higher_lower && (
                        <InfoBadge icon={<ArrowUpDown className="h-3 w-3" />}>
                          <span className="hidden sm:inline">Higher/Lower</span>
                        </InfoBadge>
                      )}
                      {config.is_picture && (
                        <InfoBadge icon={<ImageIcon className="h-3 w-3" />}>
                          <span className="hidden sm:inline">Picture</span>
                        </InfoBadge>
                      )}
                    </div>
                  </div>
                </ListRow>
              );
            })
          )}
        </RecordList>
      )}

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={title}
        recordId={selected?.id}
        formId="category-form"
        isPending={sheet.isPending}
        onEdit={sheet.startEdit}
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
              {selected.is_active ? "Active" : "Inactive"}
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
              <DetailCell dense label="Category" value={selected.category_name} />
              <DetailCell dense label="Short name" value={selected.short_name || "-"} />
              <DetailCell dense label="Round order" value={String(selected.order_no)} />
              <DetailCell dense label="Questions" value={String(selected.question_count)} />
              <DetailCell
                dense
                label="Points / Q"
                value={String(selected.points_per_question)}
              />
              <DetailCell
                dense
                label="Spotify"
                value={selected.include_spotify ? "Yes" : "No"}
              />
              <DetailCell
                dense
                label="Higher / Lower"
                value={selected.is_higher_lower ? "Yes" : "No"}
              />
              <DetailCell
                dense
                label="Picture round"
                value={selected.is_picture ? "Yes" : "No"}
              />
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="category-form"
            action={sheet.submit(saveQuizCategoryAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault?.id && (
              <input type="hidden" name="id" value={formDefault.id} />
            )}

            <DetailCard className="divide-y divide-admin-line/50">
              <FormRow label="Name" required>
                <input
                  name="category_name"
                  required
                  aria-label="Category name"
                  placeholder="e.g. Movies"
                  defaultValue={formDefault?.category_name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow label="Short name">
                <input
                  name="short_name"
                  aria-label="Short name"
                  placeholder="e.g. MOV"
                  maxLength={5}
                  defaultValue={formDefault?.short_name ?? ""}
                  className={cn(FIELD_INPUT, "uppercase")}
                />
              </FormRow>

              <FormRow label="Round order" required>
                <input
                  name="order_no"
                  type="number"
                  min="1"
                  required
                  aria-label="Round order"
                  defaultValue={formDefault?.order_no ?? ""}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>

              <FormRow label="Questions">
                <input
                  name="question_count"
                  type="number"
                  min="1"
                  max="50"
                  aria-label="Questions"
                  defaultValue={formDefault?.question_count ?? 10}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>

              <FormRow label="Points / Q">
                <input
                  name="points_per_question"
                  type="number"
                  min="1"
                  aria-label="Points per question"
                  defaultValue={formDefault?.points_per_question ?? 1}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>

              <FormRow label="Spotify">
                <span className="flex-1" />
                <input
                  id="include_spotify"
                  name="include_spotify"
                  type="checkbox"
                  aria-label="Include Spotify"
                  defaultChecked={formDefault?.include_spotify ?? false}
                  className={CHECKBOX}
                />
              </FormRow>

              <FormRow label="Higher / Lower">
                <span className="flex-1" />
                <input
                  id="is_higher_lower"
                  name="is_higher_lower"
                  type="checkbox"
                  aria-label="Higher / Lower round"
                  defaultChecked={formDefault?.is_higher_lower ?? false}
                  className={CHECKBOX}
                />
              </FormRow>

              <FormRow label="Picture round">
                <span className="flex-1" />
                <input
                  id="is_picture"
                  name="is_picture"
                  type="checkbox"
                  aria-label="Picture round"
                  defaultChecked={formDefault?.is_picture ?? false}
                  className={CHECKBOX}
                />
              </FormRow>

              <FormRow label="Active">
                <span className="flex-1" />
                <input
                  id="is_active"
                  name="is_active"
                  type="checkbox"
                  aria-label="Active"
                  defaultChecked={formDefault?.is_active ?? true}
                  className={CHECKBOX}
                />
              </FormRow>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>
    </div>
  );
}
