"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, ChevronDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatGbp } from "@/lib/price";
import { refreshPriceInsightsAction, updateComparisonAreaAction } from "./actions";
import { buildMenuComparison, buildVenueMatrix, rankedVenues } from "../lib/compare";
import { TrendCard } from "../trends/trend-card";
import type { BenchmarkComparison } from "../lib/compare";
import type { CompetitorPrice, MarketingTrend, MenuItemLite, TrendState } from "../lib/types";

type PriceView = "summary" | "byVenue";
type CompareMode = "rounds" | "menu";

const MAX_VENUES = 4;

const rowKey = (c: BenchmarkComparison) => c.rowId ?? c.key;

function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short" });
}

/* The numbers behind a verdict: the median it was measured against, then the
   spread and the mean that the median deliberately ignores. */
function RoundDetail({
  row,
  breakdown,
  className,
}: {
  row: BenchmarkComparison;
  breakdown: { venue: string; price: number }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11.5px] leading-snug text-[#5E6654]">
        Typical <span className="font-semibold text-[#20231A] tabular-nums">{formatGbp(row.competitorMedian)}</span>
        {row.competitorMin != null && row.competitorMax != null && (
          <>
            {" "}
            · range{" "}
            <span className="tabular-nums">
              {formatGbp(row.competitorMin)}–{formatGbp(row.competitorMax)}
            </span>
          </>
        )}
        {row.competitorAvg != null && (
          <>
            {" "}
            · avg <span className="tabular-nums">{formatGbp(row.competitorAvg)}</span>
          </>
        )}{" "}
        <span className="text-[#5E6654]/70">
          from {row.sampleCount} {row.sampleCount === 1 ? "price" : "prices"}
        </span>
      </p>
      <p className="mb-1.5 font-bold text-[10.5px] tracking-[0.06em] text-[#5E6654] uppercase">
        The breakdown — venue by venue
      </p>
      {breakdown.length === 0 ? (
        <p className="py-1 text-[12px] text-[#5E6654]/70">No venue prices matched this round yet.</p>
      ) : (
        breakdown.map((b) => {
          const under = row.ownPrice != null && row.ownPrice < b.price;
          return (
            <div
              key={b.venue}
              className="grid grid-cols-[minmax(0,1fr)_58px] items-baseline gap-2 border-t border-[#D8D5C8]/60 py-1.5"
            >
              <span className="min-w-0 text-[12.5px] leading-tight font-semibold text-[#20231A]">
                {b.venue}{" "}
                {row.ownPrice != null && (
                  <span className={cn("text-[10.5px] font-normal", under ? "text-[#22613F]" : "text-[#B33A32]")}>
                    {under
                      ? `you're ${formatGbp(b.price - row.ownPrice)} under`
                      : `they're ${formatGbp(row.ownPrice - b.price)} under`}
                  </span>
                )}
              </span>
              <span className="text-right font-semibold text-[12.5px] text-[#5E6654] tabular-nums">
                {formatGbp(b.price)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function PricesClient({
  area,
  radius,
  lastRefresh,
  comparison,
  competitorPrices,
  menuItems,
  priceTrends,
  onSetTrendState,
  pendingTrendId,
}: {
  area: string;
  radius: string | null;
  lastRefresh: string | null;
  comparison: BenchmarkComparison[];
  competitorPrices: CompetitorPrice[];
  menuItems: MenuItemLite[];
  priceTrends: MarketingTrend[];
  onSetTrendState: (id: string, state: TrendState) => void;
  pendingTrendId: string | null;
}) {
  const [isRefreshing, startRefresh] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [view, setView] = useState<PriceView>("summary");
  const [compareMode, setCompareMode] = useState<CompareMode>("rounds");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedRounds, setPickedRounds] = useState<string[] | null>(null);
  const [pickedMenu, setPickedMenu] = useState<string[] | null>(null);
  const [pickedVenues, setPickedVenues] = useState<string[] | null>(null);
  const [openRowKey, setOpenRowKey] = useState<string | null>(null);

  const allVenues = useMemo(() => rankedVenues(competitorPrices), [competitorPrices]);
  const shownVenues = useMemo(() => {
    if (pickedVenues == null) return allVenues.slice(0, MAX_VENUES);
    const kept = pickedVenues.filter((v) => allVenues.includes(v));
    return (kept.length ? kept : allVenues.slice(0, MAX_VENUES)).slice(0, MAX_VENUES);
  }, [pickedVenues, allVenues]);

  // One row per real menu item, measured against the local benchmark its name
  // matches. Items with no local match (or no readable price) stay off by
  // default but can be ticked on.
  const menuRows = useMemo(
    () => buildMenuComparison(competitorPrices, menuItems),
    [competitorPrices, menuItems],
  );
  const defaultMenuRows = useMemo(
    () => menuRows.filter((r) => r.matchLabel && r.ownPrice != null),
    [menuRows],
  );

  const shownComparison = useMemo(() => {
    if (compareMode === "menu") {
      return pickedMenu == null ? defaultMenuRows : menuRows.filter((r) => pickedMenu.includes(rowKey(r)));
    }
    return pickedRounds == null ? comparison : comparison.filter((c) => pickedRounds.includes(c.key));
  }, [compareMode, comparison, pickedRounds, pickedMenu, menuRows, defaultMenuRows]);

  const menuByCategory = useMemo(() => {
    const groups = new Map<string, BenchmarkComparison[]>();
    menuRows.forEach((r) => {
      const cat = r.ownItemName ?? "Uncategorised";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(r);
    });
    return [...groups.entries()];
  }, [menuRows]);

  const subLabel = (c: BenchmarkComparison) => {
    if (compareMode === "menu") {
      return [c.ownItemName, c.matchLabel ? `vs local ${c.matchLabel}` : "no local match"]
        .filter(Boolean)
        .join(" · ");
    }
    if (!c.ownItemName) return "nothing on your menu matched";
    return (c.ownPoolSize ?? 1) > 1
      ? `your ${c.ownItemName} · typical of ${c.ownPoolSize}`
      : `your ${c.ownItemName}`;
  };

  const matrix = buildVenueMatrix(competitorPrices, shownComparison, shownVenues);
  const fullMatrix = useMemo(
    () => buildVenueMatrix(competitorPrices, comparison, allVenues),
    [competitorPrices, comparison, allVenues],
  );

  const scored = shownComparison.filter(
    (c) => c.ownPrice != null && c.competitorMedian != null && c.sampleCount > 0,
  );
  const yourScore = scored.filter((c) => (c.ownPrice as number) < (c.competitorMedian as number)).length;
  const localScore = scored.length - yourScore;

  const scoreLine =
    scored.length === 0
      ? "No local prices yet — give the button below a smash and we'll go looking."
      : yourScore === scored.length
        ? `You're the cheaper round on all ${scored.length}. Clean sweep. 🎉`
        : yourScore === 0
          ? `The locals are cheaper on all ${scored.length} right now. Time for a rethink.`
          : `You're the cheaper round on ${yourScore} of ${scored.length}. ${
              yourScore > localScore ? "Crowd goes wild. 🎉" : "Room to fight back."
            }`;

  const toggleRound = (key: string) => {
    setPickedRounds((prev) => {
      const base = prev ?? comparison.map((c) => c.key);
      if (base.includes(key)) {
        const next = base.filter((k) => k !== key);
        return next.length ? next : base;
      }
      return [...base, key];
    });
  };

  const toggleMenuItem = (id: string) => {
    setPickedMenu((prev) => {
      const base = prev ?? defaultMenuRows.map(rowKey);
      if (base.includes(id)) {
        const next = base.filter((k) => k !== id);
        return next.length ? next : base;
      }
      return [...base, id];
    });
  };

  const toggleVenue = (venue: string) => {
    setPickedVenues((prev) => {
      const base = prev ?? allVenues.slice(0, MAX_VENUES);
      if (base.includes(venue)) return base.filter((v) => v !== venue);
      if (base.length >= MAX_VENUES) return base;
      return [...base, venue];
    });
  };

  const breakdownFor = (key: string) => {
    const row = fullMatrix.rows.find((r) => r.key === key);
    if (!row) return [];
    return allVenues
      .map((venue, i) => ({ venue, price: row.cells[i] }))
      .filter((x): x is { venue: string; price: number } => x.price != null)
      .sort((a, b) => a.price - b.price);
  };

  const handleRefresh = () => {
    startRefresh(async () => {
      const result = await refreshPriceInsightsAction();
      if ("error" in result) toast.error(result.error);
      else
        toast.success(
          `Updated ${result.priceCount} price${result.priceCount === 1 ? "" : "s"} · ${result.ideaCount} new idea${result.ideaCount === 1 ? "" : "s"}.`,
        );
    });
  };

  const handleSaveArea = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      const result = await updateComparisonAreaAction(formData);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Comparison area updated.");
        setIsEditing(false);
      }
    });
  };

  const changeAreaButton = (className: string) => (
    <button type="button" onClick={() => setIsEditing(true)} className={className}>
      ✏️ Change area
    </button>
  );

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* ---- Score banner */}
      {isEditing ? (
        <form onSubmit={handleSaveArea} className="space-y-3 rounded-[20px] border border-[#D8D5C8] bg-[#FFFEFA] p-5">
          <p className="font-bold text-[15px] text-[#20231A]">Who are we up against?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="font-semibold text-[12px] text-[#5E6654]">Area / town</span>
              <input
                name="comparison_area"
                defaultValue={area}
                required
                placeholder="e.g. Hinckley"
                className="mt-1 h-11 w-full rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 text-sm font-semibold text-[#20231A] outline-none focus:border-[#34451F]"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-[12px] text-[#5E6654]">Radius (optional)</span>
              <input
                name="comparison_radius"
                defaultValue={radius ?? ""}
                placeholder="e.g. 5 miles"
                className="mt-1 h-11 w-full rounded-xl border border-[#D8D5C8] bg-[#F4F1E8] px-3 text-sm font-semibold text-[#20231A] outline-none focus:border-[#34451F]"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="h-11 rounded-xl border border-[#D8D5C8] bg-white px-4 font-semibold text-[13px] text-[#5E6654]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex h-11 items-center gap-2 rounded-xl bg-[#34451F] px-5 font-bold text-[13px] text-white hover:bg-[#283719] disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save area
            </button>
          </div>
          <p className="text-[11px] text-[#5E6654]/70">
            Changed the area? Rerun the price-off afterwards to pull prices for the new patch.
          </p>
        </form>
      ) : (
        <section className="rounded-[20px] bg-[#263019] p-4 text-[#DDE2D1] sm:p-5">
          <p className="text-center font-semibold text-[11px] tracking-[0.15em] text-[#AEB69D] uppercase sm:hidden">
            The {area} price-off
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
            <div className="mt-2 flex items-center justify-center gap-5 sm:mt-0 sm:gap-6">
              <div className="text-center">
                <p className="font-bold text-[12.5px] sm:text-[13px]">You</p>
                <p className="text-[38px] leading-none font-extrabold text-[#D7A928] tabular-nums sm:text-[44px]">
                  {yourScore}
                </p>
              </div>
              <p className="font-bold text-[15px] text-[#AEB69D] sm:text-base">vs</p>
              <div className="text-center">
                <p className="font-bold text-[12.5px] sm:text-[13px]">The locals</p>
                <p className="text-[38px] leading-none font-extrabold text-[#AEB69D] tabular-nums sm:text-[44px]">
                  {localScore}
                </p>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="hidden font-bold text-[15px] sm:block">
                The {area} price-off · updated {formatWhen(lastRefresh)}
              </p>
              <p className="text-center text-[12px] leading-[1.45] text-[#AEB69D] sm:mt-1 sm:text-left sm:text-[13px]">
                {scoreLine}
              </p>
            </div>
            {changeAreaButton(
              "hidden h-10 shrink-0 items-center gap-2 rounded-[10px] border border-[#AEB69D]/40 px-3.5 font-semibold text-[12.5px] text-[#DDE2D1] transition-colors hover:bg-[#34451F] sm:flex",
            )}
          </div>
        </section>
      )}

      {/* ---- Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="hidden font-semibold text-[13px] text-[#5E6654] sm:inline">Compare:</span>
        <div className="flex overflow-hidden rounded-[10px] border border-[#D8D5C8] bg-white">
          {(
            [
              { mode: "rounds" as const, label: "Standard rounds" },
              { mode: "menu" as const, label: "My menu" },
            ]
          ).map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => {
                setCompareMode(m.mode);
                setOpenRowKey(null);
              }}
              aria-pressed={compareMode === m.mode}
              className={cn(
                "flex h-10 items-center px-4 text-[13px] transition-colors sm:h-9.5",
                compareMode === m.mode
                  ? "bg-[#34451F] font-bold text-white"
                  : "font-semibold text-[#5E6654] hover:bg-[#F4F1E8]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <span className="hidden font-semibold text-[13px] text-[#5E6654] sm:inline">View:</span>
        <div className="flex overflow-hidden rounded-[10px] border border-[#D8D5C8] bg-white">
          {(["summary", "byVenue"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              aria-pressed={view === m}
              className={cn(
                "flex h-10 items-center px-4 text-[13px] transition-colors sm:h-9.5",
                view === m ? "bg-[#34451F] font-bold text-white" : "font-semibold text-[#5E6654] hover:bg-[#F4F1E8]",
              )}
            >
              {m === "summary" ? "Average" : "By venue"}
            </button>
          ))}
        </div>

        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            className="flex h-10 items-center gap-2 rounded-[10px] border border-[#34451F] bg-white px-3.5 font-semibold text-[12.5px] text-[#34451F] transition-colors hover:bg-[#E5EBD8] sm:h-9.5"
          >
            🎛 Choose items
          </button>

          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-[#D8D5C8] bg-white shadow-lg">
                <div className="flex items-center justify-between gap-2 border-b border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2">
                  <span className="font-bold text-[11px] text-[#34451F]">
                    {compareMode === "menu" ? "Menu items to compare" : "Rounds to compare"}
                  </span>
                  {(compareMode === "menu" ? pickedMenu : pickedRounds) != null && (
                    <button
                      type="button"
                      onClick={() => (compareMode === "menu" ? setPickedMenu(null) : setPickedRounds(null))}
                      className="font-semibold text-[11px] text-[#5E6654] hover:text-[#34451F]"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {compareMode === "menu" ? (
                  <div className="max-h-72 overflow-y-auto p-1">
                    {menuByCategory.length === 0 ? (
                      <p className="px-3 py-4 text-[12px] text-[#5E6654]/70">
                        No active menu items found — add them under Settings → Menu.
                      </p>
                    ) : (
                      menuByCategory.map(([category, rows]) => (
                        <div key={category}>
                          <p className="px-2 pt-2 pb-1 font-bold text-[10.5px] tracking-[0.06em] text-[#5E6654] uppercase">
                            {category}
                          </p>
                          {rows.map((r) => {
                            const id = rowKey(r);
                            const picked = pickedMenu == null ? defaultMenuRows.includes(r) : pickedMenu.includes(id);
                            return (
                              <label
                                key={id}
                                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F4F1E8]"
                              >
                                <input
                                  type="checkbox"
                                  checked={picked}
                                  onChange={() => toggleMenuItem(id)}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#34451F]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[12.5px] font-semibold text-[#20231A]">
                                    {r.label}
                                  </span>
                                  <span className="block truncate text-[10.5px] text-[#5E6654]/80">
                                    {r.matchLabel ? `vs local ${r.matchLabel}` : "no local match"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[11.5px] font-semibold text-[#5E6654] tabular-nums">
                                  {formatGbp(r.ownPrice)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto p-1">
                    {comparison.map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#F4F1E8]"
                      >
                        <input
                          type="checkbox"
                          checked={pickedRounds == null || pickedRounds.includes(c.key)}
                          onChange={() => toggleRound(c.key)}
                          className="h-3.5 w-3.5 shrink-0 accent-[#34451F]"
                        />
                        <span className="min-w-0 truncate text-[12.5px] font-semibold text-[#20231A]">{c.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {view === "byVenue" && allVenues.length > 0 && (
                  <>
                    <p className="border-t border-[#D8D5C8] bg-[#F4F1E8] px-3 py-2 font-bold text-[11px] text-[#34451F]">
                      Venues shown ({shownVenues.length}/{MAX_VENUES})
                    </p>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {allVenues.map((v) => {
                        const checked = shownVenues.includes(v);
                        const atCap = shownVenues.length >= MAX_VENUES;
                        return (
                          <label
                            key={v}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2",
                              !checked && atCap ? "cursor-not-allowed opacity-40" : "hover:bg-[#F4F1E8]",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!checked && atCap}
                              onChange={() => toggleVenue(v)}
                              className="h-3.5 w-3.5 shrink-0 accent-[#34451F]"
                            />
                            <span className="min-w-0 truncate text-[12.5px] font-semibold text-[#20231A]">{v}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {changeAreaButton(
          "flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#D8D5C8] bg-white px-3.5 font-semibold text-[12.5px] text-[#5E6654] sm:hidden",
        )}
      </div>

      {/* ---- Chosen item chips */}
      <div className="hidden flex-wrap gap-1.5 sm:flex">
        {shownComparison.map((c) => (
          <span
            key={rowKey(c)}
            className="flex items-center gap-1.5 rounded-full border border-[#BFD8C4] bg-[#E7F3EC] px-3 py-1 font-semibold text-[12px] text-[#22613F]"
          >
            ✓ {c.label}
          </span>
        ))}
        {shownComparison.length < comparison.length && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#D8D5C8] bg-white px-3 py-1 font-semibold text-[12px] text-[#5E6654] hover:bg-[#F4F1E8]"
          >
            + Add more
          </button>
        )}
      </div>

      {/* ---- The board */}
      {competitorPrices.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#D8D5C8] px-4 py-12 text-center">
          <p className="text-2xl" aria-hidden="true">
            🏆
          </p>
          <p className="mt-2 font-bold text-sm text-[#20231A]">No local prices yet</p>
          <p className="mt-1 text-[12px] text-[#5E6654]">
            {`Rerun the price-off below and we'll go and find what ${area} is charging.`}
          </p>
        </section>
      ) : (
        <>
          {/* Desktop: by-venue matrix or average */}
          <section className="hidden overflow-hidden rounded-2xl border border-[#D8D5C8] bg-[#FFFEFA] sm:block">
            {view === "byVenue" ? (
              matrix.venues.length === 0 ? (
                <p className="px-5 py-6 text-[12px] text-[#5E6654]/70">
                  No venue could be matched to your rounds yet — try the Average view or rerun the price-off.
                </p>
              ) : (
                <div
                  style={
                    {
                      "--price-cols": `1.4fr 90px repeat(${matrix.venues.length}, minmax(0,1fr))`,
                    } as React.CSSProperties
                  }
                >
                  <div className="grid grid-cols-(--price-cols) gap-2 border-b border-[#D8D5C8] bg-[#F4F1E8] px-5 py-3 font-semibold text-[11px] tracking-[0.06em] text-[#5E6654] uppercase">
                    <span>Round</span>
                    <span className="text-right text-[#34451F]">You</span>
                    {matrix.venues.map((v) => (
                      <span key={v} className="truncate text-right">
                        {v}
                      </span>
                    ))}
                  </div>
                  {matrix.rows.map((row, ri) => (
                    <div
                      key={rowKey(shownComparison[ri] ?? row)}
                      className="grid grid-cols-(--price-cols) items-center gap-2 border-b border-[#D8D5C8]/60 px-5 py-3 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold text-[14px] text-[#20231A]">{row.label}</span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-[#5E6654]/80">
                          {shownComparison[ri] ? subLabel(shownComparison[ri]) : ""}
                        </span>
                      </span>
                      <span className="text-right font-bold text-[15px] text-[#22613F] tabular-nums">
                        {row.ownPrice == null ? (
                          <span className="text-[#5E6654]/45">—</span>
                        ) : (
                          formatGbp(row.ownPrice)
                        )}
                      </span>
                      {row.cells.map((c, i) => (
                        <span key={i} className="text-right font-medium text-[13.5px] text-[#5E6654] tabular-nums">
                          {c == null ? <span className="text-[#5E6654]/45">—</span> : formatGbp(c)}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )
            ) : (
              shownComparison.map((c) => {
                const hasData = c.sampleCount > 0 && c.competitorMedian != null;
                const winning = hasData && c.ownPrice != null && c.ownPrice < (c.competitorMedian as number);
                const open = openRowKey === rowKey(c);
                return (
                  <div
                    key={rowKey(c)}
                    className={cn("border-b border-[#D8D5C8]/60 last:border-b-0", open && "bg-[#F4F1E8]")}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenRowKey(open ? null : rowKey(c))}
                      disabled={!hasData}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left disabled:cursor-default"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-[14px] text-[#20231A]">
                          {c.label} {winning && <span aria-hidden="true">🏆</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-[#5E6654]/80">
                          {subLabel(c)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "w-20 text-right font-bold text-[15px] tabular-nums",
                          winning ? "text-[#22613F]" : "text-[#20231A]",
                        )}
                      >
                        {c.ownPrice == null ? <span className="text-[#5E6654]/45">—</span> : formatGbp(c.ownPrice)}
                      </span>
                      <span className="w-24 text-right font-medium text-[13.5px] text-[#5E6654] tabular-nums">
                        {hasData ? `vs ${formatGbp(c.competitorMedian)}` : "—"}
                      </span>
                      <span
                        className={cn(
                          "w-28 text-right font-semibold text-[12.5px]",
                          winning ? "text-[#22613F]" : "text-[#8A8D7A]",
                        )}
                      >
                        {winning ? "You win 🏆" : hasData ? "They win" : "No match yet"}
                      </span>
                      {hasData ? (
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-[#5E6654] transition-transform",
                            open && "rotate-180 text-[#34451F]",
                          )}
                        />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                    </button>
                    {open && <RoundDetail row={c} breakdown={breakdownFor(c.key)} className="px-5 pb-3" />}
                  </div>
                );
              })
            )}
          </section>

          {/* Mobile: fixed columns so every price lines up */}
          <section className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-[#FFFEFA] sm:hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_58px_58px_24px] gap-2 border-b border-[#D8D5C8] bg-[#F4F1E8] px-3.5 py-2.5 font-semibold text-[10.5px] tracking-[0.06em] text-[#5E6654] uppercase">
              <span>Round</span>
              <span className="text-right text-[#34451F]">You</span>
              <span className="text-right">Them</span>
              <span />
            </div>
            {shownComparison.map((c) => {
              const hasData = c.sampleCount > 0 && c.competitorMedian != null;
              const winning = hasData && c.ownPrice != null && c.ownPrice < (c.competitorMedian as number);
              const open = openRowKey === rowKey(c);
              const breakdown = open ? breakdownFor(c.key) : [];
              return (
                <div key={rowKey(c)} className={cn("border-b border-[#D8D5C8]/60 last:border-b-0", open && "bg-[#F4F1E8]")}>
                  <button
                    type="button"
                    onClick={() => setOpenRowKey(open ? null : rowKey(c))}
                    disabled={!hasData}
                    aria-expanded={open}
                    className="grid w-full grid-cols-[minmax(0,1fr)_58px_58px_24px] items-center gap-2 px-3.5 py-3 text-left disabled:cursor-default"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-tight font-bold text-[#20231A]">
                        {c.label} {winning && <span aria-hidden="true">🏆</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[#5E6654]/80">
                        {subLabel(c)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-right font-bold text-[13.5px] tabular-nums",
                        winning ? "text-[#22613F]" : "text-[#20231A]",
                      )}
                    >
                      {c.ownPrice == null ? <span className="text-[#5E6654]/45">—</span> : formatGbp(c.ownPrice)}
                    </span>
                    <span className="text-right font-medium text-[12.5px] text-[#5E6654] tabular-nums">
                      {hasData ? formatGbp(c.competitorMedian) : <span className="text-[#5E6654]/45">—</span>}
                    </span>
                    {hasData ? (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 justify-self-end text-[#5E6654] transition-transform",
                          open && "rotate-180 text-[#34451F]",
                        )}
                      />
                    ) : (
                      <span />
                    )}
                  </button>

                  {open && <RoundDetail row={c} breakdown={breakdown} className="px-3.5 pb-3" />}
                </div>
              );
            })}
          </section>

          {view !== "byVenue" && (
            <p className="text-center text-[11px] text-[#5E6654]/60">
              Tap any row for the spread and the venue-by-venue breakdown.
            </p>
          )}
        </>
      )}

      {/* ---- Footer actions */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex h-12.5 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#34451F] font-bold text-[14px] text-white transition-colors hover:bg-[#283719] active:scale-[0.98] disabled:opacity-60 sm:h-12 sm:rounded-xl"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <span aria-hidden="true">⚡</span>}
          {isRefreshing ? "Running the price-off…" : "Rerun the price-off"}
        </button>
        {competitorPrices.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            aria-expanded={showRaw}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#D8D5C8] bg-white px-4.5 font-semibold text-[13px] text-[#5E6654] transition-colors hover:bg-[#F4F1E8]"
          >
            See all {competitorPrices.length} sourced prices
            <ChevronDown className={cn("h-4 w-4 transition-transform", showRaw && "rotate-180")} />
          </button>
        )}
      </div>

      {isRefreshing && (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#34451F]" />
          <p className="mt-2 font-semibold text-[12px] text-[#5E6654]">Reading the local price wind…</p>
        </div>
      )}

      {showRaw && competitorPrices.length > 0 && (
        <section className="divide-y divide-[#D8D5C8]/60 overflow-hidden rounded-2xl border border-[#D8D5C8] bg-[#FFFEFA]">
          {competitorPrices.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#20231A]">{p.item_name}</p>
                <p className="truncate text-[11px] text-[#5E6654]/70">
                  {p.venue_name}
                  {p.item_type ? ` · ${p.item_type}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-bold text-[13px] text-[#20231A] tabular-nums">
                {p.price_text || formatGbp(p.price_amount)}
              </span>
              {p.source_url && (
                <a
                  href={p.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Source for ${p.item_name} at ${p.venue_name}`}
                  title="View source"
                  className="shrink-0 text-[#34451F] hover:opacity-70"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      <p className="text-center text-[11px] text-[#5E6654]/60">
        Friendly competition only — prices are AI-estimated from the web. Empty cells mean no price found for that
        venue yet.
      </p>

      {priceTrends.length > 0 && (
        <div className="space-y-3 pt-1">
          <p className="font-bold text-[13px] text-[#34451F]">Price plays worth nicking</p>
          <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
            {priceTrends.map((t, i) => (
              <TrendCard
                key={t.id}
                trend={t}
                index={i}
                pending={pendingTrendId === t.id}
                onSetState={onSetTrendState}
              />
            ))}
          </div>
        </div>
      )}

      <div className="pb-4" />
    </div>
  );
}
