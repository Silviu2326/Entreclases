-- The blog carries the same form as the landing and the roadmap. Its addresses
-- are recorded under their own origin so the backoffice can tell which pages
-- bring people in.
alter table public.universe_waitlist drop constraint if exists universe_waitlist_source_check;
alter table public.universe_waitlist add constraint universe_waitlist_source_check check (source in ('landing','roadmap','blog'));
