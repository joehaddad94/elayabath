-- Failed sign-in attempts are recorded too.
--
-- Under direct sign-in the email address is the whole credential, so the
-- only defence against someone guessing staff addresses is slowing them
-- down. The sign-in action refuses a connection that has failed ten times in
-- fifteen minutes, and needs to count those failures quickly to do it.

alter table public.sign_in_log drop constraint sign_in_log_method_check;
alter table public.sign_in_log
  add constraint sign_in_log_method_check check (method in ('direct', 'link', 'refused'));

create index sign_in_log_refusals on public.sign_in_log (ip, at desc) where method = 'refused';
