-- What the picture is meant to show, written for the image model alongside the
-- answer: which Snowball, what species, which show, what art style. Kept so a
-- saved picture can be redrawn as the same subject, and printed on the host's
-- answer sheet as a marking note. Never shown to guests.
--
-- Null on every row saved before this column existed, on pictures the host
-- uploaded themselves, and on every non-picture round.
alter table public.past_quiz_questions
  add column if not exists image_description text;
