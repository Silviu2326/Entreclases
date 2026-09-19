import test from 'node:test';
import assert from 'node:assert/strict';
import { emailError, normalizeEmail, passwordError, parseEmailAction, authErrorMessage } from '../lib/auth/validation.ts';

test('University forms reject personal and malformed addresses without claiming unknown domains are verified', () => {
  assert.equal(normalizeEmail('  ANA@Campus.Example.test '), 'ana@campus.example.test');
  for (const email of ['', 'ana@', 'ana@@uni.es', 'ana@uni..es', 'ana@-uni.es', 'ana @uni.es', 'ana@uni.es\nelsewhere']) assert.ok(emailError(email, true), email);
  for (const email of ['a@gmail.com', 'a@OUTLOOK.COM', 'a@proton.me']) assert.ok(emailError(email, true), email);
  assert.equal(emailError('ana+clase@campus.example.test', true), ''); // Syntax only; SQL decides access.
});
test('Passphrases support spaces and Unicode, with explicit bounds', () => {
  assert.ok(passwordError('corta'));
  assert.equal(passwordError('Esta frase tiene café'), '');
  assert.ok(passwordError('x'.repeat(129)));
});
test('Email tokens cannot be repurposed or replaced by arbitrary URLs', () => {
  const hash = 'a'.repeat(64);
  assert.deepEqual(parseEmailAction('', '#token_hash='+hash+'&type=email', 'email'), { tokenHash: hash, type: 'email' });
  assert.equal(parseEmailAction('', '#token_hash='+hash+'&type=email', 'recovery'), null);
  assert.equal(parseEmailAction('', '#token_hash=javascript:alert(1)&type=email', 'email'), null);
  assert.equal(parseEmailAction('?code=https://evil.test', '', 'email'), null);
  assert.equal(parseEmailAction('?error=expired&code=abc', '', 'email'), null);
  assert.deepEqual(parseEmailAction('?code=valid-pkce-code', '', 'recovery'), { code: 'valid-pkce-code' });
});
test('Provider errors never expose raw server or credential details', () => {
  assert.match(authErrorMessage({code:'invalid_credentials'}), /no coinciden/);
  assert.match(authErrorMessage({code:'not_configured'}), /todavía no/);
  assert.match(authErrorMessage({message:'UNIVERSE_UNIVERSITY_REQUIRED'}), /universidad admitida/);
  assert.ok(!authErrorMessage({message:'private database password=secret'}).includes('secret'));
});
