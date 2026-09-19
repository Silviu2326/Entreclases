import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const config=fileURLToPath(new URL('../next.config.ts',import.meta.url));
function check(url,key) {
  return spawnSync(process.execPath,['--experimental-strip-types',config],{
    env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},encoding:'utf8'
  });
}
test('Build accepts an unconfigured preview and a public configuration', () => {
  assert.equal(check('','').status,0);
  assert.equal(check('https://project.example.test','sb_publishable_example_public_key_123').status,0);
});
test('Build blocks secret keys before they can enter browser bundles', () => {
  const serverKey='sb_secret_should_never_be_bundled';
  const r=check('https://project.example.test',serverKey);
  assert.notEqual(r.status,0);
  assert.ok(!r.stderr.includes(serverKey));
  const serviceJwt='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
  assert.notEqual(check('https://project.example.test',serviceJwt).status,0);
  assert.notEqual(check('http://insecure.test','sb_publishable_example_public_key_123').status,0);
});

test('Public credentials do not open registration before the launch switch is enabled', () => {
  const source = pathToFileURL(fileURLToPath(new URL('../lib/auth/config.ts', import.meta.url))).href;
  function state(enabled, key = 'sb_publishable_example_public_key_123') {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
      `import { authConfigured, supabaseConfigured } from ${JSON.stringify(source)}; console.log(JSON.stringify({authConfigured, supabaseConfigured}));`], {
      env: {...process.env, NEXT_PUBLIC_SUPABASE_URL:'https://project.example.test', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key, NEXT_PUBLIC_SUPABASE_AUTH_ENABLED:enabled}, encoding:'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  assert.deepEqual(state(''), {authConfigured:false, supabaseConfigured:true});
  assert.deepEqual(state('false'), {authConfigured:false, supabaseConfigured:true});
  assert.deepEqual(state('true'), {authConfigured:true, supabaseConfigured:true});
  assert.deepEqual(state('true', 'sb_secret_not_a_public_key'), {authConfigured:false, supabaseConfigured:false});
});
