"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Search,
  SearchX,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useRecordSheet,
  RecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  InfoBadge,
  StatusPill,
  DetailCard,
  DetailCell,
  FormRow,
  ErrorBox,
  formatRecordDate as formatDate,
} from "@/components/admin";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { AI_AREAS } from "@/lib/ai/areas";
import { resolveBaseUrl } from "@/lib/ai/endpoints";
import { findModel, modelsForKind, sortNewestFirst } from "@/lib/ai/model-catalog";
import { AI_PROVIDERS, isAiProviderId, providersCovering } from "@/lib/ai/providers/registry";
import type {
  AiCapability,
  AiKind,
  AiModel,
  AiModelListResult,
  AiProviderId,
} from "@/lib/ai/providers/types";
import {
  endpointKey,
  type AiSettings,
  type AiSettingsRow,
  type AreaChoice,
  type StoredStamp,
} from "@/lib/ai/settings-shape";
import { resetAiSettingsAction, saveAiAreaAction, saveAiProvidersAction } from "./actions";

type Employee = { id: number; full_name: string | null };

type AreaRecord = {
  key: string;
  label: string;
  description: string;
  kind: AiKind;
  needs: AiCapability[];
  provider: string;
  model: string;
  overrideUrl: string | null;
  baseUrl: string;
  active: boolean;
  providerFallback: boolean;
  defaultProvider: AiProviderId | null;
  defaultModel: string | null;
  stamp: StoredStamp | null;
};

const FIELD_SELECT =
  "min-w-0 max-w-full cursor-pointer appearance-none bg-transparent text-right text-sm font-semibold text-admin-ink outline-none [text-align-last:right]";
const FIELD_URL_INPUT =
  "min-w-0 flex-1 bg-transparent text-right font-mono text-[12px] font-semibold text-admin-ink outline-none placeholder:text-admin-muted/40";
const URL_INPUT =
  "h-9 w-full rounded-lg border border-admin-line bg-white px-3 font-mono text-[12px] text-admin-ink outline-none placeholder:text-admin-muted/60 focus:border-admin-primary";
const NOT_LISTED = " (not listed by the provider)";
const KIND_LABELS: Record<AiKind, string> = { text: "Text", image: "Image" };

function providerLabel(id: string): string {
  return AI_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

function KindIcon({ kind, className }: { kind: AiKind; className?: string }) {
  const Icon = kind === "image" ? ImageIcon : Type;
  return <Icon className={className} aria-hidden="true" />;
}

function ActivePill({ active, showLabelOnMobile }: { active: boolean; showLabelOnMobile?: boolean }) {
  return (
    <StatusPill
      tone={active ? "success" : "error"}
      icon={active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      showLabelOnMobile={showLabelOnMobile}
      className={showLabelOnMobile ? undefined : "sm:w-24 sm:justify-center"}
    >
      {active ? "Active" : "Inactive"}
    </StatusPill>
  );
}

export default function AiSettingsClient({
  row,
  settings,
  catalogues,
  keyStatus,
  employees,
}: {
  row: AiSettingsRow;
  settings: AiSettings;
  catalogues: Record<string, AiModelListResult>;
  keyStatus: Record<AiProviderId, boolean>;
  employees: Employee[];
}) {
  const { confirm, ConfirmDialogUI } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");

  const [providerUrls, setProviderUrls] = useState<Record<AiProviderId, string>>(() =>
    Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, settings.providers[p.id].overrideUrl ?? ""])) as Record<AiProviderId, string>
  );

  const records = useMemo<AreaRecord[]>(() => {
    const active = AI_AREAS.map((area): AreaRecord => {
      const resolved = settings.areas[area.key];
      return {
        key: area.key,
        label: area.label,
        description: area.description,
        kind: area.kind,
        needs: area.needs,
        provider: resolved.provider,
        model: resolved.model,
        overrideUrl: resolved.overrideUrl,
        baseUrl: resolved.baseUrl,
        active: true,
        providerFallback: resolved.providerFallback,
        defaultProvider: area.defaultProvider,
        defaultModel: area.defaultModel,
        stamp: resolved.stamp,
      };
    });
    const retired = Object.entries(settings.retiredAreas).map(([key, entry]): AreaRecord => {
      const providerUrl = isAiProviderId(entry.provider) ? settings.providers[entry.provider].baseUrl : "";
      return {
        key,
        label: entry.label,
        description: "",
        kind: entry.kind,
        needs: [],
        provider: entry.provider,
        model: entry.model,
        overrideUrl: entry.api_base_url,
        baseUrl: entry.api_base_url ?? providerUrl,
        active: false,
        providerFallback: false,
        defaultProvider: null,
        defaultModel: null,
        stamp: entry,
      };
    });
    return [...active, ...retired];
  }, [settings]);

  const sheet = useRecordSheet<AreaRecord>({ records, getId: (record) => record.key });
  const { selected, mode } = sheet;
  const [draft, setDraft] = useState<AreaChoice>({ provider: "gemini", model: "", overrideUrl: null });

  const employeeById = useMemo(
    () => new Map(employees.map((e) => [e.id, e.full_name ?? "-"] as const)),
    [employees],
  );
  const employeeName = (id?: number | null) => (id ? (employeeById.get(id) ?? "-") : "-");

  const sortedCatalogues = useMemo(() => {
    const out: Record<string, AiModel[]> = {};
    for (const [key, result] of Object.entries(catalogues)) {
      if ("models" in result) out[key] = sortNewestFirst(result.models);
    }
    return out;
  }, [catalogues]);

  const catalogueFor = (provider: string, baseUrl: string) =>
    isAiProviderId(provider) ? sortedCatalogues[endpointKey({ provider, baseUrl })] : undefined;

  const isListed = (record: AreaRecord) => {
    const catalogue = catalogueFor(record.provider, record.baseUrl);
    return catalogue ? !!findModel(modelsForKind(catalogue, record.kind), record.model) : true;
  };

  const draftBaseUrl = (choice: AreaChoice) =>
    resolveBaseUrl(choice.overrideUrl, settings.providers[choice.provider].overrideUrl, settings.providers[choice.provider].defaultBaseUrl);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      [record.label, record.description, record.kind, providerLabel(record.provider), record.model].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [records, query]);

  const showForm = mode === "edit" && !!selected;

  const startEdit = () => {
    if (!selected) return;
    setDraft({
      provider: isAiProviderId(selected.provider) ? selected.provider : (selected.defaultProvider ?? "gemini"),
      model: selected.model,
      overrideUrl: selected.overrideUrl,
    });
    sheet.startEdit();
  };

  const cancel = () => {
    if (selected) sheet.openView(selected);
  };

  const handleProvidersSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setProvidersError(null);
    startTransition(async () => {
      const result = await saveAiProvidersAction(formData);
      if (result.error) {
        setProvidersError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Provider settings saved");
    });
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Reset AI settings?",
      description:
        "Every area goes back to its built-in provider and model, and every custom API base URL is cleared.",
      confirmLabel: "Reset to defaults",
      variant: "destructive",
    });
    if (!ok) return;
    setProvidersError(null);
    startTransition(async () => {
      const result = await resetAiSettingsAction();
      if (result.error) {
        setProvidersError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("AI settings reset to defaults");
    });
  };

  const retiredProviders = Object.entries(settings.retiredProviders);
  const modelNeedle = modelQuery.trim().toLowerCase();

  const title = mode === "edit" ? "Edit AI area" : "View AI area";

  const editArea = showForm ? AI_AREAS.find((area) => area.key === selected.key) : undefined;
  const editEndpointUrl = draftBaseUrl(draft);
  const editCatalogue = catalogueFor(draft.provider, editEndpointUrl);
  const editFetched = isAiProviderId(draft.provider)
    ? catalogues[endpointKey({ provider: draft.provider, baseUrl: editEndpointUrl })]
    : undefined;
  const editModels = editCatalogue && editArea ? modelsForKind(editCatalogue, editArea.kind) : [];
  const editListed = editCatalogue ? !!findModel(editModels, draft.model) : true;
  const editOptions = editListed
    ? editModels
    : [{ id: draft.model, displayName: draft.model + NOT_LISTED } as AiModel, ...editModels];

  return (
    <div className="mx-auto w-full space-y-4 px-2 py-3 sm:space-y-5 sm:px-4 sm:py-0 md:px-6">
      <div className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-admin-ink">
          <Sparkles className="h-5 w-5 text-admin-primary" />
          AI settings
        </h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          Which provider and model each part of the app asks, and where it sends the request. The
          model lists come from each provider as the page loads, so they are always current.
        </p>
      </div>

      <form id="ai-providers-form" onSubmit={handleProvidersSubmit} className="space-y-4 sm:space-y-5">
        <DetailCard>
          <div className="border-b border-admin-line bg-admin-surface px-4 py-2.5 sm:px-5">
            <p className="text-sm font-semibold text-admin-ink">Providers</p>
            <p className="text-[11px] text-admin-muted">
              Keys live in the server environment and are never shown here. Leave the URL blank to
              use the provider&apos;s built-in endpoint.
            </p>
          </div>
          {AI_PROVIDERS.map((provider) => {
            const resolved = settings.providers[provider.id];
            const catalogue = catalogues[endpointKey({ provider: provider.id, baseUrl: resolved.baseUrl })];
            return (
              <div key={provider.id} className="border-b border-admin-line px-4 py-3 last:border-0 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-admin-ink">{provider.label}</p>
                  <span className="flex items-center gap-1.5">
                    <StatusPill tone={keyStatus[provider.id] ? "success" : "error"} showLabelOnMobile>
                      {keyStatus[provider.id] ? "API key set" : "API key missing"}
                    </StatusPill>
                    <InfoBadge icon={null}>{provider.capabilities.join(" · ")}</InfoBadge>
                  </span>
                </div>
                <label className="mt-2 block">
                  <span className="text-[11px] font-semibold tracking-wide text-admin-muted">API base URL</span>
                  <input
                    name={`provider_url_${provider.id}`}
                    value={providerUrls[provider.id]}
                    onChange={(e) => setProviderUrls((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                    placeholder={provider.defaultBaseUrl}
                    className={cn(URL_INPUT, "mt-1")}
                  />
                </label>
                <p className="mt-1.5 text-[11px] text-admin-muted">
                  The app adds the provider&apos;s own path for each call, for example{" "}
                  <span className="font-mono">/models/&#123;model&#125;:generateContent</span> on Gemini.
                  {resolved.stamp && ` Updated ${formatDate(resolved.stamp.updated_at)} by ${employeeName(resolved.stamp.updated_by)}.`}
                </p>
                {catalogue && "error" in catalogue && (
                  <div className="mt-2">
                    <ErrorBox message={catalogue.error} />
                  </div>
                )}
              </div>
            );
          })}
          {retiredProviders.map(([id, entry]) => (
            <div key={id} className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-line px-4 py-3 opacity-70 last:border-0 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-admin-ink">{entry.label}</p>
                <p className="text-[11px] text-admin-muted">
                  Removed from the code {formatDate(entry.updated_at)}.
                </p>
              </div>
              <StatusPill tone="neutral" showLabelOnMobile>Inactive</StatusPill>
            </div>
          ))}
        </DetailCard>

        {providersError && <ErrorBox message={providersError} />}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex h-11 items-center rounded-2xl border border-admin-line bg-admin-card px-4 text-[13px] font-semibold text-admin-muted transition-colors hover:bg-admin-surface disabled:opacity-50"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset to defaults
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center rounded-2xl bg-admin-primary px-5 text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-hover disabled:opacity-50"
          >
            <Save className="mr-1.5 h-4 w-4" />
            {isPending ? "Saving…" : "Save providers"}
          </button>
        </div>
      </form>

      <RecordList
        variant="panel"
        title="Model by area"
        count={shown.length}
        toolbar={
          <ListSearchInput
            value={query}
            onChange={setQuery}
            label="Search AI areas"
            placeholder="Search by area, provider or model"
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
          shown.map((record) => {
            const inactive = !record.active;
            return (
              <ListRow
                key={record.key}
                onClick={() => sheet.openView(record)}
                selected={selected?.key === record.key}
                status={<ActivePill active={record.active} />}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-admin-line bg-admin-surface",
                    inactive ? "text-admin-muted" : "text-admin-primary",
                  )}
                  title={KIND_LABELS[record.kind]}
                >
                  <KindIcon kind={record.kind} className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1.4fr)_5rem_9rem_minmax(0,1.4fr)] sm:items-center sm:gap-3">
                  <p
                    className={cn(
                      "min-w-0 truncate text-sm leading-snug font-semibold",
                      inactive ? "text-admin-muted" : "text-admin-ink",
                    )}
                  >
                    {record.label}
                  </p>

                  <div className="hidden sm:block">
                    <InfoBadge icon={<KindIcon kind={record.kind} className="h-3 w-3" />}>
                      {KIND_LABELS[record.kind]}
                    </InfoBadge>
                  </div>

                  <p className="hidden truncate text-[12px] font-medium text-admin-muted sm:block">
                    {providerLabel(record.provider)}
                  </p>

                  <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-admin-muted sm:mt-0 sm:text-[12px]">
                    <span className="font-sans sm:hidden">{providerLabel(record.provider)} · </span>
                    {record.model}
                  </p>
                </div>
              </ListRow>
            );
          })
        )}
      </RecordList>

      <RecordSheet
        open={sheet.open}
        onClose={sheet.close}
        mode={mode}
        title={title}
        formId="ai-area-form"
        isPending={sheet.isPending}
        onEdit={selected?.active ? startEdit : undefined}
        onCancel={cancel}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <>
              <ActivePill active={selected.active} showLabelOnMobile />
              <InfoBadge icon={<KindIcon kind={selected.kind} className="h-3 w-3" />}>
                {KIND_LABELS[selected.kind]}
              </InfoBadge>
              {selected.providerFallback && (
                <StatusPill tone="warning" showLabelOnMobile>Provider unavailable - using default</StatusPill>
              )}
              {selected.active && !isListed(selected) && (
                <StatusPill tone="warning" showLabelOnMobile>
                  Model not listed by {providerLabel(selected.provider)}
                </StatusPill>
              )}
            </>
          )
        }
        systemInfo={
          selected == null
            ? undefined
            : {
                rows: [{ label: "Key", value: <span className="font-mono">{selected.key}</span> }],
                createdAt: selected.stamp?.created_at,
                createdBy: employeeName(selected.stamp?.created_by),
                updatedAt: selected.stamp?.updated_at,
                updatedBy: employeeName(selected.stamp?.updated_by),
              }
        }
      >
        {!showForm && selected && (
          <div className="animate-in space-y-4 duration-200 fade-in sm:space-y-5">
            <DetailCard>
              <DetailCell dense label="Name" value={selected.label} />
              <DetailCell dense label="Kind" value={KIND_LABELS[selected.kind]} />
              <DetailCell
                dense
                label="Needs"
                value={selected.needs.length ? selected.needs.join(", ") : "-"}
              />
              <DetailCell label="What it does" multiline value={selected.description || "-"} />
            </DetailCard>

            <DetailCard>
              <DetailCell dense label="Provider" value={providerLabel(selected.provider)} />
              <DetailCell
                dense
                label="Model"
                value={<span className="font-mono text-[12px]">{selected.model}</span>}
              />
              <DetailCell
                dense
                label="API base URL"
                value={
                  selected.overrideUrl ? (
                    <span className="font-mono text-[12px] break-all">{selected.overrideUrl}</span>
                  ) : (
                    "Provider default"
                  )
                }
              />
              <DetailCell
                dense
                label="Endpoint in use"
                value={<span className="font-mono text-[12px] break-all">{selected.baseUrl || "-"}</span>}
              />
              {selected.defaultProvider && selected.defaultModel && (
                <DetailCell
                  dense
                  label="Built-in default"
                  value={
                    <>
                      {providerLabel(selected.defaultProvider)} ·{" "}
                      <span className="font-mono text-[12px]">{selected.defaultModel}</span>
                    </>
                  }
                />
              )}
            </DetailCard>

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </div>
        )}

        {showForm && editArea && (
          <form
            id="ai-area-form"
            action={sheet.submit(saveAiAreaAction)}
            className="animate-in space-y-4 duration-200 fade-in sm:space-y-5"
          >
            <input type="hidden" name="key" value={selected.key} />

            <DetailCard>
              <DetailCell dense label="Name" value={selected.label} />
              <DetailCell dense label="Kind" value={KIND_LABELS[selected.kind]} />
              <DetailCell
                dense
                label="Needs"
                value={selected.needs.length ? selected.needs.join(", ") : "-"}
              />
              <DetailCell label="What it does" multiline value={selected.description || "-"} />
            </DetailCard>

            <DetailCard>
              <FormRow dense label="Provider">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <select
                    name="provider"
                    aria-label="Provider"
                    value={draft.provider}
                    onChange={(e) => {
                      const provider = e.target.value as AiProviderId;
                      const next = { ...draft, provider };
                      const first = modelsForKind(catalogueFor(provider, draftBaseUrl(next)) ?? [], editArea.kind)[0];
                      setDraft({
                        ...next,
                        model: provider === editArea.defaultProvider ? editArea.defaultModel : (first?.id ?? draft.model),
                      });
                    }}
                    className={FIELD_SELECT}
                  >
                    {providersCovering(editArea.needs).map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-admin-muted" />
                </div>
              </FormRow>

              <FormRow dense label="Model">
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <select
                    name="model"
                    aria-label="Model"
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    className={FIELD_SELECT}
                  >
                    {editOptions.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName === model.id ? model.id : `${model.displayName} · ${model.id}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none h-3.5 w-3.5 shrink-0 text-admin-muted" />
                </div>
              </FormRow>

              <FormRow dense label="API base URL">
                <input
                  name="base_url"
                  aria-label="API base URL for this area only"
                  value={draft.overrideUrl ?? ""}
                  onChange={(e) => setDraft({ ...draft, overrideUrl: e.target.value || null })}
                  placeholder={resolveBaseUrl(null, settings.providers[draft.provider].overrideUrl, settings.providers[draft.provider].defaultBaseUrl)}
                  className={FIELD_URL_INPUT}
                />
              </FormRow>

              <DetailCell
                dense
                label="Endpoint in use"
                value={<span className="font-mono text-[12px] break-all">{editEndpointUrl}</span>}
              />
            </DetailCard>

            {!editCatalogue && (
              <p className="text-[11px] text-admin-muted">
                {editFetched && "error" in editFetched
                  ? `Models could not be listed from this endpoint: ${editFetched.error}`
                  : "Save to load the model list from this endpoint."}
              </p>
            )}

            {sheet.formError && <ErrorBox message={sheet.formError} />}
          </form>
        )}
      </RecordSheet>

      {Object.entries(sortedCatalogues).map(([key, models]) => {
        const [providerId, baseUrl] = key.split("|");
        const shownModels = modelNeedle
          ? models.filter((m) =>
              [m.id, m.displayName, m.description].some((field) => field.toLowerCase().includes(modelNeedle))
            )
          : models;
        return (
          <RecordList
            key={key}
            variant="panel"
            title={`Models on offer from ${providerLabel(providerId)}`}
            count={shownModels.length}
            subtitle={<span className="font-mono">{baseUrl}</span>}
            toolbar={
              <ListSearchInput
                value={modelQuery}
                onChange={setModelQuery}
                label="Search models"
                placeholder="Search by name or description"
              />
            }
          >
            {shownModels.length === 0 ? (
              <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                <Search className="mb-1 h-6 w-6 text-admin-muted opacity-30" />
                <p className="text-sm font-semibold text-admin-ink">No models match</p>
              </div>
            ) : (
              shownModels.map((model) => (
                <div
                  key={model.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-admin-line px-4 py-3 last:border-0 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-admin-ink">{model.displayName}</p>
                    <p className="font-mono text-[11px] text-admin-primary">{model.id}</p>
                    {model.description && (
                      <p className="mt-0.5 text-[12px] leading-snug text-admin-muted">{model.description}</p>
                    )}
                  </div>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <InfoBadge icon={null}>{model.kinds.includes("image") ? "Image" : "Text"}</InfoBadge>
                    {model.inputTokenLimit != null && (
                      <InfoBadge icon={null}>In {model.inputTokenLimit.toLocaleString()}</InfoBadge>
                    )}
                    {model.outputTokenLimit != null && (
                      <InfoBadge icon={null}>Out {model.outputTokenLimit.toLocaleString()}</InfoBadge>
                    )}
                  </span>
                </div>
              ))
            )}
          </RecordList>
        );
      })}

      <p className="text-[11px] text-admin-muted">
        Settings row last saved {formatDate(row.updated_at)} by {employeeName(row.updated_by)}.
      </p>

      {ConfirmDialogUI}
    </div>
  );
}
