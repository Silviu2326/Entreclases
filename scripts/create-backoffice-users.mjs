import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !serviceKey || !publishableKey) {
  throw new Error('Define NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y SUPABASE_SERVICE_ROLE_KEY. La service_role solo se usa en local.');
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const accounts = [
  { email: 'silviu@opre.com', password: 'silviu@opre.com', name: 'Silviu' },
  { email: 'xarly@xarly.com', password: 'xarly@xarly.com', name: 'Xarly' },
];

// Enable the test domains before Auth creates or verifies their profiles.
const domains = await admin.from('universe_university_domains').upsert([
  { domain: 'opre.com', university_name: 'Universitat de València', enabled: true, launch_region: 'valencia' },
  { domain: 'xarly.com', university_name: 'Universitat de València', enabled: true, launch_region: 'valencia' },
], { onConflict: 'domain' });
if (domains.error) throw domains.error;

for (const account of accounts) {
  const created = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });
  let user = created.data.user;
  if (created.error && (created.error.code === 'email_exists' || /already registered|already exists|already been registered/i.test(created.error.message))) {
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

  // Profile policies intentionally require a real member JWT. Sign in as the
  // account to create its initial profile, then use the service key for the role.
  const member = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await member.auth.signInWithPassword({ email: account.email, password: account.password });
  if (signedIn.error) throw signedIn.error;
  const existingProfile = await member.from('universe_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (existingProfile.error) throw existingProfile.error;
  if (!existingProfile.data) {
    const profile = await member.from('universe_profiles').insert({
      user_id: user.id,
      name: account.name,
      university: 'Universitat de València',
      campus: 'Tarongers',
      degree: 'Estudios universitarios',
      year: 1,
      bio: '',
      interests: [],
    });
    if (profile.error && profile.error.code !== '23505') throw profile.error;
  }
  await member.auth.signOut();

  const role = await admin.from('universe_backoffice_roles').upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' });
  if (role.error) throw role.error;
  console.log(`OK ${account.email} (${user.id})`);
}