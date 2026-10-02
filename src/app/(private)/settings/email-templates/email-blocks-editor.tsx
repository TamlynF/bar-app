"use client";

import { useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Lock,
  Minus,
  MousePointerClick,
  MoveVertical,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RichTextField } from "@/components/admin/rich-text-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SYSTEM_BLOCK_LABELS,
  newBlockId,
  type EmailBlock,
  type ImageAlign,
  type SpacerSize,
} from "@/lib/email/design";
import { uploadEmailAssetAction } from "./actions";

const INPUT =
  "h-11 w-full rounded-xl border border-admin-line bg-white px-3 text-[13px] text-admin-ink outline-none focus:border-admin-primary sm:h-9";
const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-lg text-admin-muted transition-colors hover:bg-admin-surface hover:text-admin-ink disabled:pointer-events-none disabled:opacity-30 sm:h-8 sm:w-8";

const TYPE_LABEL: Record<EmailBlock["type"], string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Space",
  system: "Booking block",
};

function newBlock(type: "text" | "image" | "button" | "divider" | "spacer"): EmailBlock {
  const id = newBlockId();
  if (type === "text") return { id, type, html: "<p></p>" };
  if (type === "image") return { id, type, url: "", alt: "", width: 100, align: "center", href: "" };
  if (type === "button") return { id, type, label: "Find out more", url: "https://" };
  if (type === "spacer") return { id, type, size: "m" };
  return { id, type: "divider" };
}

export function ImageUploadButton({
  label,
  onUploaded,
}: {
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#34451F] px-3 text-[13px] font-semibold text-[#34451F] transition-colors hover:bg-[#E5EBD8] disabled:opacity-50 sm:h-9"
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const form = new FormData();
          form.set("file", file);
          startUpload(async () => {
            const res = await uploadEmailAssetAction(form);
            if (res.error || !res.url) toast.error(res.error ?? "The image could not be uploaded.");
            else onUploaded(res.url);
          });
        }}
      />
    </>
  );
}

function BlockBody({
  block,
  onChange,
  onFocusInsert,
}: {
  block: EmailBlock;
  onChange: (next: EmailBlock) => void;
  onFocusInsert: (insert: (text: string) => void) => void;
}) {
  switch (block.type) {
    case "text":
      return (
        <div className="space-y-2">
          <RichTextField
            id={`block-${block.id}`}
            label="Text"
            initialHtml={block.html}
            onChange={(html) => onChange({ ...block, html })}
            onFocusInsert={onFocusInsert}
          />
          <label className="flex items-center gap-2 text-[12px] text-admin-muted">
            <input
              type="checkbox"
              checked={!!block.small}
              onChange={(e) => onChange({ ...block, small: e.target.checked || undefined })}
              className="h-4 w-4 accent-[#34451F]"
            />
            Small print style
          </label>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ImageUploadButton label={block.url ? "Replace image" : "Upload image"} onUploaded={(url) => onChange({ ...block, url })} />
            <input
              aria-label="Image address"
              value={block.url}
              placeholder="…or paste an image address (https://)"
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              className={cn(INPUT, "min-w-0 flex-1")}
            />
          </div>
          {block.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={block.url} alt="" className="max-h-28 rounded-lg border border-admin-line object-contain" />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              aria-label="Image description (alt text)"
              value={block.alt}
              placeholder="Description, shown when images are blocked"
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              className={INPUT}
            />
            <input
              aria-label="Link when clicked"
              value={block.href}
              placeholder="Link when clicked (optional)"
              onChange={(e) => onChange({ ...block, href: e.target.value })}
              className={INPUT}
            />
            <label className="flex items-center gap-2 text-[12px] text-admin-muted">
              Width
              <select
                aria-label="Image width"
                value={block.width}
                onChange={(e) => onChange({ ...block, width: Number(e.target.value) })}
                className={cn(INPUT, "w-auto")}
              >
                {[25, 33, 50, 75, 100].map((w) => (
                  <option key={w} value={w}>
                    {w}%
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[12px] text-admin-muted">
              Align
              <select
                aria-label="Image alignment"
                value={block.align}
                onChange={(e) => onChange({ ...block, align: e.target.value as ImageAlign })}
                className={cn(INPUT, "w-auto")}
              >
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
        </div>
      );
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Button wording"
            value={block.label}
            placeholder="Button wording"
            onChange={(e) => onChange({ ...block, label: e.target.value })}
            className={INPUT}
          />
          <input
            aria-label="Button link"
            value={block.url}
            placeholder="https://…"
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            className={INPUT}
          />
        </div>
      );
    case "spacer":
      return (
        <label className="flex items-center gap-2 text-[12px] text-admin-muted">
          Height
          <select
            aria-label="Space height"
            value={block.size}
            onChange={(e) => onChange({ ...block, size: e.target.value as SpacerSize })}
            className={cn(INPUT, "w-auto")}
          >
            <option value="s">Small</option>
            <option value="m">Medium</option>
            <option value="l">Large</option>
          </select>
        </label>
      );
    case "divider":
      return <hr className="border-admin-line" />;
    case "system":
      return (
        <p className="text-[12px] leading-snug text-admin-muted">{SYSTEM_BLOCK_LABELS[block.key].hint}</p>
      );
  }
}

export function EmailBlocksEditor({
  blocks,
  onChange,
  onFocusInsert,
}: {
  blocks: EmailBlock[];
  onChange: (next: EmailBlock[]) => void;
  onFocusInsert: (insert: (text: string) => void) => void;
}) {
  const [addAt, setAddAt] = useState<number | null>(null);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(i, 1);
    next.splice(i + dir, 0, b);
    onChange(next);
  };

  const insert = (type: "text" | "image" | "button" | "divider" | "spacer", at: number) => {
    const next = [...blocks];
    next.splice(at, 0, newBlock(type));
    onChange(next);
    setAddAt(null);
  };

  const addMenu = (at: number, compact: boolean) => (
    <DropdownMenu open={addAt === at} onOpenChange={(open) => setAddAt(open ? at : null)}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-admin-primary transition-colors hover:bg-admin-primary-soft",
            compact ? "h-7 w-full opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100" : "h-11 w-full border border-dashed border-admin-primary/40 sm:h-10"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          {compact ? "Add here" : "Add a block"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48">
        <DropdownMenuItem onSelect={() => insert("text", at)}>
          <Type className="h-4 w-4" /> Text
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insert("image", at)}>
          <ImagePlus className="h-4 w-4" /> Image or logo
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insert("button", at)}>
          <MousePointerClick className="h-4 w-4" /> Button
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insert("divider", at)}>
          <Minus className="h-4 w-4" /> Divider
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => insert("spacer", at)}>
          <MoveVertical className="h-4 w-4" /> Space
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        const system = block.type === "system";
        return (
          <div key={block.id} className="group space-y-1">
            {addMenu(i, true)}
            <div
              className={cn(
                "rounded-2xl border p-3",
                system ? "border-dashed border-admin-line bg-admin-surface/60" : "border-admin-line bg-white"
              )}
            >
              <div className="mb-2 flex items-center gap-1">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-bold text-admin-ink">
                  {system && <Lock className="h-3.5 w-3.5 shrink-0 text-admin-muted" aria-hidden="true" />}
                  <span className="truncate">{system ? SYSTEM_BLOCK_LABELS[block.key].label : TYPE_LABEL[block.type]}</span>
                </span>
                <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={ICON_BUTTON}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  title="Move down"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, 1)}
                  className={ICON_BUTTON}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                {!system && (
                  <button
                    type="button"
                    aria-label="Remove block"
                    title="Remove block"
                    onClick={() => onChange(blocks.filter((b) => b.id !== block.id))}
                    className={cn(ICON_BUTTON, "hover:bg-admin-error-bg hover:text-admin-error")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <BlockBody
                block={block}
                onChange={(next) => onChange(blocks.map((b) => (b.id === block.id ? next : b)))}
                onFocusInsert={onFocusInsert}
              />
            </div>
          </div>
        );
      })}
      <div className="pt-2">{addMenu(blocks.length, false)}</div>
    </div>
  );
}
