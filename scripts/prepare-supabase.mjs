import { readdir, readFile, writeFile } from "node:fs/promises";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const names = (await readdir(migrations)).filter(name => name.endsWith(".sql") && !name.endsWith("_enable_test_domains.sql")).sort();
const sections = await Promise.all(names.map(async name => `-- ${name}\n${await readFile(new URL(name, migrations), "utf8")}`));
const header = `-- Entreclase: instalación inicial en un proyecto Supabase dedicado.
-- Generado desde supabase/migrations; no editar ni ejecutar sobre una instalación existente.
-- Instala tablas, funciones y permisos. No crea usuarios ni activa dominios.
begin;
do $$ begin
  if to_regclass('public.universe_university_domains') is not null then
    raise exception 'Entreclase ya tiene migraciones aplicadas. Ejecuta solo las pendientes, en orden.';
  end if;
end $$;
`;
await writeFile(new URL("../supabase/setup.sql", import.meta.url), `${header}\n${sections.join("\n\n")}\ncommit;\n`);
console.log(`Preparado supabase/setup.sql con ${names.length} migraciones, en una transacción.`);
