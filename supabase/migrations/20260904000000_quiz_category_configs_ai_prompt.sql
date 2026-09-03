-- The prompt the quiz generator sends to the model for this category, written
-- by staff on the quiz categories page with {{tokens}} for the parts the code
-- fills in (question count, exclusions, year windows). Which built-in prompt a
-- category starts from depends on its round type - question, picture, song or
-- Higher or Lower - see src/lib/quiz/prompt-templates.ts.
--
-- Holds the prompt in use, built-in or not, so the row says exactly what the
-- generator sends. Null only on rows from before the column existed, which
-- the code reads as the built-in prompt for that round type.
alter table public.quiz_category_configs
  add column if not exists ai_prompt text;
