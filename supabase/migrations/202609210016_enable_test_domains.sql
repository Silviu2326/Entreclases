-- Test domains explicitly approved for the Entreclase development environment.
-- Keep this migration separate so the domains can be removed without rewriting history.
insert into public.universe_university_domains (domain, university_name, enabled, launch_region)
values
  ('opre.com', 'Opre · entorno de pruebas', true, 'valencia'),
  ('xarly.com', 'Xarly · entorno de pruebas', true, 'valencia')
on conflict (domain) do update set university_name = excluded.university_name, enabled = true, launch_region = excluded.launch_region;