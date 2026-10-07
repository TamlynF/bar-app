"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

export function EmailVersionNamePanel({
  title,
  initialName = "",
  submitLabel,
  onSubmit,
  onDone,
}: {
  title: string;
  initialName?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<{ error?: string } | undefined | void>;
  onDone: () => void;
}) {
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(name);
      if (result && "error" in result && result.error) setError(result.error);
      else onDone();
    });
  };

  return (
    <form
      className="w-72 space-y-2.5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={inputId} className="block text-[13px] font-bold text-admin-ink">
        {title}
      </label>
      <input
        id={inputId}
        autoFocus
        value={name}
        maxLength={60}
        placeholder="e.g. Quiz Night"
        onChange={(e) => setName(e.target.value)}
        className="h-11 w-full rounded-xl border border-admin-line bg-white px-3 text-sm text-admin-ink outline-none focus:border-admin-primary"
      />
      {error && <p className="text-[12px] leading-snug text-admin-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex h-11 items-center rounded-xl border border-[#D8D5C8] px-3 text-[13px] font-semibold text-[#5E6654] hover:bg-[#ECE9DE] sm:h-9"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="flex h-11 items-center gap-1.5 rounded-xl bg-[#34451F] px-3.5 text-[13px] font-semibold text-white hover:bg-[#283719] disabled:opacity-50 sm:h-9"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
