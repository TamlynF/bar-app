-- The extra picture instructions the host gave the image generator. Never shown
-- to guests and never printed - it is kept so reopening a round can offer back
-- the same instructions the last batch was created with.
--
-- Null on every row saved before this column existed, and on every non-picture
-- round, where there is no image to steer.
alter table public.past_quiz_questions
  add column if not exists image_notes text;
