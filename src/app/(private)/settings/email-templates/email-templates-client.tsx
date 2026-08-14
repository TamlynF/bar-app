"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Mail, MailX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DetailCard,
  DetailCell,
  ErrorBox,
  FormRow,
  RecordSheet,
  useRecordSheet,
  RecordList,
  ListRow,
  ListSearchInput,
  StatusPill,
  EmptyState,
} from "@/components/admin";
import { cn } from "@/lib/utils";
import { EMAIL_SCENARIOS, EMAIL_SCENARIO_GROUPS, isWired } from "@/lib/email/scenarios";
import { mergeOverride, type EmailTemplateRow, type ResolvedTemplate } from "@/lib/email/merge";
import type { SlotKey, TemplateSlots } from "@/lib/email/render";
import { previewHtml, previewSubject } from "@/lib/email/preview";
import {
  saveEmailTemplateAction,
  resetEmailTemplateAction,
  setEmailTemplateActiveAction,
} from "./actions";

type Employee = { id: number; full_name: string | null };

const SLOT_LABELS: Record<SlotKey, string> = {
  subject: "Subject",
  heading: "Header bar",
  eyebrow: "Header sub-line",
  greeting: "Greeting",
  intro: "Opening copy",
  outro: "Closing copy",
  ctaLabel: "Button label",
  footnote: "Small print",
};

const SLOT_HINTS: Partial<Record<SlotKey, string>> = {
  intro: "Leave a blank line between paragraphs. Sits above the details block.",
  outro: "Sits below the details block, before the button.",
  ctaLabel: "The link itself is generated - this is only the wording on the button.",
};

const MULTILINE_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(["intro", "outro", "footnote"]);

const FORM_ID = "email-template-form";

export default function EmailTemplatesClient({
  rows,
  employees,
}: {
  rows: EmailTemplateRow[];
  employees: Employee[];
}) {
  const resolved = useMemo(() => {
    const byKey = new Map(rows.map((row) => [row.scenario_key, row]));
    return EMAIL_SCENARIOS.map((scenario) =>
      mergeOverride(scenario, byKey.get(scenario.key) ?? null)
    );
  }, [rows]);

  const sheet = useRecordSheet<ResolvedTemplate>({
    records: resolved,
    getId: (record) => record.scenario.key,
  });

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<TemplateSlots | null>(null);
  const lastFocused = useRef<SlotKey | null>(null);

  const employeeName = useCallback(
    (id: number | null | undefined) =>
      id == null ? null : (employees.find((e) => e.id === id)?.full_name ?? `#${id}`),
    [employees]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter(
      (r) =>
        r.scenario.label.toLowerCase().includes(q) ||
        r.scenario.description.toLowerCase().includes(q) ||
        r.slots.subject.toLowerCase().includes(q)
    );
  }, [resolved, query]);

  const selected = sheet.selected;

  const openEdit = useCallback(() => {
    if (selected) setDraft({ ...selected.slots });
    sheet.startEdit();
  }, [selected, sheet]);

  const closeSheet = useCallback(() => {
    setDraft(null);
    sheet.close();
  }, [sheet]);

  const handleReset = useCallback(() => {
    if (!selected) return;
    sheet.confirmDelete({
      title: "Reset to the built-in copy?",
      description: `"${selected.scenario.label}" goes back to the wording that ships with the app. This email keeps sending - nothing is switched off.`,
      confirmLabel: "Reset to default",
      action: () => resetEmailTemplateAction(selected.scenario.key),
    });
  }, [selected, sheet]);

  const toggleActive = useCallback(async () => {
    if (!selected) return;
    const next = !selected.isActive;
    const ok = await sheet.confirm({
      title: next ? "Start sending this email again?" : "Stop sending this email?",
      description: next
        ? `"${selected.scenario.label}" will be sent again the next time it is triggered.`
        : `"${selected.scenario.label}" will no longer be sent to anyone. The rest of the flow carries on as normal - only the email stops.`,
      confirmLabel: next ? "Start sending" : "Stop sending",
      variant: next ? undefined : "destructive",
    });
    if (!ok) return;
    const result = await setEmailTemplateActiveAction(selected.scenario.key, next);
    if (result?.error) sheet.setFormError(result.error);
  }, [selected, sheet]);

  const insertToken = useCallback(
    (token: string) => {
      const slot = lastFocused.current;
      if (!slot || !draft) return;
      setDraft({ ...draft, [slot]: `${draft[slot]}{{${token}}}` });
    },
    [draft]
  );

  const editing = sheet.mode === "edit";
  const liveSlots = editing && draft ? draft : selected?.slots ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <h1 className="text-lg font-bold tracking-tight text-admin-ink">Email templates</h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          The wording of every automatic email the venue sends. Editing here changes what
          customers receive - the details block in each email is filled in from the real
          booking and cannot be edited.
        </p>
      </div>

      {sheet.formError && !sheet.open && <ErrorBox message={sheet.formError} />}

      {EMAIL_SCENARIO_GROUPS.map((group) => {
        const items = shown.filter((r) => r.scenario.group === group);
        if (items.length === 0) return null;

        return (
          <RecordList
            key={group}
            variant="panel"
            title={group}
            count={items.length}
            toolbar={
              group === EMAIL_SCENARIO_GROUPS[0] ? (
                <ListSearchInput
                  value={query}
                  onChange={setQuery}
                  label="Search email templates"
                  placeholder="Search by name or subject…"
                />
              ) : undefined
            }
          >
            {items.map((item) => (
              <ListRow
                key={item.scenario.key}
                onClick={() => {
                  setDraft(null);
                  sheet.openView(item);
                }}
                selected={selected?.scenario.key === item.scenario.key}
                status={
                  !isWired(item.scenario.key) ? (
                    <StatusPill tone="neutral">Not connected</StatusPill>
                  ) : !item.isActive ? (
                    <StatusPill tone="warning" icon={<MailX className="h-3 w-3" />}>
                      Off
                    </StatusPill>
                  ) : item.isCustomised ? (
                    <StatusPill tone="info">Customised</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Default</StatusPill>
                  )
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-admin-ink">
                    {item.scenario.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-admin-muted">
                    {item.slots.subject}
                  </p>
                </div>
                <span className="hidden shrink-0 text-[11px] font-semibold tracking-wide text-admin-muted sm:inline">
                  {item.scenario.recipient === "admin" ? "To staff" : "To customer"}
                </span>
              </ListRow>
            ))}
          </RecordList>
        );
      })}

      {shown.length === 0 && (
        <EmptyState
          icon={Mail}
          title="No templates match that search"
          description="Try part of the email's name or its subject line."
        />
      )}

      <RecordSheet
        open={sheet.open}
        onClose={closeSheet}
        mode={sheet.mode}
        title={selected?.scenario.label ?? "Email template"}
        formId={FORM_ID}
        isPending={sheet.isPending}
        onEdit={openEdit}
        onDelete={selected?.isCustomised ? handleReset : undefined}
        onCancel={() => {
          setDraft(null);
          sheet.close();
        }}
        confirmUI={sheet.ConfirmDialogUI}
        status={
          selected && (
            <>
              <StatusPill
                tone={selected.isActive ? "success" : "warning"}
                showLabelOnMobile
              >
                {selected.isActive ? "Sending" : "Not sending"}
              </StatusPill>
              <StatusPill tone={selected.isCustomised ? "info" : "neutral"} showLabelOnMobile>
                {selected.isCustomised ? "Customised" : "Built-in copy"}
              </StatusPill>
              <StatusPill tone="neutral" showLabelOnMobile>
                {selected.scenario.recipient === "admin" ? "To staff" : "To customer"}
              </StatusPill>
            </>
          )
        }
        actions={
          selected && (
            <Button
              type="button"
              variant="outline"
              onClick={toggleActive}
              disabled={sheet.isPending}
              title={selected.isActive ? "Stop sending this email" : "Start sending this email"}
              aria-label={
                selected.isActive ? "Stop sending this email" : "Start sending this email"
              }
              className="h-9 w-9 rounded-lg border border-admin-line bg-admin-card p-0 text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
            >
              {selected.isActive ? <MailX className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </Button>
          )
        }
        systemInfo={
          selected?.row
            ? {
                createdAt: selected.row.created_at,
                createdBy: employeeName(selected.row.created_by),
                updatedAt: selected.row.updated_at,
                updatedBy: employeeName(selected.row.updated_by),
              }
            : undefined
        }
      >
        {selected && (
          <>
            {sheet.formError && <ErrorBox message={sheet.formError} />}

            <p className="text-[13px] leading-snug text-admin-muted">
              {selected.scenario.description}
            </p>

            {!isWired(selected.scenario.key) && (
              <div className="rounded-2xl border border-admin-warning/30 bg-admin-warning-bg p-3">
                <p className="text-[13px] leading-snug font-semibold text-admin-warning">
                  This email is still sent from wording built into the app, so changes here
                  will not reach anyone yet.
                </p>
                <p className="mt-1 text-[11px] leading-snug text-admin-warning">
                  You can edit and preview it now - it will start using your wording once this
                  email is connected up.
                </p>
              </div>
            )}

            {editing && draft ? (
              <form id={FORM_ID} action={sheet.submit(saveEmailTemplateAction)}>
                <input type="hidden" name="scenario_key" value={selected.scenario.key} />

                <DetailCard>
                  {selected.scenario.slots.map((slot) => (
                    <FormRow key={slot} label={SLOT_LABELS[slot]} align="start">
                      <div className="min-w-0 flex-1 space-y-1">
                        {MULTILINE_SLOTS.has(slot) ? (
                          <textarea
                            name={slot}
                            aria-label={SLOT_LABELS[slot]}
                            rows={slot === "intro" ? 5 : 3}
                            value={draft[slot]}
                            onFocus={() => (lastFocused.current = slot)}
                            onChange={(e) => setDraft({ ...draft, [slot]: e.target.value })}
                            className="w-full resize-y rounded-xl border border-admin-line bg-white px-3 py-2.5 text-sm text-admin-ink outline-none focus:border-admin-primary"
                          />
                        ) : (
                          <input
                            name={slot}
                            aria-label={SLOT_LABELS[slot]}
                            value={draft[slot]}
                            onFocus={() => (lastFocused.current = slot)}
                            onChange={(e) => setDraft({ ...draft, [slot]: e.target.value })}
                            className="h-11 w-full rounded-xl border border-admin-line bg-white px-3 text-sm text-admin-ink outline-none focus:border-admin-primary"
                          />
                        )}
                        {SLOT_HINTS[slot] && (
                          <p className="text-[11px] text-admin-muted">{SLOT_HINTS[slot]}</p>
                        )}
                      </div>
                    </FormRow>
                  ))}
                </DetailCard>

                <div className="mt-4 rounded-2xl border border-admin-line bg-admin-surface p-3">
                  <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    Fields you can drop in
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.scenario.mergeFields.map((field) => (
                      <button
                        key={field.token}
                        type="button"
                        onClick={() => insertToken(field.token)}
                        title={`${field.label} - e.g. ${field.sample}`}
                        className="inline-flex h-8 items-center rounded-lg border border-admin-line bg-admin-card px-2.5 font-mono text-[11px] font-semibold text-admin-primary transition-colors hover:border-admin-primary/40 hover:bg-admin-primary-soft"
                      >
                        {`{{${field.token}}}`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-admin-muted">
                    Click a field to add it to the box you last typed in.
                  </p>
                </div>
              </form>
            ) : (
              <DetailCard>
                {selected.scenario.slots
                  .filter((slot) => selected.slots[slot])
                  .map((slot) => (
                    <DetailCell
                      key={slot}
                      label={SLOT_LABELS[slot]}
                      value={selected.slots[slot]}
                      multiline={MULTILINE_SLOTS.has(slot)}
                    />
                  ))}
              </DetailCard>
            )}

            {liveSlots && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-wide text-admin-muted">
                    Preview with sample details
                  </p>
                  {editing && (
                    <span className="text-[11px] text-admin-muted">Updates as you type</span>
                  )}
                </div>
                <div className="rounded-2xl border border-admin-line bg-admin-card p-3">
                  <p className="mb-2 truncate text-[13px] font-semibold text-admin-ink">
                    {previewSubject(selected.scenario, liveSlots) || "(no subject)"}
                  </p>
                  <iframe
                    /* Sandboxed with no allowances: the preview is inert markup,
                       and template copy must never be able to script this page. */
                    sandbox=""
                    title={`Preview of ${selected.scenario.label}`}
                    srcDoc={previewHtml(selected.scenario, liveSlots)}
                    className="h-125 w-full rounded-xl border border-admin-line bg-white"
                  />
                </div>
              </div>
            )}

            {!editing && (
              <p
                className={cn(
                  "text-[11px] leading-snug",
                  selected.isActive ? "text-admin-muted" : "text-admin-warning"
                )}
              >
                {selected.isActive
                  ? "This email is being sent."
                  : "This email is switched off and is not being sent to anyone."}
              </p>
            )}
          </>
        )}
      </RecordSheet>

      {!sheet.open && sheet.ConfirmDialogUI}
    </div>
  );
}
