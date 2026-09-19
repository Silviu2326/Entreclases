import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';
import { routes, localHref } from '../lib/i18n/routes.ts';
import { valencianMessages } from '../lib/i18n/messages-va.ts';
import { actionSuffix } from '../lib/auth/action-language.ts';

// Verify all entry points, including links reached from an email, stay in the
// chosen language without passing unrelated URL data into another page.
test('Every Spanish entry point has a distinct Valencian destination', () => {
  assert.equal(new Set(Object.values(routes.va)).size, Object.keys(routes.es).length);
  for (const [name, path] of Object.entries(routes.es)) {
    assert.equal(localHref('va', path), routes.va[name]);
    assert.equal(localHref('es', path), path);
  }
  assert.equal(localHref('va', '/#valencia'), '/va/#valencia');
  assert.equal(localHref('va', '#campus'), '#campus');
});

test('A pending confirmation survives a language switch without copying sessions or redirect targets', () => {
  const hash = 'a'.repeat(64);
  const source = '?redirect_to=https://outside.test&email=private%40example.test#token_hash='+hash+'&type=email&access_token=secret';
  assert.equal(actionSuffix(source, 'verify'), '#token_hash='+hash+'&type=email');
  assert.equal(actionSuffix('?code=valid-code&next=https://outside.test', 'reset'), '?code=valid-code');
  assert.equal(actionSuffix(source, 'login'), '');
  assert.equal(actionSuffix(source, 'home'), '');
  assert.equal(actionSuffix('?code='+ 'a'.repeat(513), 'verify'), '');
  assert.equal(actionSuffix('?error=access_denied', 'verify'), '?error=access_denied');
});

test('Landing, form feedback and hidden interactive states have Valencian copy', async () => {
  const required = new Set(['Contraseña', 'Dinos cómo te llamas. Entre 2 y 60 caracteres.', 'Escribe tu contraseña.', 'Las dos contraseñas no coinciden.']);
  const componentDir = new URL('../components/entreclase/', import.meta.url);
  const files = (await readdir(componentDir)).filter(x=>x.endsWith('.tsx')).map(x=>new URL(x,componentDir));
  files.push(new URL('../lib/auth/validation.ts', import.meta.url));
  function strings(node) {
    if(ts.isStringLiteral(node)) required.add(node.text);
    else ts.forEachChild(node,strings);
  }
  for (const file of files) {
    const source=ts.createSourceFile(file.pathname,await readFile(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node) {
      if(ts.isCallExpression(node) && /^(tr|setError|setNotice)$/.test(node.expression.getText(source))) {
        for (const arg of node.arguments) if(ts.isStringLiteral(arg)) required.add(arg.text);
      }
      if(ts.isPropertyAssignment(node) && /^(title|text|label|body|opener|link|question|answer|bullets)$/.test(node.name.getText(source))) strings(node.initializer);
      if(file.pathname.endsWith('/validation.ts') && ts.isStringLiteral(node) && node.text.includes(' ')) required.add(node.text);
      ts.forEachChild(node,visit);
    }
    visit(source);
  }
  const missing = [...required].map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).filter(x=>!valencianMessages[x]);
  assert.deepEqual(missing,[],'Untranslated strings: '+missing.join(' | '));
  assert.match(valencianMessages['Valencia · Solo con correo universitario'],/València/);
  assert.match(valencianMessages['Te sabes la vida'],/Et saps la vida/);
});
