"use client";

import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TOOL =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-admin-line bg-white text-admin-ink transition-colors hover:bg-admin-surface focus-visible:ring-2 focus-visible:ring-[#34451F]/40 focus-visible:outline-none sm:h-8 sm:w-8";
const TOOL_ON = "border-admin-primary bg-admin-primary-soft";

/* A small rich text box for email copy: bold, italic, a sub-heading, lists and
   links - the subset an email can render reliably. Reports HTML on change and
   hands its "insert at cursor" to the parent when focused, so merge-field
   chips can drop into whichever box was last used. */
export function RichTextField({
  id,
  label,
  initialHtml,
  onChange,
  onFocusInsert,
}: {
  id: string;
  label: string;
  initialHtml: string;
  onChange: (html: string) => void;
  onFocusInsert?: (insert: (text: string) => void) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    content: initialHtml,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
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
        "aria-label": label,
        class:
          "min-h-20 px-3 py-2 text-[13px] leading-relaxed text-admin-ink outline-none [&_a]:text-admin-primary [&_a]:underline [&_h2]:text-[16px] [&_h2]:font-bold [&_h3]:text-[14px] [&_h3]:font-bold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
    onFocus: ({ editor: e }) => onFocusInsert?.((text) => e.chain().focus().insertContent(text).run()),
  });


  function applyLink() {
    if (!editor) return;
    const raw = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!raw) chain.unsetLink().run();
    else {
      const href = /^(https?:|mailto:|\{\{)/i.test(raw) ? raw : raw.includes("@") ? `mailto:${raw}` : `https://${raw}`;
      if (editor.state.selection.empty && !editor.isActive("link")) {
        chain.insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
      } else chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1" role="toolbar" aria-label={`${label} formatting`}>
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          aria-pressed={editor?.isActive("bold") ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={cn(TOOL, editor?.isActive("bold") && TOOL_ON)}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          aria-pressed={editor?.isActive("italic") ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={cn(TOOL, editor?.isActive("italic") && TOOL_ON)}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Heading"
          title="Heading"
          aria-pressed={editor?.isActive("heading") ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(TOOL, editor?.isActive("heading") && TOOL_ON)}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          aria-pressed={editor?.isActive("bulletList") ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={cn(TOOL, editor?.isActive("bulletList") && TOOL_ON)}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          aria-pressed={editor?.isActive("orderedList") ?? false}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={cn(TOOL, editor?.isActive("orderedList") && TOOL_ON)}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <Popover
          open={linkOpen}
          onOpenChange={(open) => {
            setLinkOpen(open);
            if (open) setLinkUrl((editor?.getAttributes("link").href as string | undefined) ?? "");
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              title="Link"
              aria-pressed={editor?.isActive("link") ?? false}
              className={cn(TOOL, editor?.isActive("link") && TOOL_ON)}
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
      </div>
      <div className="rounded-xl border border-admin-line bg-white transition-colors focus-within:border-admin-primary/40">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
