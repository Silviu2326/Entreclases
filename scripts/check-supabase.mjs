const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error("Faltan la URL o la clave pública de Supabase en .env.local.");
  process.exit(1);
}

async function inspect(path) {
  const response = await fetch(new URL(path, url), {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  return { response, data };
}

let ready = true;
try {
  const { response, data } = await inspect("/auth/v1/settings");
  if (!response.ok) throw new Error(`Auth responde HTTP ${response.status}.`);
  console.log("OK: conexión con Supabase y clave pública aceptada.");
  if (!data.external?.email || data.mailer_autoconfirm !== false || data.disable_signup) {
    ready = false;
    console.error("PENDIENTE: revisar acceso por email, registro y confirmación obligatoria.");
  } else {
    console.log("OK: acceso por email con confirmación obligatoria.");
  }

  const tables = ["university_domains", "profiles", "posts", "groups", "plans", "notes", "messages", "coin_wallets"];
  for (const name of tables) {
    // limit=0 checks schema availability without reading community records.
    const { response, data } = await inspect(`/rest/v1/universe_${name}?select=*&limit=0`);
    if (response.ok || data.code === "42501") {
      console.log(`OK: universe_${name} existe${data.code === "42501" ? " y rechaza el acceso anónimo" : ""}.`);
    } else {
      ready = false;
      console.error(`PENDIENTE: universe_${name} (HTTP ${response.status}, ${data.code ?? "sin código"}).`);
    }
  }
  console.log("Este diagnóstico no verifica dominios habilitados, hooks, SMTP ni entrega de correos: revisar el panel.");
  console.log(`Acceso de la aplicación: ${process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED === "true" ? "habilitado" : "pendiente de activación"}.`);
} catch (error) {
  ready = false;
  console.error("No se ha podido completar la comprobación:", error instanceof Error ? error.message : "error de conexión");
}
process.exitCode = ready ? 0 : 1;
