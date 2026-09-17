import Link from "next/link";
import {
  ArrowRight,
  Flame,
  Gauge,
  ListOrdered,
  Percent,
  ShoppingCart,
  Target,
} from "lucide-react";
import { formatGbp } from "@/lib/price";
import {
  gapClosedPct,
  heatDecaySeries,
  paceBreakdown,
  priceWalk,
  rankExample,
  ticksUntilRerank,
  tierBandRows,
  type PaceBreakdown,
} from "@/lib/market/tier-explainer";
import type { MarketConfig } from "@/lib/market/types";

export type ExplainerDrink = {
  id: number;
  name: string;
  serve: string;
  basePrice: number;
  currentPrice: number;
  normalUnitsPerNight: number | null;
  heat: number;
  pace: number | null;
  rankPos: number | null;
  tierPct: number | null;
  targetPrice: number | null;
};

export type ExplainerSession = {
  eventName: string | null;
  tickNo: number;
  unitsSoldTotal: number;
  warmedUp: boolean;
  drinkCount: number;
};

function pct(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function times(value: number): string {
  return `${value.toFixed(2)}×`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
      <h2 className="text-base font-bold text-admin-ink">{title}</h2>
      {lead && <p className="mt-1 text-[13px] leading-relaxed text-admin-muted">{lead}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  question,
  formula,
  why,
  children,
}: {
  number: number;
  icon: typeof Flame;
  title: string;
  question: string;
  formula: string;
  why: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-admin-primary-soft text-admin-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
            Step {number}
          </p>
          <h2 className="text-base font-bold text-admin-ink">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-admin-ink">{question}</p>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-xl bg-admin-surface px-3 py-2">
          <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
            Worked out as
          </p>
          <p className="mt-0.5 font-mono text-[12px] leading-relaxed text-admin-ink">{formula}</p>
        </div>
        {children}
        <p className="text-[13px] leading-relaxed text-admin-muted">
          <span className="font-semibold text-admin-ink">Why: </span>
          {why}
        </p>
      </div>
    </section>
  );
}

function Sum({ lines }: { lines: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-admin-line/60 rounded-xl border border-admin-line">
      {lines.map((line) => (
        <div key={line.label} className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-[13px] text-admin-muted">{line.label}</dt>
          <dd className="text-[13px] font-semibold text-admin-ink tabular-nums">{line.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExampleTag({ live }: { live: boolean }) {
  return (
    <p className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
      {live ? "Tonight's numbers" : "Example numbers"}
    </p>
  );
}

function PaceSum({ drink, breakdown }: { drink: ExplainerDrink; breakdown: PaceBreakdown }) {
  return (
    <Sum
      lines={[
        { label: `${drink.name} heat right now`, value: breakdown.heat.toFixed(2) },
        {
          label: "Normally sells per night",
          value: `${breakdown.normalPerNight} ${plural(breakdown.normalPerNight, "drink", "drinks")}`,
        },
        ...(breakdown.floorApplied
          ? [{ label: "Floored up to (too rare to trust)", value: `${breakdown.usedPerNight} drinks` }]
          : []),
        {
          label: `Normal per tick (÷ ${breakdown.ticksPerNight} ticks a night)`,
          value: breakdown.normalPerTick.toFixed(3),
        },
        {
          label: "Pace = heat ÷ normal per tick",
          value: times(breakdown.pace),
        },
      ]}
    />
  );
}

export default function LeaderboardExplainer({
  config,
  session,
  drinks,
  live,
  tiersOn,
}: {
  config: MarketConfig;
  session: ExplainerSession | null;
  drinks: ExplainerDrink[];
  live: boolean;
  tiersOn: boolean;
}) {
  const bands = tierBandRows(config);
  const topBand = bands[0];
  const ranked = [...drinks].sort(
    (a, b) => (a.rankPos ?? Number.MAX_SAFE_INTEGER) - (b.rankPos ?? Number.MAX_SAFE_INTEGER)
  );
  const star = ranked[0] ?? null;
  const starPace = star ? paceBreakdown(star.heat, star.normalUnitsPerNight, config) : null;

  const tickMinutes = Math.round((config.tickIntervalSec / 60) * 10) / 10;
  const nightHours =
    Math.round(((config.sessionTicksHint * config.tickIntervalSec) / 3600) * 10) / 10;
  const tickWord = config.tickIntervalSec === 60 ? "minute" : `${config.tickIntervalSec} seconds`;
  const decay = heatDecaySeries([5, 0, 0, 0, 0, 0], config.decayK);
  const steady = heatDecaySeries(Array(12).fill(2), config.decayK);
  const glideDemo = star
    ? priceWalk(
        star.basePrice,
        star.basePrice,
        star.basePrice * (1 + (topBand?.up ?? 0.3)),
        config,
        5
      )
    : priceWalk(5, 5, 5 * (1 + (topBand?.up ?? 0.3)), config, 5);

  const busy = rankExample("Cocktail", 1, 12, 7.5, config);
  const quiet = rankExample("Pint of lager", 1, 60, 4.75, config);
  const rare = rankExample("Bottle of wine", 1, 1, 24, config);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-2 py-3 sm:px-4 sm:py-0 md:px-6">
      <section className="rounded-2xl border border-admin-line bg-admin-card p-4 sm:p-5">
        <h1 className="text-lg font-bold text-admin-ink">How the leaderboard works</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-admin-ink">
          Every {tickWord} each drink gets a buzz score from what just sold, which fades over the
          following few ticks. We compare that buzz with what the drink{" "}
          <span className="font-semibold">normally</span> does, so a cocktail having a big night can
          beat a pint having an ordinary one. Every {config.rerankEveryTicks} ticks the drinks are
          sorted on that comparison: the fastest movers go up, the quietest come down. Prices never
          jump — they walk to the new level over a few ticks. Nothing moves at all until the bar has
          sold {config.warmupUnits} drinks.
        </p>
        {session ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-admin-muted">
            <span className="rounded-full bg-admin-primary-soft px-2 py-1 font-semibold text-admin-primary">
              {session.eventName ?? "Live market"}
            </span>
            <span>Tick {session.tickNo}</span>
            <span aria-hidden="true">·</span>
            <span>{session.drinkCount} drinks trading</span>
            <span aria-hidden="true">·</span>
            <span>{session.unitsSoldTotal} sold so far</span>
            <span aria-hidden="true">·</span>
            <span>
              {session.warmedUp
                ? `Next re-rank in ${ticksUntilRerank(session.tickNo, config.rerankEveryTicks)} ${plural(
                    ticksUntilRerank(session.tickNo, config.rerankEveryTicks),
                    "tick",
                    "ticks"
                  )}`
                : `Warming up — ${Math.max(0, config.warmupUnits - session.unitsSoldTotal)} more drinks before tiers start`}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-admin-muted">
            No market is open, so the numbers below are worked examples using the settings from the
            last market night. Open a market and this page fills with the real thing.
          </p>
        )}
        {!tiersOn && (
          <p className="mt-3 rounded-xl bg-admin-warning-bg px-3 py-2 text-[12px] leading-relaxed text-admin-warning">
            The event that is open is using the demand engine, not the tier leaderboard. This page
            still explains the leaderboard, but the prices on the board tonight are being set the
            other way.
          </p>
        )}
      </section>

      <Section
        title="The five words worth knowing"
        lead="Everything on this page is built out of these, in this order."
      >
        <dl className="grid gap-2 sm:grid-cols-2">
          {[
            { term: "Units", meaning: "How many of a drink sold in one tick. The only real-world number — everything else is worked out from it." },
            { term: "Heat", meaning: "Recent sales, fading a little each tick. Busy a few ticks ago still counts for something; busy two hours ago does not." },
            { term: "Pace", meaning: "Heat compared with what this drink normally sells. 1.00× is a normal night for it, 2.00× is twice as busy." },
            { term: "Rank", meaning: "Every drink lined up by pace, fastest first. Rank 1 is the drink having the most unusual night." },
            { term: "Tier", meaning: "The price move a rank earns, as a percentage of the drink's normal menu price." },
          ].map((item) => (
            <div key={item.term} className="rounded-xl border border-admin-line px-3 py-2">
              <dt className="text-[13px] font-bold text-admin-ink">{item.term}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-admin-muted">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Step
        number={1}
        icon={ShoppingCart}
        title="Units — what actually sold"
        question={`Every ${tickWord} the market reads the till and asks one question per drink: how many went out since the last look?`}
        formula="units = completed Square sales since the last tick"
        why="This is the only figure that comes from the real world. If the till says nothing sold, nothing sold — there is no guesswork anywhere in the chain."
      >
        <p className="text-[13px] leading-relaxed text-admin-muted">
          A tick is {tickMinutes === 1 ? "one minute" : `${tickMinutes} minutes`} long on this event,
          and the night is treated as {config.sessionTicksHint} ticks — about {nightHours}{" "}
          {plural(nightHours, "hour", "hours")} of trading. That length matters in step 3.
        </p>
      </Step>

      <Step
        number={2}
        icon={Flame}
        title="Heat — sales that fade"
        question="Adding up the whole night would make an 8pm rush still look busy at 11pm. Looking only at the last tick would jump about from tick to tick. Heat sits in between: keep part of last tick's heat, then add this tick's units."
        formula={`heat = last heat × ${config.decayK} + units this tick`}
        why={`The ${config.decayK} is the "how quickly should the board forget" dial. Higher remembers a rush for longer; lower forgets it in a few ticks.`}
      >
        <ExampleTag live={false} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-md text-left text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-admin-line text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                <th scope="col" className="py-1 pr-3 font-semibold">Tick</th>
                {decay.map((step) => (
                  <th key={step.tick} scope="col" className="py-1 pr-3 text-right font-semibold">
                    {step.tick}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-admin-line/60">
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-admin-ink">
                  Sell 5, then nothing
                </th>
                {decay.map((step) => (
                  <td key={step.tick} className="py-1.5 pr-3 text-right text-admin-ink">
                    {step.heat.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-admin-ink">
                  Sell 2 every tick
                </th>
                {steady.slice(0, decay.length).map((step) => (
                  <td key={step.tick} className="py-1.5 pr-3 text-right text-admin-ink">
                    {step.heat.toFixed(1)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] leading-relaxed text-admin-muted">
          A one-off rush of five is nearly gone within{" "}
          {decay.filter((step) => step.heat >= 0.5).length} ticks. Selling two every tick settles at
          about {steady[steady.length - 1].heat.toFixed(1)} and stays there.
        </p>
      </Step>

      <Step
        number={3}
        icon={Gauge}
        title="Pace — busy for this drink"
        question="A pint will always out-sell a cocktail on raw units, so raw units would hand the board to the same drinks every week. Instead each drink is measured against itself."
        formula={`pace = heat ÷ (normal units per night ÷ ${config.sessionTicksHint} ticks)`}
        why={`A drink that normally sells one a night would read as a stampede off a single sale. Anything below ${config.paceFloorUnits} a night is treated as if it sold ${config.paceFloorUnits} — in plain words, "not enough history here to call one sale a trend".`}
      >
        {star && starPace ? (
          <>
            <ExampleTag live={live} />
            <PaceSum drink={star} breakdown={starPace} />
          </>
        ) : (
          <>
            <ExampleTag live={false} />
            <Sum
              lines={[
                {
                  label: `${busy.name} · normally ${busy.pace.normalPerNight} a night · 1 sold`,
                  value: times(busy.pace.pace),
                },
                {
                  label: `${quiet.name} · normally ${quiet.pace.normalPerNight} a night · 1 sold`,
                  value: times(quiet.pace.pace),
                },
                {
                  label: `${rare.name} · normally ${rare.pace.normalPerNight} a night, floored to ${rare.pace.usedPerNight} · 1 sold`,
                  value: times(rare.pace.pace),
                },
              ]}
            />
          </>
        )}
      </Step>

      <Step
        number={4}
        icon={ListOrdered}
        title="Rank — the league table"
        question={`Every drink is lined up by pace, fastest first. The table is only rebuilt every ${config.rerankEveryTicks} ticks; in between, every drink keeps the place it had.`}
        formula="rank 1 = highest pace … rank last = lowest pace"
        why={`Rebuilding every tick would let one stray sale re-price the board every tick. ${config.rerankEveryTicks} ticks is long enough for a run of sales to be a real trend, and short enough that the board never looks stale.`}
      >
        <p className="text-[13px] leading-relaxed text-admin-muted">
          Two drinks on exactly the same pace are separated by whichever sold most recently, and
          after that by the dearer menu price. Those nudges are far too small to overturn a real
          difference — they only settle dead heats, which is what stops the board shuffling on list
          order.
        </p>
      </Step>

      <Step
        number={5}
        icon={Percent}
        title="Tier — the price a rank earns"
        question={`The ${config.tierPcts.bands[0]} fastest sellers get the biggest mark-up and the ${config.tierPcts.bands[0]} quietest the biggest discount, and it softens through the bands from there. Everything in the middle stays at its normal menu price.`}
        formula="tier = looked up from the rank, top and bottom ends only"
        why={`Nothing gets a tier until the bar has sold ${config.warmupUnits} drinks in total. Early in the night most drinks are tied on zero, so a ranking then would be a coin toss — better to show "market warming up" for a few minutes than to put a mark-up on something nobody bought.`}
      >
        <div className="overflow-hidden rounded-xl border border-admin-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-admin-surface text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Position</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Fastest sellers</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Quietest sellers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line/60">
              {bands.map((band) => (
                <tr key={band.band}>
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-admin-ink">
                    Rank {band.band}
                  </th>
                  <td className="px-3 py-2 text-right font-semibold text-admin-error tabular-nums">
                    {pct(Math.abs(band.up))}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-admin-success tabular-nums">
                    {pct(-Math.abs(band.down))}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="px-3 py-2 text-left font-semibold text-admin-ink">
                  Everything in the middle
                </th>
                <td className="px-3 py-2 text-right text-admin-muted tabular-nums" colSpan={2}>
                  Normal menu price
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] leading-relaxed text-admin-muted">
          A drink that lands in both lists — possible on a very small board — takes the discount.
        </p>
      </Step>

      <Step
        number={6}
        icon={Target}
        title="Target and glide — how the price gets there"
        question="The tier decides the destination; the glide decides the speed. The price closes part of the gap each tick, so nothing on the board ever teleports."
        formula={`target = base price × (1 + tier) · new price = last price + ${Math.round(config.glidePct * 100)}% × (target − last price)`}
        why={`Closing ${Math.round(config.glidePct * 100)}% of the gap a tick gets about ${gapClosedPct(config.glidePct, 5)}% of the way there in five ticks, and the guest watching the screen sees a price move rather than a glitch. Every price is then held between ${config.floorPct}× and ${config.ceilPct}× the menu price and rounded to the nearest ${Math.round(config.roundStep * 100)}p so it is always payable at the till.`}
      >
        <ExampleTag live={Boolean(star)} />
        <p className="text-[13px] leading-relaxed text-admin-muted">
          {star ? star.name : "A £5.00 drink"} at {formatGbp(glideDemo[0].price)} that has just
          earned {pct(Math.abs(topBand?.up ?? 0.3))}, heading for{" "}
          {formatGbp(star ? star.basePrice * (1 + (topBand?.up ?? 0.3)) : 5 * (1 + (topBand?.up ?? 0.3)))}:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {glideDemo.map((step) => (
            <span key={step.tick} className="flex items-center gap-2">
              {step.tick > 0 && (
                <ArrowRight className="h-3.5 w-3.5 text-admin-muted" aria-hidden="true" />
              )}
              <span className="rounded-lg bg-admin-surface px-2 py-1 text-[13px] font-semibold text-admin-ink tabular-nums">
                {formatGbp(step.price)}
              </span>
            </span>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-admin-muted">
          Hit crash and every target is replaced by the crash price ({Math.round(config.crashFactor * 100)}
          % of the menu price) for {config.crashDurationTicks} ticks. Nothing else changes: prices walk
          down at the same speed and walk back up again afterwards, and every drink returns to the tier
          it had earned.
        </p>
      </Step>

      <Section
        title="Why pace and not units"
        lead="The same two drinks, the same two sales in the same tick, opposite verdicts. This is the whole idea in one table."
      >
        <div className="overflow-hidden rounded-xl border border-admin-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-admin-surface text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Drink</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Sold</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Normal / night</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Pace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line/60">
              {[busy, quiet, rare].map((example) => (
                <tr key={example.name}>
                  <th scope="row" className="px-3 py-2 text-left font-medium text-admin-ink">
                    {example.name}
                  </th>
                  <td className="px-3 py-2 text-right text-admin-ink tabular-nums">
                    {example.units}
                  </td>
                  <td className="px-3 py-2 text-right text-admin-muted tabular-nums">
                    {example.pace.normalPerNight}
                    {example.pace.floorApplied ? ` → ${example.pace.usedPerNight}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-admin-ink tabular-nums">
                    {times(example.pace.pace)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] leading-relaxed text-admin-muted">
          One sale is an unusual tick for the cocktail ({times(busy.pace.pace)}) and an ordinary one
          for the pint ({times(quiet.pace.pace)}), so the cocktail ranks higher on identical sales.
          The wine bottle is the reason for the pace floor: on its own figure one sale would read as{" "}
          {times(rare.pace.heat / (rare.pace.normalPerNight / config.sessionTicksHint))} and top the
          board off one customer — floored to {rare.pace.usedPerNight} a night it reads as{" "}
          {times(rare.pace.pace)}, a good showing rather than a stampede.
        </p>
      </Section>

      {live && ranked.length > 0 && (
        <Section
          title="The board right now"
          lead="The same chain, read left to right, for the drinks trading tonight."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-[13px]">
              <thead className="text-[11px] font-semibold tracking-wide text-admin-muted uppercase">
                <tr className="border-b border-admin-line">
                  <th scope="col" className="py-2 pr-3 font-semibold">Rank</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Drink</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Heat</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Pace</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Tier</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Target</th>
                  <th scope="col" className="py-2 text-right font-semibold">Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line/60">
                {ranked.slice(0, 12).map((drink) => (
                  <tr key={drink.id}>
                    <td className="py-2 pr-3 text-admin-muted tabular-nums">
                      {drink.rankPos ?? "—"}
                    </td>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-admin-ink">
                      {drink.name}
                      <span className="text-admin-muted"> · {drink.serve}</span>
                    </th>
                    <td className="py-2 pr-3 text-right text-admin-muted tabular-nums">
                      {drink.heat.toFixed(1)}
                    </td>
                    <td className="py-2 pr-3 text-right text-admin-ink tabular-nums">
                      {drink.pace == null ? "—" : times(drink.pace)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {drink.tierPct == null || drink.tierPct === 0 ? (
                        <span className="text-admin-muted">—</span>
                      ) : (
                        <span
                          className={
                            drink.tierPct > 0
                              ? "font-semibold text-admin-error"
                              : "font-semibold text-admin-success"
                          }
                        >
                          {pct(drink.tierPct)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-admin-muted tabular-nums">
                      {formatGbp(drink.targetPrice)}
                    </td>
                    <td className="py-2 text-right font-semibold text-admin-ink tabular-nums">
                      {formatGbp(drink.currentPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ranked.length > 12 && (
            <p className="text-[12px] text-admin-muted">
              Showing the top 12 of {ranked.length}. The full board, with every drink&apos;s numbers,
              is on the{" "}
              <Link href="/settings/market" className="font-semibold text-admin-primary hover:underline">
                market page
              </Link>
              .
            </p>
          )}
        </Section>
      )}

      <Section
        title="The dials behind all of this"
        lead="Each one is editable on the event. These are the values in force right now."
      >
        <Sum
          lines={[
            { label: "A tick is", value: `${config.tickIntervalSec} seconds` },
            { label: "Re-rank the table every", value: `${config.rerankEveryTicks} ticks` },
            {
              label: "Close this much of the price gap per tick",
              value: `${Math.round(config.glidePct * 100)}%`,
            },
            { label: "Tiers start after", value: `${config.warmupUnits} drinks sold` },
            { label: "Treat every drink as selling at least", value: `${config.paceFloorUnits} a night` },
            { label: "Heat keeps this much each tick", value: `${Math.round(config.decayK * 100)}%` },
            {
              label: "Prices stay between",
              value: `${config.floorPct}× and ${config.ceilPct}× the menu price`,
            },
            { label: "Rounded to the nearest", value: `${Math.round(config.roundStep * 100)}p` },
            {
              label: "Crash drops everything to",
              value: `${Math.round(config.crashFactor * 100)}% for ${config.crashDurationTicks} ticks`,
            },
          ]}
        />
      </Section>
    </div>
  );
}
