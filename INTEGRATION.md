# Wiring the quiz round sheet in

## File placement

| File | Destination |
|---|---|
| `round-stages.ts` | `src/lib/quiz/round-stages.ts` |
| `stage-rail.tsx` | `src/components/shared/stage-rail.tsx` |
| `quiz-round-sheet.tsx` | `src/app/(private)/event-setups/events/[id]/quiz-round-sheet.tsx` |

Nothing existing is overwritten.

## The one edit to an existing file

In `category-section.tsx`, the block that currently reads roughly:

```tsx
<Link
  href={`/event-setups/quiz-generator?event_id=${eventId}&category=${encodeURIComponent(category_name)}`}
  className={...}
>
  <Sparkles className="w-3.5 h-3.5" />
  {isComplete ? "Generate Extra" : "Generate Questions"}
</Link>
```

becomes:

```tsx
<QuizRoundSheet
  eventId={eventId}
  eventDate={eventDate}
  categoryConfig={categoryConfig}
  savedQuestions={questions}
  roundNumber={orderNo ?? undefined}
  totalRounds={totalRounds}
  nextRound={nextRound}
/>
```

The sheet renders its own trigger button, so the wrapping `div` and its styling stay as they are.

`categoryConfig` is the full `QuizCategoryConfig` row — `category-section.tsx` currently receives it spread into separate props (`category_name`, `question_count`, `is_picture`, `include_spotify`, `is_higher_lower`, `order_no`). Pass the whole row down from the page instead of destructuring it; the sheet needs `id`, `points_per_question` and `short_name` too.

## Action contract

Two of the three imports already exist with matching signatures:

```ts
generateQuizAction(topic, category, numberOfQuestions, difficulty, eventId, categoryConfigId)
  → { questions?: QuizQuestion[]; error?: string }
```

The third is the one to check. The sheet calls:

```ts
approveQuizQuestionsAction(
  eventId: number,
  categoryConfigId: number,
  questions: QuizQuestion[]
): Promise<{ error?: string }>
```

If your existing approve action is named differently, or takes the questions first, change the import and the single call site in `handleApprove` — nothing else depends on it.

It should also `revalidatePath` the event route so `router.refresh()` picks up the new saved rows and the header pill flips green.

## Computing `nextRound`

In the parent page, after building `byCategory`, the next incomplete round after each one:

```ts
const withNext = byCategory.map((cat, i) => {
  const following = byCategory
    .slice(i + 1)
    .find((c) => c.questions.length < c.question_count);

  return {
    ...cat,
    nextRound: following
      ? {
          categoryConfigId: following.id,
          categoryName: following.category_name,
          savedCount: following.questions.length,
          targetCount: following.question_count,
        }
      : null,
  };
});
```

Pass `nextRound` into each `CategorySection`, which forwards it to the sheet.

## Optional — keeping the sheet open between rounds

Without `onAdvanceToRound`, the `Next: …` button closes the sheet and the user reopens on the next round. To keep it open, lift the active round into the page as state and have the sheet read it, then pass a setter as `onAdvanceToRound`. That turns eight rounds into one uninterrupted sitting, which is the whole point on a Thursday afternoon.

## Deliberately not handled

Picture rounds and music-snippet rounds still route out to `/event-setups/quiz-generator`. Those two generate images and resolve Spotify track IDs, and the topic locks once set — reimplementing that blind would have been guesswork. The sheet detects them via `is_picture` / `include_spotify` and shows a hand-off panel instead. Worth folding in as a second pass once the standard flow is proven.

## Redirect the old route

`/event-setups/quiz-generator?event_id=15&category=Music` should keep working for bookmarks. Add a redirect at the top of that page for standard categories:

```ts
if (presetEventId && presetCategory && !isSpecialCategory) {
  redirect(`/event-setups/events/${presetEventId}?round=${encodeURIComponent(presetCategory)}`);
}
```

Then have the event page auto-open the matching round's sheet from the `round` search param, the way `focusCategory` already auto-expands the accordion.
