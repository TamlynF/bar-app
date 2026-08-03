# Quiz question popup — redesign spec

Applies to `src/app/(private)/event-setups/events/[id]/quiz-round-sheet.tsx`.
The server actions themselves don't change — this is a layout/presentation change plus **one routing change**: the same sheet now handles picture rounds (`is_picture`) and music-snippet rounds (`include_spotify`) instead of sending them to the old full generator. Pair this doc with the interactive mockup (`quiz-question-popup-mockup.html`), which previews all three round types via the switcher at the top.

## The problems with the current layout

The sheet opens with the eight saved questions filling the left column, so the person's eye lands on content they cannot change. The freshly generated drafts appear *below* the saved list, under the fold — the most important content on the screen is the hardest to find. Selection is a small tick circle and a 45% opacity fade, which reads as "broken/greyed out" rather than "not picked", and the setup controls sit in a separate right column that doesn't obviously relate to the list on the left.

## Design principles for the redesign

The person using this doesn't navigate websites much, so the screen should read top-to-bottom like a set of instructions, show one job at a time, and use words instead of icons wherever a decision is being made.

## New layout — single column, three zones

### 1. Header (sticky)

Round name plus a plain-English subtitle: **"You need 2 more questions to finish this round."** Below it, a segmented progress bar of 10 blocks: dark olive for saved, pulsing amber for currently-ticked drafts, with a label like **"8 + 2 of 10"**. The moment a draft is ticked, the person literally watches the round fill up. This replaces the abstract Not started → Reviewing → Complete stage rail, which describes an internal state machine, not the user's job. (If you want to keep `StageRail` for consistency with other sheets, demote it below the progress bar — but the bar carries the meaning.)

### 2. Body (scrolls) — in this order

**Step 1 — Create new questions.** Two aligned rows inside the panel, all controls the same 48px height so the block reads as one tidy unit:

- Row 1: **Topic** on its own full-width line (topics can be long free text — never share this row). The label carries the hint inline — "TOPIC — optional, leave blank for a general mix" — as a small uppercase eyebrow, so there's no stray helper text floating below the input. Placeholder: "Type a topic, e.g. 90s britpop".
- Row 2: **Difficulty** chips on the left, the primary **"✨ Create 5 new questions"** button right-aligned on the same baseline. Reading order becomes exactly the doing order: type (optional) → choose → press. On mobile (<640px) the row stacks and the button goes full-width.
- Footnote under row 2: *"We'll create 5 so you can pick your favourite 2 and skip the rest."* — states the over-generation trick up front instead of the current side-column footnote.

After generating, this panel collapses to a single line — "✓ Questions created · Change topic or difficulty" — so the screen stays focused on picking.

The selected difficulty must not look like the Create button. Solid olive is reserved for the single primary action per view (per CLAUDE.md), so a selected difficulty renders as a *soft-selected chip*: `bg-admin-primary-soft` (#E5EBD8) fill, `border-admin-primary` 2px border, olive text, bolder weight, and a "✓" prefix. Unselected chips are white with `border-admin-line`. Three separate rounded buttons with an 8px gap read better to a novice than a fused segmented control — each looks individually pressable.

**Step 2 — Pick your favourites.** The generated drafts render as full cards, not list rows:

- Whole card is the tap target, with a large (28px) checkbox on the left. Small icons are hard to hit for less-confident users.
- A badge in the corner: amber **NEW** when unpicked, olive **✓ PICKED** when selected. Selected cards also get an olive border + tinted background. Selection state is redundant across three cues (border, fill, badge+checkbox) — impossible to misread.
- **Picked cards are quiet.** No "Will be added" label and no Swap button on a selected card — a picked card shows only the tick state, so the actionable buttons live only on cards that still need a decision. To swap a picked question, untick it first (Swap reappears).
- The answer sits in its own chip labelled **"Answer: …"**.
- Swap is a labelled button — **"↻ Swap"** — not a bare icon, shown on unpicked cards only.
- **Auto-pick info pill.** Keep the current pre-tick behaviour, announced by a single olive info pill directly above the cards: *"We've picked 2 for you — untick one if you'd like a different question."* The pill disappears the moment the person changes the selection (untick, tick, or swap) — once they've taken over, the message has done its job. This pill **replaces** the old at-cap warning note entirely; the cap itself still applies (unpicked cards fade at the cap and a tick past it simply doesn't take).
- A counter pill top-right: "0 of 2 picked" (amber) → "2 of 2 picked" (green).
- Duplicate warning stays on the card (red text under the question), as now.
- Below the cards: secondary button "↻ Create 5 different questions" (replaces the whole batch).
- While generating: 5 skeleton cards, so it's obvious something is happening and how many are coming.

**Already saved — demoted to a collapsed accordion at the bottom.** Answer to "is it worth showing the saved questions?": yes, but only on demand. They're useful for spotting near-duplicates and remembering the round's flavour, but they must not compete with the drafts. A single collapsed row — **🔒 (8) Already saved in this round — locked, just for reference** — expands to the read-only list. The dedupe check is already automated (`findDuplicateIndices`), so the person rarely needs it open. Drop the side-by-side two-column grid entirely; on the narrow sheet it forces both columns to be cramped, and a second column is exactly the kind of split attention that confuses novice users.

### 3. Footer (sticky)

**Partial adds are allowed** — the round doesn't have to be finished in one go (this matches the existing `selected.size === 0` rule; the button enables from 1 pick). Left: a status sentence that always counts down to done, never errors — "Nothing picked yet — tick at least 1 question to add." → "1 picked — you can add now, 1 question will still be needed." → "✓ Ready — this completes the round." Right: `Close` ghost button and the primary action renamed from "Approve 2" to **"Add {selected} question(s) to round"** — the count in the label tracks the selection, and "approve" is workflow jargon; "add … to round" says what happens.

### After approving

Two success states inside the sheet:

- **Round complete:** 🎉 "Round complete! General knowledge now has all 10 of 10 questions", the added questions listed, button "Done — back to quiz" (or "Next: Music Snippets (3/10)" reusing your existing `nextRound` prop as the primary button, which is even better for the build-the-whole-quiz flow).
- **Partial add:** ✅ "1 question added — General knowledge now has 9 of 10, 1 question still needed", the added questions listed, primary button **"Keep going — add the rest"** which returns to Step 1 with all counts recalculated (subtitle, footnote, pre-tick amount, counter all use the new remaining number).

## The round list page (`category-section.tsx` headers)

The popup is opened from the round list on `/event-setups/events/[id]`, so the two must read as one system. The current headers look ragged because the row is built as *expand-button (name + pill + chevron)* followed by an optional CTA — complete rounds have no CTA, so their pill and chevron drift to the far right while other rows' pills sit mid-row, and button labels of different lengths ("Add 2 questions" / "Start round" / "Add 7 questions") make the button edge wander. The mockup's opening screen shows the fixed version.

**Give every row the same four fixed rails, in the same order, at the same x-positions:**

1. **Name + status** (flexes): "{n}. {Round name}" bold, with a small round-type icon before the name (Lucide: `Brain`/`HelpCircle` generic, `Image` for picture, `Music` for snippet rounds) so special rounds are recognisable at a glance. Below it the status line, colour-coded as now: amber "2 more needed", green "Round complete", muted "Not started".
2. **Progress chip** — fixed width (`w-[74px]`, `tabular-nums`, centred) so every "{saved} / {total}" sits in one vertical rail. Keep the existing amber/green/neutral colouring.
3. **Action slot** — fixed width (~`w-[190px]`). In-progress rounds: solid olive button "✨ Add {n} more"; not-started: "✨ Start round"; **complete rounds fill the same slot with a non-interactive "✓ Complete" tag** (green text, dashed green border, transparent) instead of leaving the slot empty. That's the key alignment fix — the column never collapses. Shorten "Add 2 questions" to "Add 2 more"; the chip next to it already says 8/10, so "questions" is redundant and the label stays one width.
4. **Chevron** — its own 40×40px bordered button at the far edge (with `aria-label="Show saved questions"`), not glued to the pill. One consistent place to expand every row, and a 44px-friendly target. The name area can stay clickable-to-expand too.

On mobile (<~680px) the row wraps: name + status full-width on top, then chip + action + chevron as a second line with the button flexing.

**Summary card:** same structure as now, tidied to the same rails — icon + event name/date left, "{saved} of {total} questions saved" right-aligned as one stat, progress bar full-width beneath, then a single bottom line: plain-language status left ("2 of 8 rounds complete · 35 questions still needed.") and the one solid-olive "Continue building quiz" button right. "Continue building quiz" should open the sheet for the first unfinished round rather than navigating away.

## One sheet for every round type

`category-section.tsx` currently branches at `isPicture || includeSpotify || configId == null` and links those rounds out to `/event-setups/quiz-generator`. Remove that branch (keep the `configId == null` fallback) and always render `QuizRoundSheet`, passing the props it needs: `includeSpotify`, `isPicture`, `isHigherLower`, `playlistUrl`, and the round's saved items. The sheet keeps one shared skeleton — header/progress, Step 1 panel, Step 2 cards, saved accordion, footer — and only the card body and a few labels vary by type. Same flow everywhere means the person learns it once.

### Standard question rounds
As specified above. Calls `generateQuizAction` / `saveQuizToDatabase`.

### Picture rounds (`is_picture`)
- **Topic is required and locked.** Label reads "TOPIC — required for picture rounds" (amber, not red — it's a rule, not an error). If the round already has saved pictures, prefill the topic from the existing round topic, disable the input, and show a plain-language note: "🔒 Picture rounds keep one topic — this round is already 'Dog breeds', so new pictures stay on that topic." This mirrors the `pictureTopicLocked` logic already in `quiz-generator/page.tsx`. Pressing Create with an empty topic focuses the field and puts "Type a topic first — picture rounds need one" in the footer status (persistent, not a toast).
- **Draft card = picture first.** A large image thumbnail (~110px, `rounded-xl`) from `PictureRoundItem.imageUrl` on the left, "Picture card" title with the sub-line "Guests see this picture and write the answer", and the `Answer:` chip below. Null `imageUrl` gets a neutral placeholder frame. Swap replaces image + answer together via `generatePictureRoundAction(1, …)`, threading `previousPictureAnswers` to avoid repeats.
- Saved accordion rows show a small thumbnail + answer.
- Wire to `generatePictureRoundAction` / `savePictureRoundAction`. Keep the existing "Print picture sheet" button where it lives in `CategorySection` — it's a post-save concern, not part of this sheet.
- Button labels swap noun: "✨ Create 5 new pictures", "Add 2 pictures to round".

### Music snippet rounds (`include_spotify`)
- **Spotify banner at the top of the sheet body**, above Step 1, reusing the states already implemented in `CategorySection` (lines ~423–500): not connected → green `#1DB954` "Connect Spotify" button with the reassurance "You can still pick songs now — the playlist fills in once connected" (picking is never blocked on connecting); connected → "✓ Spotify connected — songs you approve are added to this round's playlist automatically" plus "Open playlist" / sync affordances. Spotify green is fine here — it's the brand colour of an external action, not an admin button.
- **Draft card = song.** Album-art placeholder (or artwork when available), track title bold with artist as the sub-line, a year chip, and a **"▶ Play"** outline button (Spotify-green border) that plays the snippet via the existing Web Playback integration — toggles to "◼ Stop", only one playing at a time. Letting the person *hear* the snippet before picking is the whole point of the round; it must not require leaving the sheet. No question text is shown (`hideQuestionText` — the snippet is the question).
- Saved accordion rows: ♪ thumbnail, "Title — Artist", year.
- Wire to `generateMusicSnippetsAction` / `saveMusicSnippetsAction` (fields: `artist`, `title`, `year`, `spotify_track_id`, `hint_year`). When save returns `needsConnect`, show it on the success view — "Songs saved. Connect Spotify to add them to the round's playlist." — not as a transient toast. When connected, success view adds "🎵 Spotify playlist updated — the 2 new songs were added automatically."
- Button labels: "✨ Create 5 new songs", "Add 2 songs to round".
- **Higher or Lower** (`include_spotify && is_higher_lower`): same song data plus `hint_year`; it *does* show question text. Treat it as the music variant with the question line visible and the year chip showing the hint year.

## Mapping to the existing component

| Current | Change |
|---|---|
| `StageRail` + stage machine | Replace (or demote) with 10-segment progress bar driven by `savedCount` + `selected.size` |
| Two-column `grid-cols-[1.6fr_1fr]` | Single column; setup panel becomes Step 1 block that collapses after generation |
| Saved list first, drafts after | Drafts first (Step 2), saved list into `<details>`-style accordion at the bottom (shadcn `Accordion` or `Collapsible`) |
| `Circle`/`CheckCircle2` 18px icons | 28px checkbox inside a fully clickable card (`role="checkbox"`, `aria-checked`) |
| `opacity-45` on unselected drafts | Unselected drafts stay full-strength until the cap is reached; only then fade. The pre-tick is announced by an olive info pill that hides on the first manual change |
| Icon-only `RefreshCw` swap | `↻ Swap` labelled button, shown on unpicked cards only (picked cards carry no buttons) |
| "Approve N" | "Add N question(s) to round" |
| Footnote "A few spare are generated…" | Moved up beside the generate button: "We'll create 5 so you can pick your favourite 2." |
| `justApproved` footer chip | Full success view inside the body, `nextRound` as the primary follow-on button |
| `CategorySection` routes `isPicture`/`includeSpotify` to `/event-setups/quiz-generator` | Always render `QuizRoundSheet`; card body varies by round type (picture card / song card / question card) |
| Row = expand-button (name+pill+chevron) + optional CTA, so complete rows misalign | Four fixed rails per row: name+status · fixed-width chip · fixed-width action slot ("✓ Complete" tag when full) · standalone chevron button |

Existing tokens cover everything: `admin-primary` (olive), `admin-warning`/`admin-warning-bg` (amber picks + cap note), `admin-success`/`admin-success-bg` (complete states), `admin-line`, `admin-muted`. No new colours needed.

## Copy reference

- Subtitle: "You need {n} more question(s) to finish this round."
- Generate explainer: "We'll create {n+3} so you can pick your favourite {n} and skip the rest."
- Auto-pick pill (hidden after any manual change): "We've picked {n} for you — untick one if you'd like a different question."
- Footer: "Nothing picked yet — tick at least 1 question to add." / "{k} picked — you can add now, {n−k} question(s) will still be needed." / "✓ Ready — this completes the round."
- Primary: "Add {k} question(s) to round"
- Partial success: "{k} question(s) added — {round} now has {saved} of {total}, {remaining} still needed." + button "Keep going — add the rest"
- Accordion: "({n}) Already saved in this round — locked, just for reference"

## Accessibility / novice-user checklist

Tap targets ≥ 44px (cards, swap, footer buttons). Selection never conveyed by colour alone (badge text + checkbox + border). Persistent inline notes instead of transient toasts for anything the user must understand. All icon buttons carry text labels. `aria-live="polite"` on the counter pill and footer status so screen readers hear the countdown.
