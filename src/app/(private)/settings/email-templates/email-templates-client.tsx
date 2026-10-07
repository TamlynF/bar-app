"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, CopyPlus, LayoutTemplate, Mail, MailX, Paperclip, PencilLine, RotateCcw } from "lucide-react";
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
import { EMAIL_SCENARIOS, EMAIL_SCENARIO_GROUPS, isWired, scenarioFamily } from "@/lib/email/scenarios";
import { mergeOverride, type EmailTemplateRow, type ResolvedTemplate } from "@/lib/email/merge";
import type { SlotKey, TemplateSlots } from "@/lib/email/render";
import { previewHtml, previewSubject } from "@/lib/email/preview";
import {
  BLOCK_REPLACED_SLOTS,
  defaultBlocks,
  type EmailBlock,
  type EmailBrand,
  type TemplateAttachment,
} from "@/lib/email/design";
import { AttachmentChips, EmailAttachmentsEditor } from "./email-attachments-editor";
import { EmailBrandEditor } from "./email-brand-editor";
import { EmailBlocksEditor } from "./email-blocks-editor";
import { isVersionable } from "@/lib/email/booking-email-versions";
import { EmailVersionNamePanel } from "./email-version-panel";
import {
  saveEmailTemplateAction,
  resetEmailTemplateAction,
  setEmailTemplateActiveAction,
  createEmailVersionAction,
  renameEmailVersionAction,
  deleteEmailVersionAction,
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
  cardTitle: "Slot card label",
  noteTitle: "Note label",
};

const SLOT_HINTS: Partial<Record<SlotKey, string>> = {
  intro: "Leave a blank line between paragraphs. Sits above the details block.",
  outro: "Sits below the details block, before the button.",
  ctaLabel: "The link itself is generated - this is only the wording on the button.",
  cardTitle: "The small heading on the date and time card.",
  noteTitle: "The heading on the message typed when the email is sent.",
};

const MULTILINE_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(["intro", "outro", "footnote"]);

const FORM_ID = "email-template-form";

type TemplateItem = ResolvedTemplate & { versionId: number | null; versionName: string | null };

const itemId = (item: TemplateItem) => (item.versionId ? `v${item.versionId}` : item.scenario.key);

export default function EmailTemplatesClient({
  rows,
  employees,
  brand,
  versionUsage = {},
}: {
  rows: EmailTemplateRow[];
  employees: Employee[];
  brand: EmailBrand;
  brandUpdatedAt?: string | null;
  versionUsage?: Record<number, string[]>;
}) {
  const resolved = useMemo(() => {
    const standard = new Map(rows.filter((row) => !row.variant_name).map((row) => [row.scenario_key, row]));
    return EMAIL_SCENARIOS.flatMap((scenario): TemplateItem[] => [
      { ...mergeOverride(scenario, standard.get(scenario.key) ?? null), versionId: null, versionName: null },
      ...rows
        .filter((row) => row.scenario_key === scenario.key && row.variant_name)
        .sort((a, b) => (a.variant_name ?? "").localeCompare(b.variant_name ?? ""))
        .map((row) => ({ ...mergeOverride(scenario, row), versionId: row.id, versionName: row.variant_name ?? null })),
    ]);
  }, [rows]);

  const sheet = useRecordSheet<TemplateItem>({
    records: resolved,
    getId: itemId,
  });

  const openAfterCreate = useRef<number | null>(null);
  useEffect(() => {
    if (openAfterCreate.current == null) return;
    const created = resolved.find((item) => item.versionId === openAfterCreate.current);
    if (!created) return;
    openAfterCreate.current = null;
    sheet.openView(created);
  }, [resolved, sheet]);

  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<TemplateSlots | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<EmailBlock[] | null>(null);
  const [draftFiles, setDraftFiles] = useState<TemplateAttachment[]>([]);
  const lastFocused = useRef<SlotKey | null>(null);
  const blockInsert = useRef<((text: string) => void) | null>(null);

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
        (r.versionName ?? "").toLowerCase().includes(q) ||
        r.scenario.description.toLowerCase().includes(q) ||
        r.slots.subject.toLowerCase().includes(q)
    );
  }, [resolved, query]);

  // The rows are drawn a group at a time, so stepping through them has to
  // follow that order rather than the order they were filtered in.
  const inGroupOrder = useMemo(
    () => EMAIL_SCENARIO_GROUPS.flatMap((group) => shown.filter((r) => r.scenario.group === group)),
    [shown],
  );

  const selected = sheet.selected;

  const openEdit = useCallback(() => {
    if (selected) {
      setDraft({ ...selected.slots });
      setDraftBlocks(selected.blocks);
      setDraftFiles(selected.attachments);
    }
    sheet.startEdit();
  }, [selected, sheet]);

  const closeSheet = useCallback(() => {
    setDraft(null);
    setDraftBlocks(null);
    sheet.close();
  }, [sheet]);

  const handleDeleteVersion = useCallback(() => {
    if (!selected?.versionId) return;
    const usedBy = versionUsage[selected.versionId] ?? [];
    sheet.confirmDelete({
      title: `Delete the "${selected.versionName}" version?`,
      description: usedBy.length
        ? `${usedBy.length} ${usedBy.length === 1 ? "place uses" : "places use"} it (${usedBy.join(", ")}). They go back to inheriting - from the sub-category, category or the standard email.`
        : "Nothing has picked this version, so no booking emails change.",
      confirmLabel: "Delete version",
      action: () => deleteEmailVersionAction(selected.versionId!),
    });
  }, [selected, sheet, versionUsage]);

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
    const result = await setEmailTemplateActiveAction(selected.scenario.key, next, selected.versionId);
    if (result?.error) sheet.setFormError(result.error);
  }, [selected, sheet]);

  const insertToken = useCallback(
    (token: string) => {
      if (blockInsert.current) {
        blockInsert.current(`{{${token}}}`);
        return;
      }
      const slot = lastFocused.current;
      if (!slot || !draft) return;
      setDraft({ ...draft, [slot]: `${draft[slot]}{{${token}}}` });
    },
    [draft]
  );

  const focusSlot = (slot: SlotKey) => {
    lastFocused.current = slot;
    blockInsert.current = null;
  };

  const editing = sheet.mode === "edit";
  const liveSlots = editing && draft ? draft : selected?.slots ?? null;
  const liveBlocks = editing ? draftBlocks : (selected?.blocks ?? null);
  const liveFiles = editing ? draftFiles : (selected?.attachments ?? []);
  const family = selected ? scenarioFamily(selected.scenario) : "plain";
  const replaced = draftBlocks ? BLOCK_REPLACED_SLOTS[family] : new Set<string>();
  const sheetTitle = selected
    ? selected.versionName
      ? `${selected.scenario.label} - ${selected.versionName}`
      : selected.scenario.label
    : "Email template";

  const versionActions = !selected || !isVersionable(selected.scenario.key)
    ? []
    : selected.versionId
      ? [
          {
            label: "Rename version",
            icon: <PencilLine className="h-4 w-4" />,
            panel: (close: () => void) => (
              <EmailVersionNamePanel
                title="Rename this version"
                initialName={selected.versionName ?? ""}
                submitLabel="Save name"
                onSubmit={(name) => renameEmailVersionAction(selected.versionId!, name)}
                onDone={close}
              />
            ),
          },
          {
            label: "Duplicate version",
            icon: <Copy className="h-4 w-4" />,
            panel: (close: () => void) => (
              <EmailVersionNamePanel
                title="Name the copy"
                initialName={`${selected.versionName} copy`}
                submitLabel="Create version"
                onSubmit={async (name) => {
                  const result = await createEmailVersionAction(selected.scenario.key, name, selected.versionId);
                  if (result.id) openAfterCreate.current = result.id;
                  return result;
                }}
                onDone={close}
              />
            ),
          },
        ]
      : [
          {
            label: "New version",
            icon: <CopyPlus className="h-4 w-4" />,
            panel: (close: () => void) => (
              <EmailVersionNamePanel
                title="Name the new version"
                submitLabel="Create version"
                onSubmit={async (name) => {
                  const result = await createEmailVersionAction(selected.scenario.key, name, null);
                  if (result.id) openAfterCreate.current = result.id;
                  return result;
                }}
                onDone={close}
              />
            ),
          },
        ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <h1 className="text-lg font-bold tracking-tight text-admin-ink">Email templates</h1>
        <p className="mt-1 text-[13px] text-admin-muted">
          Every automatic email the venue sends. Set the shared brand below, then open an email to
          change its wording or customise its layout - add text, images and buttons, and move the
          booking blocks that are filled in from the real booking.
        </p>
      </div>

      <EmailBrandEditor brand={brand} rows={rows} />

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
                key={itemId(item)}
                onClick={() => {
                  setDraft(null);
                  sheet.openView(item);
                }}
                selected={!!selected && itemId(selected) === itemId(item)}
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
                <div className={cn("min-w-0 flex-1", item.versionId && "border-l-2 border-admin-line pl-3")}>
                  <p className="truncate text-sm font-semibold text-admin-ink">
                    {item.versionName ?? item.scenario.label}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-admin-muted">
                    {item.versionId ? `Version of ${item.scenario.label} · ` : ""}
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
        navigate={sheet.navigateAcross(inGroupOrder)}
        title={sheetTitle}
        formId={FORM_ID}
        isPending={sheet.isPending}
        onEdit={openEdit}
        onDelete={selected?.versionId ? handleDeleteVersion : selected?.isCustomised ? handleReset : undefined}
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
              {selected.versionId ? (
                <StatusPill tone="info" showLabelOnMobile>
                  Version
                </StatusPill>
              ) : (
                <StatusPill tone={selected.isCustomised ? "info" : "neutral"} showLabelOnMobile>
                  {selected.isCustomised ? "Customised" : "Built-in copy"}
                </StatusPill>
              )}
              <StatusPill tone="neutral" showLabelOnMobile>
                {selected.scenario.recipient === "admin" ? "To staff" : "To customer"}
              </StatusPill>
            </>
          )
        }
        actions={
          selected
            ? [
                ...versionActions,
                {
                  label: selected.isActive ? "Stop sending this email" : "Start sending this email",
                  icon: selected.isActive ? <MailX className="h-4 w-4" /> : <Mail className="h-4 w-4" />,
                  onSelect: toggleActive,
                  disabled: sheet.isPending,
                },
              ]
            : undefined
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

            {isVersionable(selected.scenario.key) && (
              <p className="text-[12px] leading-snug text-admin-muted">
                {selected.versionId
                  ? "Sent instead of the standard email wherever a category, sub-category or event picks this version."
                  : "The standard email. Make a named version from the menu to use different wording on chosen categories, sub-categories or events."}
              </p>
            )}

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
                {selected.versionId && <input type="hidden" name="version_id" value={selected.versionId} />}

                <input type="hidden" name="blocks" value={draftBlocks ? JSON.stringify(draftBlocks) : ""} />
                <input type="hidden" name="attachments" value={JSON.stringify(draftFiles)} />
                {selected.scenario.slots
                  .filter((slot) => replaced.has(slot))
                  .map((slot) => (
                    <input key={slot} type="hidden" name={slot} value={draft[slot]} />
                  ))}

                <DetailCard>
                  {selected.scenario.slots.filter((slot) => !replaced.has(slot)).map((slot) => (
                    <FormRow key={slot} label={SLOT_LABELS[slot]} align="start">
                      <div className="min-w-0 flex-1 space-y-1">
                        {MULTILINE_SLOTS.has(slot) ? (
                          <textarea
                            name={slot}
                            aria-label={SLOT_LABELS[slot]}
                            rows={slot === "intro" ? 5 : 3}
                            value={draft[slot]}
                            onFocus={() => focusSlot(slot)}
                            onChange={(e) => setDraft({ ...draft, [slot]: e.target.value })}
                            className="w-full resize-y rounded-xl border border-admin-line bg-white px-3 py-2.5 text-sm text-admin-ink outline-none focus:border-admin-primary"
                          />
                        ) : (
                          <input
                            name={slot}
                            aria-label={SLOT_LABELS[slot]}
                            value={draft[slot]}
                            onFocus={() => focusSlot(slot)}
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

                <div className="mt-4 rounded-2xl border border-admin-line bg-admin-card p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <LayoutTemplate className="h-4 w-4 text-admin-primary" aria-hidden="true" />
                    <p className="flex-1 text-[13px] font-bold text-admin-ink">Layout</p>
                    {draftBlocks && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftBlocks(null);
                          blockInsert.current = null;
                        }}
                        className="flex h-11 items-center gap-1.5 rounded-xl border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE] sm:h-9"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Use standard layout
                      </button>
                    )}
                  </div>
                  {draftBlocks ? (
                    <EmailBlocksEditor
                      blocks={draftBlocks}
                      onChange={setDraftBlocks}
                      onFocusInsert={(insert) => (blockInsert.current = insert)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[12px] leading-snug text-admin-muted">
                        This email uses the standard layout. Customise it to add paragraphs, images,
                        logos and buttons, or to move the booking blocks around.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDraftBlocks(defaultBlocks(selected.scenario.key, family, draft))}
                        className="flex h-11 items-center gap-1.5 rounded-xl border border-[#34451F] px-3.5 text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] sm:h-9"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                        Customise layout
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-admin-line bg-admin-card p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-admin-primary" aria-hidden="true" />
                    <p className="text-[13px] font-bold text-admin-ink">Attachments</p>
                  </div>
                  <EmailAttachmentsEditor
                    scenarioKey={selected.scenario.key}
                    files={draftFiles}
                    onChange={setDraftFiles}
                  />
                </div>
              </form>
            ) : (
              <DetailCard>
                {selected.versionId && (
                  <DetailCell
                    label="Used by"
                    value={
                      (versionUsage[selected.versionId] ?? []).join("\n") ||
                      "Nothing yet - pick it in the Emails section of a category, sub-category or event."
                    }
                    multiline
                  />
                )}
                {selected.blocks && (
                  <DetailCell label="Layout" value={`Custom layout - ${selected.blocks.length} blocks`} />
                )}
                {selected.attachments.length > 0 && (
                  <DetailCell
                    label="Attachments"
                    value={selected.attachments.map((a) => a.name).join(", ")}
                  />
                )}
                {selected.scenario.slots
                  .filter((slot) => selected.slots[slot])
                  .filter((slot) => !selected.blocks || !BLOCK_REPLACED_SLOTS[family].has(slot))
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
                  {liveFiles.length > 0 && (
                    <div className="mb-2">
                      <AttachmentChips files={liveFiles} scenarioKey={selected.scenario.key} />
                    </div>
                  )}
                  <iframe
                    /* Sandboxed with no allowances: the preview is inert markup,
                       and template copy must never be able to script this page. */
                    sandbox=""
                    title={`Preview of ${selected.scenario.label}`}
                    srcDoc={previewHtml(selected.scenario, liveSlots, { brand, blocks: liveBlocks })}
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
