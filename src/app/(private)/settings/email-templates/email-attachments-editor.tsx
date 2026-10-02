"use client";

import { useRef, useTransition } from "react";
import { Download, Eye, Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_ATTACHMENT_LIMITS, type TemplateAttachment } from "@/lib/email/design";
import { templateAttachmentUrlAction, uploadTemplateAttachmentAction } from "./actions";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* The files are private, so each open or download asks the server for a
   short-lived link. The tab is opened before the wait so it isn't blocked as
   a popup. */
async function viewAttachment(scenarioKey: string, file: TemplateAttachment) {
  const tab = window.open("about:blank", "_blank");
  const res = await templateAttachmentUrlAction(scenarioKey, file.path);
  if (!res.url) {
    tab?.close();
    toast.error(res.error ?? "The file could not be opened.");
    return;
  }
  if (tab) tab.location.href = res.url;
  else window.location.href = res.url;
}

async function downloadAttachment(scenarioKey: string, file: TemplateAttachment) {
  const res = await templateAttachmentUrlAction(scenarioKey, file.path, file.name);
  if (!res.url) {
    toast.error(res.error ?? "The file could not be downloaded.");
    return;
  }
  const link = document.createElement("a");
  link.href = res.url;
  link.download = file.name;
  link.click();
}

const FILE_ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-primary sm:h-8 sm:w-8";

export function AttachmentChips({ files, scenarioKey }: { files: TemplateAttachment[]; scenarioKey: string }) {
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <li key={f.path} className="max-w-full">
          <button
            type="button"
            onClick={() => viewAttachment(scenarioKey, f)}
            title={`Open ${f.name}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-admin-line bg-white px-2 py-1 text-[12px] font-semibold text-admin-ink transition-colors hover:bg-admin-surface"
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-admin-muted" aria-hidden="true" />
            <span className="truncate">{f.name}</span>
            <span className="shrink-0 font-normal text-admin-muted">{formatFileSize(f.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EmailAttachmentsEditor({
  scenarioKey,
  files,
  onChange,
}: {
  scenarioKey: string;
  files: TemplateAttachment[];
  onChange: (next: TemplateAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const full = files.length >= TEMPLATE_ATTACHMENT_LIMITS.files;

  function upload(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    if (files.length + picked.length > TEMPLATE_ATTACHMENT_LIMITS.files) {
      toast.error(`Attach up to ${TEMPLATE_ATTACHMENT_LIMITS.files} files.`);
      return;
    }
    if (total + picked.reduce((sum, f) => sum + f.size, 0) > TEMPLATE_ATTACHMENT_LIMITS.bytes) {
      toast.error("Attachments must be under 10 MB in total.");
      return;
    }
    startUpload(async () => {
      const added: TemplateAttachment[] = [];
      for (const file of picked) {
        const form = new FormData();
        form.set("file", file);
        const res = await uploadTemplateAttachmentAction(scenarioKey, form);
        if (res.error || !res.attachment) toast.error(`${file.name}: ${res.error ?? "upload failed"}`);
        else added.push(res.attachment);
      }
      if (added.length) onChange([...files, ...added]);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] leading-snug text-admin-muted">
        Sent with every email from this template - a stage plot, a load-in map, a spec sheet. Up to{" "}
        {TEMPLATE_ATTACHMENT_LIMITS.files} files, 10 MB in total. For anything bigger, add a link instead.
      </p>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center gap-2 rounded-xl border border-admin-line bg-white py-1.5 pr-1.5 pl-3 text-[13px]"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden="true" />
              <button
                type="button"
                onClick={() => viewAttachment(scenarioKey, f)}
                title={`Open ${f.name}`}
                className="min-w-0 flex-1 truncate text-left font-semibold text-admin-ink hover:text-admin-primary hover:underline"
              >
                {f.name}
              </button>
              <span className="shrink-0 text-[12px] text-admin-muted">{formatFileSize(f.size)}</span>
              <button
                type="button"
                aria-label={`View ${f.name}`}
                title="View"
                onClick={() => viewAttachment(scenarioKey, f)}
                className={FILE_ICON_BUTTON}
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Download ${f.name}`}
                title="Download"
                onClick={() => downloadAttachment(scenarioKey, f)}
                className={FILE_ICON_BUTTON}
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                title="Remove"
                onClick={() => onChange(files.filter((x) => x.path !== f.path))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-error-bg hover:text-admin-error sm:h-8 sm:w-8"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isUploading || full}
          onClick={() => inputRef.current?.click()}
          className="flex h-11 items-center gap-1.5 rounded-xl border border-[#34451F] px-3.5 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:pointer-events-none disabled:opacity-50 sm:h-9"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Attach files
        </button>
        {files.length > 0 && (
          <span className="text-[12px] text-admin-muted">
            {files.length} of {TEMPLATE_ATTACHMENT_LIMITS.files} · {formatFileSize(total)} of 10 MB
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        aria-label="Attach files to this template"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
