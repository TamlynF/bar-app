"use client";

import { useMemo, useRef, useState } from "react";
import {
  Plus,
  Check,
  ChevronDown,
  X,
  SearchX,
  Music,
  Hash,
  ImageIcon,
  ArrowUpDown,
  FileText,
  RotateCcw,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  saveQuizCategoryAction,
  deleteQuizCategoryAction,
  QuizCategoryConfig,
} from "./actions";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PROMPTS,
  PROMPT_KIND_LABELS,
  PROMPT_TOKENS,
  normalisePrompt,
  promptKindFor,
  resolvePrompt,
  type PromptKind,
} from "@/lib/quiz/prompt-templates";
import {
  ROUND_TYPES,
  ROUND_TYPE_LABELS,
  roundTypeFlags,
  roundTypeFor,
  type RoundType,
} from "@/lib/quiz/round-kind";
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
  InfoBadge,
  StatusPill,
  EmptyState,
  DetailCard,
  DetailCell,
  FormRow,
  FormToggle,
  ErrorBox,
} from "@/components/admin";

export type EmployeeOption = { id: number; full_name: string };

const FIELD_INPUT =
  "flex-1 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const FIELD_SELECT =
  "min-w-0 cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none [text-align-last:right]";
const YEAR_INPUT =
  "w-12 bg-transparent text-right text-sm font-semibold text-admin-ink outline-none tabular-nums";
const PROMPT_TEXT = "font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap";
const TWO_COLUMNS = "grid gap-4 sm:grid-cols-2 sm:items-start sm:gap-5";

function roundLabel(config: QuizCategoryConfig): string {
  return `${config.question_count} Q · ${config.points_per_question} pt`;
}

function configPromptKind(config: QuizCategoryConfig): PromptKind {
  return promptKindFor({
    isPicture: config.is_picture,
    includeSpotify: config.include_spotify,
    isHigherLower: config.is_higher_lower,
  });
}

/* The wording being typed, and the round type it was written for. The type is
   fixed when the text first stops being blank, so flipping a checkbox later
   can warn that the prompt no longer matches rather than silently replacing
   what was typed. */
type PromptDraft = { text: string; kind: PromptKind };

const BLANK_DRAFT: PromptDraft = { text: "", kind: "question" };

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
  const [isActive, setIsActive] = useState(true);
  const [roundType, setRoundType] = useState<RoundType>("default");
  const [position, setPosition] = useState(1);
  const [promptDraft, setPromptDraft] = useState<PromptDraft>(BLANK_DRAFT);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const promptKindForType = (type: RoundType) => {
    const flags = roundTypeFlags(type);
    return promptKindFor({
      isPicture: flags.is_picture,
      includeSpotify: flags.include_spotify,
      isHigherLower: flags.is_higher_lower,
    });
  };
  const formKind = promptKindForType(roundType);
  const draftIsBlank = normalisePrompt(promptDraft.text) === "";
  const draftIsBuiltIn =
    draftIsBlank ||
    normalisePrompt(promptDraft.text) === normalisePrompt(DEFAULT_PROMPTS[promptDraft.kind]);
  const draftKindMismatch = !draftIsBuiltIn && promptDraft.kind !== formKind;

  const updatePromptDraft = (text: string) =>
    setPromptDraft((prev) => ({
      text,
      kind: normalisePrompt(prev.text) === "" ? formKind : prev.kind,
    }));

  // An untouched built-in prompt follows the round type; a customised one is
  // kept, and the mismatch warning says so.
  const changeRoundType = (type: RoundType) => {
    setRoundType(type);
    if (draftIsBuiltIn) {
      const kind = promptKindForType(type);
      setPromptDraft({ text: DEFAULT_PROMPTS[kind], kind });
    }
  };

  const resetToBuiltInPrompt = async () => {
    if (!draftIsBuiltIn) {
      const ok = await sheet.confirm({
        title: "Discard your changes to this prompt?",
        description: `The prompt box goes back to the built-in ${PROMPT_KIND_LABELS[formKind].toLowerCase()} prompt, and what is there now will be lost.`,
        confirmLabel: "Reset to built-in",
        variant: "destructive",
      });
      if (!ok) return;
    }
    setPromptDraft({ text: DEFAULT_PROMPTS[formKind], kind: formKind });
    promptRef.current?.focus();
  };

  const insertPromptToken = (token: string) => {
    const el = promptRef.current;
    const start = el?.selectionStart ?? promptDraft.text.length;
    const end = el?.selectionEnd ?? start;
    const snippet = `{{${token}}}`;
    updatePromptDraft(promptDraft.text.slice(0, start) + snippet + promptDraft.text.slice(end));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

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
  const selectedKind = selected ? configPromptKind(selected) : "question";
  const selectedPrompt = resolvePrompt(selectedKind, selected?.ai_prompt);

  // Rounds run 1..N across the active categories; an inactive one has no round
  // and sits at 0. The number is worked out from that rather than typed in.
  const orderRows: OrderRow[] = initialConfigs.map((config) => ({
    id: config.id ?? 0,
    name: config.category_name,
    display_order: config.order_no,
    is_active: config.is_active,
  }));
  const activeCount = orderRows.filter((row) => row.is_active).length;
  const wasActive = formDefault?.is_active ?? false;
  const canChoosePosition = !!formDefault && wasActive && isActive;

  const plan = planSave(orderRows, {
    id: formDefault?.id ?? null,
    isActive,
    targetPosition: canChoosePosition ? position : null,
  });
  const affected = describeChanges(orderRows, plan.changes);

  const orderChanged = canChoosePosition && position !== formDefault.order_no;
  const deactivating = wasActive && !isActive;
  const showReorderWarning = orderChanged || deactivating;

  // The planner only reports the other rows that shift; the category being
  // edited is added here so the confirmation shows its own move as well.
  const ownChange: ChangeDescription | null =
    formDefault?.id != null && formDefault.order_no !== plan.position
      ? {
          id: formDefault.id,
          name: formDefault.category_name,
          from: formDefault.order_no,
          to: plan.position,
        }
      : null;
  const changeList = ownChange ? [ownChange, ...affected] : affected;

  const openAdd = () => {
    setIsActive(true);
    setRoundType("default");
    setPromptDraft({ text: DEFAULT_PROMPTS.question, kind: "question" });
    setPosition(nextPosition(orderRows));
    sheet.openAdd();
  };

  const startEdit = () => {
    if (!selected) return;
    setIsActive(selected.is_active);
    setRoundType(roundTypeFor(selected));
    const kind = configPromptKind(selected);
    setPromptDraft({ text: resolvePrompt(kind, selected.ai_prompt).template, kind });
    setPosition(selected.order_no || nextPosition(orderRows));
    sheet.startEdit();
  };

  const cancel = () => {
    if (mode === "add") sheet.close();
    else if (selected) sheet.openView(selected);
  };

  const reorderPrompt = (name: string) => {
    if (wasActive && !isActive) {
      return `Making "${name}" inactive moves it to round 0. These round orders will change:`;
    }
    if (!wasActive && isActive) {
      return `Making "${name}" active places it at round ${plan.position}. These round orders will change:`;
    }
    return `Moving "${name}" to round ${plan.position} changes these round orders:`;
  };

  // Submitted by hand rather than as a form action, so the rounds that shift
  // can be shown and agreed to before anything is written.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submit = sheet.submit(saveQuizCategoryAction);

    if (changeList.length === 0) {
      submit(formData);
      return;
    }

    const ok = await sheet.confirm({
      title: "Round orders will change",
      description: reorderPrompt(
        formData.get("category_name")?.toString().trim() || "this category",
      ),
      content: <ChangeList changes={changeList} />,
      confirmLabel: "Save and update rounds",
    });
    if (ok) submit(formData);
  };

  const handleDelete = () => {
    if (!selected?.id) return;
    const cascade = describeChanges(orderRows, planDelete(orderRows, selected.id));
    sheet.confirmDelete({
      title: "Delete category",
      description:
        cascade.length > 0
          ? "Delete this quiz category? This cannot be undone. These rounds will shift up:"
          : "Delete this quiz category? This cannot be undone.",
      content: cascade.length > 0 ? <ChangeList changes={cascade} /> : undefined,
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
              onClick={openAdd}
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
          onAdd={openAdd}
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
                      {resolvePrompt(configPromptKind(config), config.ai_prompt).isCustomised && (
                        <InfoBadge icon={<FileText className="h-3 w-3" />}>
                          <span className="hidden sm:inline">Custom prompt</span>
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
            <div className={TWO_COLUMNS}>
              <DetailCard>
                <DetailCell
                  dense
                  label="Round order"
                  value={selected.is_active ? String(selected.order_no) : "0 (inactive)"}
                />
                <DetailCell dense label="Name" value={selected.category_name} />
                <DetailCell dense label="Short name" value={selected.short_name || "-"} />
              </DetailCard>

              <DetailCard>
                <DetailCell dense label="Questions" value={String(selected.question_count)} />
                <DetailCell
                  dense
                  label="Points / Q"
                  value={String(selected.points_per_question)}
                />
                <DetailCell
                  dense
                  label="Round type"
                  value={ROUND_TYPE_LABELS[roundTypeFor(selected)]}
                />
                {roundTypeFor(selected) === "spotify" && (
                  <DetailCell
                    dense
                    label="Order songs by"
                    value={selected.number_by_release_year ? "Release year" : "Order added"}
                  />
                )}
                {roundTypeFor(selected) === "higher_lower" && (
                  <DetailCell
                    dense
                    label="Years apart"
                    value={`${selected.min_years} to ${selected.max_years}`}
                  />
                )}
              </DetailCard>
            </div>

            <DetailCard>
              <div className="flex items-center justify-between gap-3 border-b border-admin-line px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    AI prompt
                  </p>
                  <p className="truncate text-sm font-semibold text-admin-ink">
                    {PROMPT_KIND_LABELS[selectedKind]}
                  </p>
                </div>
                <StatusPill tone={selectedPrompt.isCustomised ? "info" : "neutral"} showLabelOnMobile>
                  {selectedPrompt.isCustomised ? "Customised" : "Built-in"}
                </StatusPill>
              </div>
              <pre className={cn(PROMPT_TEXT, "max-h-96 overflow-y-auto px-4 py-3 text-admin-ink sm:px-5")}>
                {selectedPrompt.template}
              </pre>
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && (
          <form
            id="category-form"
            onSubmit={handleSubmit}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            {formDefault?.id && (
              <input type="hidden" name="id" value={formDefault.id} />
            )}

            <div className={TWO_COLUMNS}>
            <DetailCard>
              <FormRow dense label="Round order">
                {canChoosePosition ? (
                  <input
                    name="order_no"
                    type="number"
                    min={1}
                    max={activeCount}
                    inputMode="numeric"
                    aria-label="Round order"
                    value={position}
                    onChange={(e) => setPosition(Number(e.target.value))}
                    className={cn(FIELD_INPUT, "tabular-nums")}
                  />
                ) : (
                  <input
                    name="order_no"
                    type="number"
                    readOnly
                    aria-label="Round order"
                    value={plan.position}
                    className="flex-1 cursor-not-allowed bg-transparent text-right text-sm font-semibold text-admin-muted opacity-60 outline-none tabular-nums"
                  />
                )}
              </FormRow>

              <FormRow dense label="Name" required>
                <input
                  name="category_name"
                  required
                  aria-label="Category name"
                  placeholder="e.g. Movies"
                  defaultValue={formDefault?.category_name ?? ""}
                  className={FIELD_INPUT}
                />
              </FormRow>

              <FormRow dense label="Short name">
                <input
                  name="short_name"
                  aria-label="Short name"
                  placeholder="e.g. MOV"
                  maxLength={5}
                  defaultValue={formDefault?.short_name ?? ""}
                  className={cn(FIELD_INPUT, "uppercase")}
                />
              </FormRow>

              <FormRow dense label="Active">
                <span className="flex-1" />
                <input type="hidden" name="is_active" value={isActive ? "on" : ""} />
                <FormToggle
                  label="Active"
                  on={isActive}
                  onToggle={() => setIsActive((o) => !o)}
                />
              </FormRow>

              {showReorderWarning && (
                <div className="flex items-start gap-2 px-4 pt-0 pb-3 sm:px-5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-admin-warning" />
                  <p className="text-[11px] font-semibold leading-snug text-admin-warning">
                    The round order of other active categories may be updated to keep the
                    sequence. You will see the changes before they are saved.
                  </p>
                </div>
              )}
            </DetailCard>

            <DetailCard>
              <FormRow dense label="Questions">
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

              <FormRow dense label="Points / Q">
                <input
                  name="points_per_question"
                  type="number"
                  min="1"
                  aria-label="Points per question"
                  defaultValue={formDefault?.points_per_question ?? 1}
                  className={cn(FIELD_INPUT, "tabular-nums")}
                />
              </FormRow>

              <FormRow dense label="Round type">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <select
                    id="round_type"
                    name="round_type"
                    aria-label="Round type"
                    value={roundType}
                    onChange={(e) => changeRoundType(e.target.value as RoundType)}
                    className={FIELD_SELECT}
                  >
                    {ROUND_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ROUND_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-admin-muted" />
                </div>
              </FormRow>

              {roundType === "spotify" && (
                <FormRow dense label="Order songs by">
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                    <select
                      id="number_by_release_year"
                      name="number_by_release_year"
                      aria-label="How the songs in this round are ordered"
                      defaultValue={
                        (formDefault?.number_by_release_year ?? true) ? "year" : "added"
                      }
                      className={FIELD_SELECT}
                    >
                      <option value="year">Release year</option>
                      <option value="added">Order added</option>
                    </select>
                    <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-admin-muted" />
                  </div>
                </FormRow>
              )}

              {roundType === "higher_lower" && (
                <FormRow dense label="Years apart">
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <input
                      name="min_years"
                      type="number"
                      min="1"
                      aria-label="Minimum years between a song and the year it is compared against"
                      defaultValue={formDefault?.min_years ?? 3}
                      className={YEAR_INPUT}
                    />
                    <span className="text-[11px] font-semibold text-admin-muted">to</span>
                    <input
                      name="max_years"
                      type="number"
                      min="1"
                      aria-label="Maximum years between a song and the year it is compared against"
                      defaultValue={formDefault?.max_years ?? 10}
                      className={YEAR_INPUT}
                    />
                  </div>
                </FormRow>
              )}
            </DetailCard>
            </div>

            <DetailCard>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-line px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-admin-muted opacity-70">
                    AI prompt
                  </p>
                  <p className="truncate text-sm font-semibold text-admin-ink">
                    {PROMPT_KIND_LABELS[formKind]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetToBuiltInPrompt}
                  disabled={draftIsBuiltIn && !draftIsBlank}
                  className="inline-flex h-9 items-center rounded-lg border border-admin-line bg-admin-card px-3 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-admin-card disabled:hover:text-admin-muted"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset to built-in prompt
                </button>
              </div>

              <div className="space-y-2 px-4 py-3 sm:px-5">
                <textarea
                  ref={promptRef}
                  name="ai_prompt"
                  aria-label="AI prompt"
                  rows={14}
                  value={promptDraft.text}
                  onChange={(e) => updatePromptDraft(e.target.value)}
                  placeholder="Blank = the built-in prompt for this round type"
                  className={cn(
                    PROMPT_TEXT,
                    "w-full resize-y rounded-xl border border-admin-line bg-white px-3 py-2.5 text-admin-ink outline-none placeholder:text-admin-muted/60 focus:border-admin-primary",
                  )}
                />

                {draftKindMismatch ? (
                  <p className="text-[11px] font-semibold text-admin-warning">
                    Written for a {PROMPT_KIND_LABELS[promptDraft.kind].toLowerCase()} - check it
                    still fits, or reset to the built-in prompt for this round type.
                  </p>
                ) : (
                  <p className="text-[11px] text-admin-muted">
                    {draftIsBuiltIn
                      ? `This is the built-in ${PROMPT_KIND_LABELS[formKind].toLowerCase()} prompt. Edit it to customise what this category asks the model for.`
                      : "Customised for this category and sent to the model every time a round is generated. Reset to go back to the built-in wording."}
                  </p>
                )}

                <div className="rounded-2xl border border-admin-line bg-admin-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
                      Fields the generator fills in
                    </p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Where these fields come from"
                          className="-my-1 flex h-8 w-8 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-card hover:text-admin-ink"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-2 border-admin-line bg-admin-card p-0"
                      >
                        <span className="block border-b border-admin-line bg-admin-surface px-4 py-2.5 text-[12px] font-bold text-admin-primary">
                          Where these fields come from
                        </span>
                        <p className="px-4 pt-3 text-[11px] leading-snug text-admin-muted">
                          The generator swaps each field for a value when a round is created, so the
                          prompt can say things only known at that moment.
                        </p>
                        <ul className="max-h-80 divide-y divide-admin-line/60 overflow-y-auto px-4 pb-2">
                          {PROMPT_TOKENS[formKind].map((field) => (
                            <li key={field.token} className="py-2.5">
                              <p className="font-mono text-[11px] font-semibold text-admin-primary">
                                {`{{${field.token}}}`}
                              </p>
                              <p className="mt-0.5 text-[12px] leading-snug text-admin-ink">
                                {field.source}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <TooltipProvider>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {PROMPT_TOKENS[formKind].map((field) => (
                        <Tooltip key={field.token}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => insertPromptToken(field.token)}
                              className="inline-flex h-8 items-center rounded-lg border border-admin-line bg-admin-card px-2.5 font-mono text-[11px] font-semibold text-admin-primary transition-colors hover:border-admin-primary/40 hover:bg-admin-primary-soft"
                            >
                              {`{{${field.token}}}`}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start" className="space-y-1.5 p-3">
                            <p className="text-[12px] font-semibold leading-snug text-admin-ink">
                              {field.label}
                            </p>
                            <p className="text-[11px] leading-snug text-admin-muted">
                              <span className="font-semibold text-admin-ink">Comes from: </span>
                              {field.source}
                            </p>
                            <p className="text-[11px] leading-snug text-admin-muted">
                              <span className="font-semibold text-admin-ink">Example: </span>
                              <span className="font-mono">{field.sample}</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </TooltipProvider>
                  <p className="mt-2 text-[11px] text-admin-muted">
                    Click a field to add it where the cursor is. Hover one, or tap the info
                    button, to see where it comes from.
                  </p>
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

function ChangeList({ changes }: { changes: ChangeDescription[] }) {
  return (
    <ul className="divide-y divide-admin-line overflow-hidden rounded-2xl border border-admin-line bg-admin-card">
      {changes.map((change) => (
        <li
          key={change.id}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
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
