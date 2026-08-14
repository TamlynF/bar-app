-- How a question got into the archive, and which model wrote it when the
-- generator did. ai_model stays null for anything a person typed.
--
-- Rows saved before this column existed are left null rather than guessed at:
-- nothing recorded where they came from at the time. A null passes the check
-- constraint, so history stays readable without being relabelled.
alter table public.past_quiz_questions
  add column if not exists creation_method text,
  add column if not exists ai_model text;

alter table public.past_quiz_questions
  drop constraint if exists past_quiz_questions_creation_method_check;

alter table public.past_quiz_questions
  add constraint past_quiz_questions_creation_method_check
  check (creation_method in ('manual', 'ai'));
