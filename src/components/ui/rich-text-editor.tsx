"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Pilcrow,
} from "lucide-react";

const COLORS = [
  { label: "Default", value: "" },
  { label: "White", value: "#ffffff" },
  { label: "Gold", value: "#FDCC4B" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Muted", value: "#a8a29e" },
];

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded-lg text-[#5C4033] transition-colors",
        active
          ? "bg-[#5C4033] text-white"
          : "hover:bg-[#E6DFC8]"
      )}
    >
      {children}
    </button>
  );
}

type RichTextEditorProps = {
  name: string;
  defaultValue?: string;
};

export function RichTextEditor({ name, defaultValue = "" }: RichTextEditorProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
    ],
    content: defaultValue,
    immediatelyRender: false,
    onUpdate({ editor }) {
      if (hiddenRef.current) {
        hiddenRef.current.value = editor.getHTML();
      }
    },
  });

  // Sync initial value into hidden input
  useEffect(() => {
    if (hiddenRef.current && editor) {
      hiddenRef.current.value = editor.getHTML();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col gap-0">
      {/* Hidden input carries the HTML value in the form */}
      <input type="hidden" name={name} ref={hiddenRef} defaultValue={defaultValue} />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-[#E6DFC8] bg-[#F7F4EA] rounded-t-2xl">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-[#E6DFC8] mx-0.5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Normal text"
        >
          <Pilcrow className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-[#E6DFC8] mx-0.5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-[#E6DFC8] mx-0.5" />

        {/* Colour swatches */}
        {COLORS.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.label}
            onMouseDown={(e) => {
              e.preventDefault();
              if (c.value) {
                editor.chain().focus().setColor(c.value).run();
              } else {
                editor.chain().focus().unsetColor().run();
              }
            }}
            className={cn(
              "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
              c.value === "" && "bg-[#1F1F1A]",
              editor.isActive("textStyle", { color: c.value }) && c.value
                ? "border-[#5C4033] scale-110"
                : "border-transparent"
            )}
            style={c.value ? { "--swatch": c.value } as React.CSSProperties : undefined}
          >
            {c.value && (
              <span
                className="block w-full h-full rounded-full"
                style={{ backgroundColor: c.value }}
              />
            )}
          </button>
        ))}

        <div className="w-px h-5 bg-[#E6DFC8] mx-0.5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="rich-editor min-h-30 px-3 py-2 text-sm text-[#1F1F1A] leading-snug outline-none bg-white rounded-b-2xl overflow-y-auto"
      />
    </div>
  );
}
