-- SOLO desarrollo. Nunca ejecutar en producción.
insert into public.universe_university_domains(domain,university_name,enabled,launch_region) values ('opre.com','Opre · pruebas',true,'valencia'),('xarly.com','Xarly · pruebas',true,'valencia') on conflict(domain) do update set enabled=true;
