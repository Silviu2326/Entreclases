import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  throw new Error('Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Esta clave solo se usa en local y nunca debe ir a Vercel como NEXT_PUBLIC_.');
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [
  { email: 'silviu@opre.com', password: 'silviu@opre.com' },
  { email: 'xarly@xarly.com', password: 'xarly@xarly.com' },
];

for (const account of accounts) {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });
  let user = created.data.user;
  if (created.error && /already registered|already exists/i.test(created.error.message)) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw listed.error;
    user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === account.email);
    if (!user) throw created.error;
    const updated = await admin.auth.admin.updateUserById(user.id, { password: account.password, email_confirm: true });
    if (updated.error) throw updated.error;
  } else if (created.error) {
    throw created.error;
  }
  if (!user) throw new Error(`No se pudo crear ${account.email}`);
  const profile = await admin.from('universe_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' });
  if (profile.error) throw profile.error;
  const role = await admin.from('universe_backoffice_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' });
  if (role.error) throw role.error;
  console.log(`OK ${account.email} (${user.id})`);
}

