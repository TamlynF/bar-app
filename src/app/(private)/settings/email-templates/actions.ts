"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployeeId } from "@/lib/current-employee";
import { findScenario, scenarioFamily } from "@/lib/email/scenarios";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAttachmentName } from "@/lib/email/correspondence";
import {
  EMAIL_FONTS,
  blockTokens,
  brandToRow,
  hexOrNull,
  sanitizeAttachments,
  sanitizeBlocks,
  templateAttachmentFolder,
  TEMPLATE_ATTACHMENT_LIMITS,
  type EmailBrand,
  type TemplateAttachment,
  type FontKey,
} from "@/lib/email/design";
import { SLOT_KEYS, tokensUsed, type SlotKey, type TemplateSlots } from "@/lib/email/render";
import { EMPTY_SLOTS } from "@/lib/email/render";

const COLUMN_FOR_SLOT: Record<SlotKey, string> = {
  subject: "subject",
  heading: "heading",
  eyebrow: "eyebrow",
  greeting: "greeting",
  intro: "intro",
  outro: "outro",
  ctaLabel: "cta_label",
  footnote: "footnote",
  cardTitle: "card_title",
  noteTitle: "note_title",
};

export async function saveEmailTemplateAction(formData: FormData) {
  const key = String(formData.get("scenario_key") ?? "");
  const scenario = findScenario(key);
  if (!scenario) return { error: "That email scenario no longer exists." };

  const edited: TemplateSlots = { ...EMPTY_SLOTS };
  for (const slot of scenario.slots) {
    edited[slot] = String(formData.get(slot) ?? "").trim();
  }
  for (const slot of SLOT_KEYS) {
    if (!scenario.slots.includes(slot)) edited[slot] = scenario.defaults[slot];
  }

  if (!edited.subject) return { error: "A subject line is required - the email cannot send without one." };

  const rawBlocks = String(formData.get("blocks") ?? "").trim();
  let blocks = null;
  if (rawBlocks) {
    try {
      blocks = sanitizeBlocks(JSON.parse(rawBlocks), scenarioFamily(scenario));
    } catch {
      return { error: "The layout could not be read. Reload the page and try again." };
    }
  }

  let attachments: TemplateAttachment[] = [];
  try {
    attachments = sanitizeAttachments(JSON.parse(String(formData.get("attachments") ?? "[]")), key);
  } catch {
    return { error: "The attachments could not be read. Reload the page and try again." };
  }
  if (attachments.reduce((sum, a) => sum + a.size, 0) > TEMPLATE_ATTACHMENT_LIMITS.bytes) {
    return { error: "Attachments must be under 10 MB in total." };
  }

  const declared = new Set(scenario.mergeFields.map((f) => f.token));
  const unknown = [...new Set([...tokensUsed(edited), ...blockTokens(blocks)])].filter(
    (token) => !declared.has(token)
  );
  if (unknown.length > 0) {
    return {
      error: `This email has no field called ${unknown.map((t) => `{{${t}}}`).join(", ")}. Use one of the fields listed above, or remove it.`,
    };
  }

  /* Only the slots that differ from the built-in copy are stored. Everything
     else stays null, so a scenario keeps inheriting later wording changes for
     the parts nobody has deliberately rewritten. */
  const payload: Record<string, string | null> = {};
  for (const slot of SLOT_KEYS) {
    const column = COLUMN_FOR_SLOT[slot];
    payload[column] = edited[slot] === scenario.defaults[slot] ? null : edited[slot];
  }

  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("email_templates")
    .select("id, created_at, created_by, attachments")
    .eq("scenario_key", key)
    .maybeSingle();

  const { error } = await supabase.from("email_templates").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      scenario_key: key,
      ...payload,
      blocks,
      attachments: attachments.length ? attachments : null,
      created_at: existing?.created_at ?? now,
      created_by: existing?.created_by ?? employeeId,
      updated_at: now,
      updated_by: employeeId,
    },
    { onConflict: "scenario_key" }
  );

  if (error) {
    console.error("Email template save failed:", error);
    return { error: "Could not save this template." };
  }

  const kept = new Set(attachments.map((a) => a.path));
  const removed = sanitizeAttachments(existing?.attachments, key)
    .map((a) => a.path)
    .filter((path) => !kept.has(path));
  if (removed.length) await removeTemplateFiles(removed);

  revalidatePath("/settings/email-templates");
  return { success: true };
}

/* Deleting the row is what "reset" means - the scenario falls back to the copy
   that ships with the code, so it can never be left unable to send. */
export async function resetEmailTemplateAction(key: string) {
  if (!findScenario(key)) return { error: "That email scenario no longer exists." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("email_templates")
    .select("attachments")
    .eq("scenario_key", key)
    .maybeSingle();
  const { error } = await supabase.from("email_templates").delete().eq("scenario_key", key);
  if (!error) {
    const files = sanitizeAttachments(existing?.attachments, key).map((a) => a.path);
    if (files.length) await removeTemplateFiles(files);
  }

  if (error) {
    console.error("Email template reset failed:", error);
    return { error: "Could not reset this template." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}

export async function setEmailTemplateActiveAction(key: string, isActive: boolean) {
  if (!findScenario(key)) return { error: "That email scenario no longer exists." };

  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("email_templates")
    .select("id, created_at, created_by")
    .eq("scenario_key", key)
    .maybeSingle();

  const { error } = await supabase.from("email_templates").upsert(
    {
      ...(existing?.id ? { id: existing.id } : {}),
      scenario_key: key,
      is_active: isActive,
      created_at: existing?.created_at ?? now,
      created_by: existing?.created_by ?? employeeId,
      updated_at: now,
      updated_by: employeeId,
    },
    { onConflict: "scenario_key" }
  );

  if (error) {
    console.error("Email template activation failed:", error);
    return { error: "Could not change whether this email sends." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}

const ASSET_BUCKET = "email-assets";
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const ASSET_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export async function saveEmailBrandAction(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const font = text("font");
  const logoUrl = text("logo_url");
  const width = Number(text("logo_width"));

  const brand: EmailBrand = {
    logoUrl: /^https:\/\//i.test(logoUrl) ? logoUrl : null,
    logoWidth: Number.isFinite(width) && width >= 40 && width <= 560 ? Math.round(width) : null,
    font: font && Object.prototype.hasOwnProperty.call(EMAIL_FONTS, font) ? (font as FontKey) : null,
    headerBg: hexOrNull(text("header_bg")),
    headerText: hexOrNull(text("header_text")),
    accent: hexOrNull(text("accent")),
    footerText: text("footer_text").slice(0, 200) || null,
    cardLabelColor: hexOrNull(text("card_label_color")),
    cardLabelCase: text("card_label_case") === "upper" || text("card_label_case") === "plain"
      ? (text("card_label_case") as "upper" | "plain")
      : null,
    cardValueSize: text("card_value_size") === "normal" || text("card_value_size") === "large"
      ? (text("card_value_size") as "normal" | "large")
      : null,
    cardBg: hexOrNull(text("card_bg")),
    cardBorder: hexOrNull(text("card_border")),
    noteBar: hexOrNull(text("note_bar")),
  };

  const supabase = await createClient();
  const employeeId = await getCurrentEmployeeId(supabase);
  const { error } = await supabase.from("email_brand").upsert(
    { id: 1, ...brandToRow(brand), updated_at: new Date().toISOString(), updated_by: employeeId },
    { onConflict: "id" }
  );
  if (error) {
    console.error("Email brand save failed:", error);
    return { error: "Could not save the brand settings." };
  }

  revalidatePath("/settings/email-templates");
  return { success: true };
}

/* Logos and images go to a public bucket: a mail client fetches them over the
   open web. Staff-only - the upload checks the session before using the
   service role. */
export async function uploadEmailAssetAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to upload." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (!ASSET_TYPES.has(file.type)) return { error: "Use a PNG, JPG, GIF or WebP image." };
  if (file.size > MAX_ASSET_BYTES) return { error: "Images must be under 5 MB." };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(ASSET_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) {
    console.error("Email asset upload failed:", error.message);
    return { error: "The image could not be uploaded." };
  }
  return { url: admin.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl };
}

const TEMPLATE_FILES_BUCKET = "email-attachments";
const TEMPLATE_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

async function removeTemplateFiles(paths: string[]) {
  const { error } = await createAdminClient().storage.from(TEMPLATE_FILES_BUCKET).remove(paths);
  if (error) console.error("Email template file cleanup failed:", error.message);
}

/* Stored in the private attachments bucket, in a folder of the template's own.
   The template only references it once saved; an upload that is never saved
   is left behind as a harmless orphan. */
export async function uploadTemplateAttachmentAction(
  key: string,
  formData: FormData
): Promise<{ attachment?: TemplateAttachment; error?: string }> {
  if (!findScenario(key)) return { error: "That email scenario no longer exists." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to upload." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (!TEMPLATE_FILE_TYPES.has(file.type)) {
    return { error: "Attach a PDF, image, Word, Excel or text file." };
  }
  if (file.size > TEMPLATE_ATTACHMENT_LIMITS.bytes) return { error: "Files must be under 10 MB." };

  const name = safeAttachmentName(file.name, "attachment");
  const path = `${templateAttachmentFolder(key)}${crypto.randomUUID().slice(0, 8)}-${name}`;
  const { error } = await createAdminClient()
    .storage.from(TEMPLATE_FILES_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) {
    console.error("Email template attachment upload failed:", error.message);
    return { error: "The file could not be uploaded." };
  }
  return { attachment: { name, path, size: file.size, contentType: file.type } };
}

/* A short-lived link to one of a template's files, to open in the browser or,
   with `download`, to save. Only paths inside the template's own folder. */
export async function templateAttachmentUrlAction(
  key: string,
  path: string,
  download?: string
): Promise<{ url?: string; error?: string }> {
  if (!findScenario(key) || !path.startsWith(templateAttachmentFolder(key)) || path.includes("..")) {
    return { error: "That file is not part of this template." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again to open this file." };

  const { data, error } = await createAdminClient()
    .storage.from(TEMPLATE_FILES_BUCKET)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error || !data?.signedUrl) {
    console.error("Email template attachment link failed:", error?.message);
    return { error: "The file could not be opened." };
  }
  return { url: data.signedUrl };
}
