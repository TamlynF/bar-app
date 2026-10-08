"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 9 * 1024 * 1024;

const TOOL_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-admin-line bg-white text-admin-ink transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none disabled:opacity-50 sm:h-8 sm:w-8";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailComposer({
  id,
  label,
  placeholder = "Write a reply…",
  disabled,
  sending = false,
  onSend,
  onChange,
  minHeightClass = "min-h-24",
  plain = false,
}: {
  id: string;
  label: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  onSend?: (html: string, files: File[]) => Promise<boolean>;
  onChange?: (draft: { html: string; text: string; files: File[] }) => void;
  minHeightClass?: string;
  /* Chat channels take text only: no formatting bar, no attachments. */
  plain?: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<() => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
    ],
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": plain ? "Message" : "Email message",
        class: cn(
          minHeightClass,
          "px-3 py-2 text-[13px] leading-relaxed text-admin-ink outline-none [&_a]:text-admin-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_ul]:list-disc [&_ul]:pl-5"
        ),
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          sendRef.current();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const state = {
    empty: editor?.isEmpty ?? true,
    bold: editor?.isActive("bold") ?? false,
    italic: editor?.isActive("italic") ?? false,
    bulletList: editor?.isActive("bulletList") ?? false,
    link: editor?.isActive("link") ?? false,
  };

  const canSend = !!onSend && !disabled && !sending && (!state.empty || files.length > 0);

  const html = editor && !state.empty ? editor.getHTML() : "";
  const text = editor && !state.empty ? editor.getText() : "";
  useEffect(() => {
    onChange?.({ html, text, files });
  }, [html, text, files, onChange]);

  async function send() {
    if (!editor || !canSend || !onSend) return;
    const ok = await onSend(state.empty ? "" : editor.getHTML(), files);
    if (ok) {
      editor.commands.clearContent();
      setFiles([]);
    }
  }

  useEffect(() => {
    sendRef.current = () => void send();
  });

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (files.length + picked.length > MAX_FILES) toast.error(`Attach up to ${MAX_FILES} files.`);
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) {
      toast.error("Attachments must be under 9 MB in total.");
      return;
    }
    setFiles(next);
  }

  function openLink(open: boolean) {
    setLinkOpen(open);
    if (open) setLinkUrl((editor?.getAttributes("link").href as string | undefined) ?? "");
  }

  function applyLink() {
    if (!editor) return;
    const raw = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!raw) {
      chain.unsetLink().run();
    } else {
      const href = /^(https?:|mailto:)/i.test(raw) ? raw : raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
      if (editor.state.selection.empty && !editor.isActive("link")) {
        chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
      } else {
        chain.setLink({ href }).run();
      }
    }
    setLinkOpen(false);
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block truncate text-[12px] text-admin-muted">
        {label}
      </label>

      {!plain && (
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Formatting">
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          aria-pressed={state.bold}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={cn(TOOL_BUTTON, state.bold && "border-admin-primary bg-admin-primary-soft")}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          aria-pressed={state.italic}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={cn(TOOL_BUTTON, state.italic && "border-admin-primary bg-admin-primary-soft")}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          aria-pressed={state.bulletList}
          disabled={disabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={cn(TOOL_BUTTON, state.bulletList && "border-admin-primary bg-admin-primary-soft")}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <Popover open={linkOpen} onOpenChange={openLink}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              title="Link"
              aria-pressed={state.link}
              disabled={disabled}
              className={cn(TOOL_BUTTON, state.link && "border-admin-primary bg-admin-primary-soft")}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 rounded-2xl border border-admin-line bg-white p-3">
            <label htmlFor={`${id}-link`} className="mb-1.5 block text-[12px] font-semibold text-admin-muted">
              Link address
            </label>
            <input
              id={`${id}-link`}
              type="url"
              value={linkUrl}
              autoFocus
              placeholder="https://…"
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
              className="h-9 w-full rounded-lg border border-admin-line bg-admin-card px-2.5 text-[13px] text-admin-ink outline-none focus:border-admin-primary/40"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="h-8 rounded-lg border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="h-8 rounded-lg border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] hover:bg-[#E5EBD8]"
              >
                {linkUrl.trim() ? "Apply" : "Remove link"}
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label="Attach files"
          title="Attach files"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => fileInputRef.current?.click()}
          className={TOOL_BUTTON}
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          aria-label="Attach files"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      )}

      <div
        className={cn(
          "relative rounded-xl border border-admin-line bg-white transition-colors focus-within:border-admin-primary/40",
          disabled && "opacity-60"
        )}
      >
        {state.empty && (
          <span className="pointer-events-none absolute top-2 left-3 text-[13px] text-admin-muted/60">{placeholder}</span>
        )}
        <EditorContent editor={editor} />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-admin-line bg-white py-1 pr-1 pl-2 text-[12px] font-semibold text-admin-ink"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-admin-muted" aria-hidden="true" />
              <span className="truncate">{f.name}</span>
              <span className="shrink-0 font-normal text-admin-muted">{formatBytes(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                title="Remove"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-admin-muted hover:bg-admin-surface hover:text-admin-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {onSend && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#34451F] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#283719] disabled:pointer-events-none disabled:opacity-50 sm:h-10"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {plain ? "Send message" : "Send reply"}
          </button>
        </div>
      )}
    </div>
  );
}
