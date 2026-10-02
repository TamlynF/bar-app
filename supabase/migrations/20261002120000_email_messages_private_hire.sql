-- Private hire enquiries join the email correspondence: emails sent to the
-- enquirer are logged against the request, and replies to hire-<ref>@ the reply
-- domain land in the same thread.

alter table public.email_messages
  add column if not exists private_hire_request_id uuid
    references public.private_hire_requests(id) on delete set null;

create index if not exists email_messages_private_hire_idx
  on public.email_messages (private_hire_request_id, created_at);

create index if not exists email_messages_private_hire_unread_idx
  on public.email_messages (private_hire_request_id)
  where direction = 'inbound' and read_at is null;
