-- The mailer calls these with the service key. Supabase normally hands
-- service_role execute on new functions through default privileges, but that
-- is an assumption about the project, not something this schema states. Say it.
grant execute on function public.universe_waitlist_due(integer) to service_role;
grant execute on function public.universe_waitlist_sent(bigint, text) to service_role;
grant execute on function public.universe_waitlist_unsubscribe(uuid) to service_role;
