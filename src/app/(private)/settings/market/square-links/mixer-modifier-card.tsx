"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGbp } from "@/lib/price";
import { isMixerList, type MixerChoice } from "@/lib/market/mixer";
import type { ModifierListOption } from "@/lib/market/square-mixers";
import { loadModifierListsAction, saveMixerChoiceAction } from "../actions";
import { CARD, NEUTRAL_BUTTON } from "../ui";

const SELECT =
  "h-11 w-full cursor-pointer rounded-lg border border-admin-line bg-admin-card px-2 text-[13px] font-semibold text-admin-ink outline-none disabled:opacity-60 sm:h-9 sm:max-w-md";

function choiceValue(choice: MixerChoice): string {
  return choice.mode === "list" ? `list:${choice.listId}` : choice.mode;
}

function listSummary(list: ModifierListOption): string {
  return [list.name, list.price != null ? formatGbp(list.price) : "no price", `${list.itemNames.length} items`].join(" · ");
}

function itemsLine(names: string[]): string {
  if (names.length === 0) return "not on any item yet";
  const shown = names.slice(0, 4).join(", ");
  return names.length > 4 ? `on ${shown} and ${names.length - 4} more` : `on ${shown}`;
}

function ListDetail({ list }: { list: ModifierListOption }) {
  return (
    <li className="text-[12px] text-admin-muted">
      <span className="font-semibold text-admin-ink">{list.name}</span>
      {" · "}
      {list.price != null ? `${formatGbp(list.price)} on the board` : "no price set"}
      {" · "}
      {list.modifierNames.length > 0 ? list.modifierNames.join(", ") : "no options"}
      {" · "}
      {itemsLine(list.itemNames)}
      {list.mixedPrices && list.price != null && (
        <span className="mt-0.5 block text-admin-warning">
          Options are priced differently; the board quotes the most common price, {formatGbp(list.price)}.
        </span>
      )}
    </li>
  );
}

/* Which Square modifier list the till uses for mixers. Saved the moment it
   changes, like the variation links below it, and a live market follows at
   once. */
export default function MixerModifierCard({
  choice,
  lists: initialLists,
}: {
  choice: MixerChoice;
  lists: ModifierListOption[] | null;
}) {
  const router = useRouter();
  const [lists, setLists] = useState(initialLists);
  const [value, setValue] = useState(choiceValue(choice));
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current: MixerChoice =
    value === "off"
      ? { mode: "off" }
      : value.startsWith("list:")
        ? { mode: "list", listId: value.slice(5), listName: choice.mode === "list" ? choice.listName : null }
        : { mode: "auto" };
  const inUse = (lists ?? []).filter((list) => isMixerList(list, current));
  const savedListMissing =
    choice.mode === "list" && !(lists ?? []).some((list) => list.id === choice.listId);

  function save(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await saveMixerChoiceAction(
        next.startsWith("list:") ? { mode: "list", listId: next.slice(5) } : { mode: next as "auto" | "off" }
      );
      if (result?.error) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success("Mixer setting saved.");
      router.refresh();
    });
  }

  async function retry() {
    setLoading(true);
    const result = await loadModifierListsAction();
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    setLists(result.lists ?? []);
  }

  return (
    <section className={cn(CARD, "space-y-3")} aria-labelledby="mixer-modifier-title">
      <div>
        <h2 id="mixer-modifier-title" className="text-[15px] font-bold text-admin-ink">
          Mixer for spirits
        </h2>
        <p className="mt-0.5 text-[12px] text-admin-muted">
          The Square modifier list the till adds to a spirit served with a mixer. The board and phone page show the
          spirit plus this price. The market only moves the spirit price and never changes the mixer in Square.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Square modifier list used for mixers"
          value={value}
          disabled={isPending}
          onChange={(event) => save(event.target.value)}
          className={SELECT}
        >
          <option value="auto">Automatic - any list with &ldquo;mixer&rdquo; in its name</option>
          {lists && lists.length > 0 && (
            <optgroup label="Always use this Square list">
              {lists.map((list) => (
                <option key={list.id} value={`list:${list.id}`}>
                  {listSummary(list)}
                </option>
              ))}
            </optgroup>
          )}
          {savedListMissing && choice.mode === "list" && (
            <option value={`list:${choice.listId}`}>{choice.listName ?? "Saved list"} (not found in Square)</option>
          )}
          <option value="off">None - only drinks ticked &ldquo;served with a mixer&rdquo;</option>
        </select>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-admin-muted" aria-label="Saving" />}
      </div>

      {lists === null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-admin-error-bg px-3 py-2 text-[12px]">
          <p className="text-admin-ink">
            <span className="font-semibold">Could not load Square&rsquo;s modifier lists.</span>{" "}
            <span className="text-admin-muted">The saved setting still applies.</span>
          </p>
          <button type="button" onClick={retry} disabled={loading} className={NEUTRAL_BUTTON}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            )}
            Retry
          </button>
        </div>
      ) : current.mode === "off" ? (
        <p className="text-[12px] text-admin-muted">
          Square&rsquo;s modifiers are ignored. Only drinks ticked &ldquo;served with a mixer&rdquo; on an event show a
          mixer, at that event&rsquo;s mixer price.
        </p>
      ) : inUse.length > 0 ? (
        <ul className="m-0 list-none space-y-1 p-0">
          {inUse.map((list) => (
            <ListDetail key={list.id} list={list} />
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-2 text-[12px] text-admin-warning">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {current.mode === "auto"
            ? "No Square modifier list has “mixer” in its name. Pick the list your till uses for mixers."
            : "That list is no longer in Square. Pick the list your till uses for mixers."}
        </p>
      )}
    </section>
  );
}
