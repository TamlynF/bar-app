"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Loader2, Palette, Pencil, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EMAIL_SCENARIOS, findScenario } from "@/lib/email/scenarios";
import { mergeOverride, type EmailTemplateRow } from "@/lib/email/merge";
import { previewHtml } from "@/lib/email/preview";
import { EMAIL_FONTS, type EmailBrand, type FontKey } from "@/lib/email/design";
import { ImageUploadButton } from "./email-blocks-editor";
import { saveEmailBrandAction } from "./actions";

const PREVIEW_KEYS = ["band.offered", "booking.event.confirmed", "enquiry.received.customer"] as const;
const PREVIEW_LABELS: Record<(typeof PREVIEW_KEYS)[number], string> = {
  "band.offered": "Band email",
  "booking.event.confirmed": "Booking email",
  "enquiry.received.customer": "Plain email",
};

type ColourKey = "headerBg" | "headerText" | "accent" | "cardLabelColor" | "cardBg" | "cardBorder" | "noteBar";

const CARD_COLOUR_FIELDS: { key: ColourKey; label: string; hint: string }[] = [
  { key: "cardLabelColor", label: "Label colour", hint: "\"Proposed Slot\", \"Note from our team\"" },
  { key: "cardBg", label: "Card background", hint: "Slot card and note" },
  { key: "cardBorder", label: "Card border", hint: "Around the slot card" },
  { key: "noteBar", label: "Note bar", hint: "The bar beside the team note" },
];

const COLOUR_FIELDS: { key: ColourKey; label: string; hint: string }[] = [
  { key: "headerBg", label: "Header background", hint: "Band and booking emails" },
  { key: "headerText", label: "Header text", hint: "The big heading in the header" },
  { key: "accent", label: "Accent / buttons", hint: "Buttons and the header sub-line" },
];

const INPUT =
  "h-11 w-full rounded-xl border border-admin-line bg-white px-3 text-[13px] text-admin-ink outline-none focus:border-admin-primary sm:h-9";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-b border-admin-line px-4 py-3 last:border-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5">
      <div>
        <p className="text-[12px] font-bold text-admin-ink">{label}</p>
        {hint && <p className="text-[11px] text-admin-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function EmailBrandEditor({ brand, rows }: { brand: EmailBrand; rows: EmailTemplateRow[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EmailBrand>(brand);
  const [previewKey, setPreviewKey] = useState<(typeof PREVIEW_KEYS)[number]>("band.offered");
  const [isSaving, startSaving] = useTransition();
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const live = editing ? draft : brand;
  const scenario = findScenario(previewKey) ?? EMAIL_SCENARIOS[0];
  const row = rows.find((r) => r.scenario_key === scenario.key && !r.variant_name) ?? null;
  const resolved = mergeOverride(scenario, row);
  const set = <K extends keyof EmailBrand>(key: K, value: EmailBrand[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const anySet = Object.values(brand).some((v) => v != null);

  const colourRow = (field: { key: ColourKey; label: string; hint: string }) => (
    <Row key={field.key} label={field.label} hint={field.hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={field.label}
          value={draft[field.key] ?? "#34451F"}
          onChange={(e) => set(field.key, e.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded-lg border border-admin-line bg-white p-1 sm:h-9"
        />
        <span className="text-[12px] text-admin-muted tabular-nums">{draft[field.key] ?? "Email's own colour"}</span>
        {draft[field.key] && (
          <button
            type="button"
            aria-label={`Reset ${field.label.toLowerCase()}`}
            title="Use each email's own colour"
            onClick={() => set(field.key, null)}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-admin-muted hover:bg-admin-surface hover:text-admin-ink sm:h-8 sm:w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </Row>
  );

  function save() {
    const form = new FormData();
    form.set("logo_url", draft.logoUrl ?? "");
    form.set("logo_width", draft.logoWidth ? String(draft.logoWidth) : "");
    form.set("font", draft.font ?? "");
    form.set("header_bg", draft.headerBg ?? "");
    form.set("header_text", draft.headerText ?? "");
    form.set("accent", draft.accent ?? "");
    form.set("footer_text", draft.footerText ?? "");
    form.set("card_label_color", draft.cardLabelColor ?? "");
    form.set("card_label_case", draft.cardLabelCase ?? "");
    form.set("card_value_size", draft.cardValueSize ?? "");
    form.set("card_bg", draft.cardBg ?? "");
    form.set("card_border", draft.cardBorder ?? "");
    form.set("note_bar", draft.noteBar ?? "");
    startSaving(async () => {
      const res = await saveEmailBrandAction(form);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Brand settings saved - every email now uses them");
        setEditing(false);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-admin-line bg-admin-primary-soft px-4 py-3 sm:px-5">
        <Palette className="h-4 w-4 shrink-0 text-admin-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold text-admin-ink">Brand</h2>
          <p className="text-[12px] text-admin-muted">
            Logo, font, colours and footer for every email. Anything left blank keeps each email&apos;s own look.
          </p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(brand);
                setEditing(false);
              }}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-[#D8D5C8] bg-white px-3 text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE] sm:h-9"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={save}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white hover:bg-[#283719] disabled:opacity-50 sm:h-9"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(brand);
              setEditing(true);
            }}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-[#34451F] bg-white px-3 text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8] sm:h-9"
          >
            <Pencil className="h-4 w-4" />
            Edit brand
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:border-r lg:border-admin-line">
          {editing ? (
            <>
              <Row label="Logo" hint="Shown at the top of every email">
                <div className="flex flex-wrap items-center gap-2">
                  <ImageUploadButton label={draft.logoUrl ? "Replace logo" : "Upload logo"} onUploaded={(url) => set("logoUrl", url)} />
                  {draft.logoUrl && (
                    <button
                      type="button"
                      onClick={() => set("logoUrl", null)}
                      className="h-11 rounded-xl px-3 text-[13px] font-semibold text-[#B33A32] hover:bg-admin-error-bg sm:h-9"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {draft.logoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-admin-muted">
                    Width
                    <input
                      type="range"
                      min={60}
                      max={320}
                      step={10}
                      aria-label="Logo width"
                      value={draft.logoWidth ?? 160}
                      onChange={(e) => set("logoWidth", Number(e.target.value))}
                      className="flex-1 accent-[#34451F]"
                    />
                    <span className="w-12 text-right tabular-nums">{draft.logoWidth ?? 160}px</span>
                  </label>
                )}
              </Row>
              <Row label="Font" hint="Gmail shows its fallback for web fonts">
                <select
                  aria-label="Email font"
                  value={draft.font ?? ""}
                  onChange={(e) => set("font", (e.target.value || null) as FontKey | null)}
                  className={INPUT}
                >
                  <option value="">Each email&apos;s own font</option>
                  {(Object.keys(EMAIL_FONTS) as FontKey[]).map((key) => (
                    <option key={key} value={key}>
                      {EMAIL_FONTS[key].label}
                    </option>
                  ))}
                </select>
              </Row>
              {COLOUR_FIELDS.map(colourRow)}
              <Row label="Footer line" hint="Replaces the address / venue line">
                <input
                  aria-label="Footer line"
                  value={draft.footerText ?? ""}
                  maxLength={200}
                  placeholder="Don Fenticas - Unit 1, Regent St, Hinckley LE10 0BB"
                  onChange={(e) => set("footerText", e.target.value || null)}
                  className={INPUT}
                />
              </Row>
              <div className="border-b border-admin-line bg-admin-surface/60 px-4 py-2 sm:px-5">
                <p className="text-[12px] font-bold text-admin-ink">Booking blocks</p>
                <p className="text-[11px] text-admin-muted">The slot card and team note in band emails</p>
              </div>
              <Row label="Label style">
                <select
                  aria-label="Label style"
                  value={draft.cardLabelCase ?? ""}
                  onChange={(e) => set("cardLabelCase", (e.target.value || null) as EmailBrand["cardLabelCase"])}
                  className={INPUT}
                >
                  <option value="">Small capitals</option>
                  <option value="plain">Normal text</option>
                </select>
              </Row>
              <Row label="Date / time size">
                <select
                  aria-label="Date and time size"
                  value={draft.cardValueSize ?? ""}
                  onChange={(e) => set("cardValueSize", (e.target.value || null) as EmailBrand["cardValueSize"])}
                  className={INPUT}
                >
                  <option value="">Normal</option>
                  <option value="large">Large</option>
                </select>
              </Row>
              {CARD_COLOUR_FIELDS.map(colourRow)}
            </>
          ) : (
            <div className="space-y-1 px-4 py-3 text-[13px] sm:px-5">
              {anySet ? (
                <>
                  {brand.logoUrl && <p>Logo set ({brand.logoWidth ?? 160}px wide)</p>}
                  {brand.font && <p>Font: {EMAIL_FONTS[brand.font].label}</p>}
                  {[...COLOUR_FIELDS, ...CARD_COLOUR_FIELDS].filter((f) => brand[f.key]).map((f) => (
                    <p key={f.key} className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-admin-line bg-[var(--swatch)]"
                        style={{ "--swatch": brand[f.key] } as React.CSSProperties}
                        aria-hidden="true"
                      />
                      {f.label}: {brand[f.key]}
                    </p>
                  ))}
                  {brand.footerText && <p>Footer: {brand.footerText}</p>}
                  {brand.cardLabelCase && (
                    <p>Booking block labels: {brand.cardLabelCase === "plain" ? "normal text" : "small capitals"}</p>
                  )}
                  {brand.cardValueSize && <p>Date / time size: {brand.cardValueSize}</p>}
                </>
              ) : (
                <p className="text-admin-muted">No brand settings yet - every email uses its own built-in look.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-admin-line bg-admin-surface/50 p-3 sm:p-4 lg:border-t-0">
          <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Preview email">
            {PREVIEW_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={previewKey === key}
                onClick={() => setPreviewKey(key)}
                className={cn(
                  "h-9 rounded-full border px-3 text-[12px] font-semibold transition-colors",
                  previewKey === key
                    ? "border-admin-primary bg-admin-primary text-white"
                    : "border-admin-line bg-white text-admin-muted hover:text-admin-ink"
                )}
              >
                {PREVIEW_LABELS[key]}
              </button>
            ))}
          </div>
          {inBrowser && (
            <iframe
              sandbox=""
              title="Brand preview"
              srcDoc={previewHtml(scenario, resolved.slots, { brand: live, blocks: resolved.blocks })}
              className="h-105 w-full rounded-xl border border-admin-line bg-white"
            />
          )}
        </div>
      </div>
    </section>
  );
}

