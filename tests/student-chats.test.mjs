import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Same tiny loader used by student-grades.test.mjs: chats.ts is plain
// TypeScript with no React or browser APIs, so it can run straight under Node.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), cache = new Map();
function load(relative) {
  let filename = resolve(root, relative);
  if (!extname(filename)) filename = ['.ts', '.tsx', '/index.ts'].map(ext => filename + ext).find(existsSync);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} }; cache.set(filename, loaded);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(path => path.startsWith('@/') ? load(path.slice(2)) : path.startsWith('.') ? load(resolve(dirname(filename), path)) : require(path), loaded, loaded.exports);
  return loaded.exports;
}
const {
  newChat, isDefaultTitle, titleFor, toHistory, appendMessage, updateMessage, pruneChats, suggestions, serializable, chatsStoreKey, emptyChats,
} = load('lib/community/student/chats.ts');

const msg = (overrides) => ({ id: 'm1', role: 'user', mode: 'chat', text: '', at: '2026-01-01T00:00:00.000Z', status: 'done', ...overrides });

test('newChat starts empty with the default title for its language and the requested doc ids', () => {
  const es = newChat('es', ['a', 'b']);
  assert.equal(es.title, 'Nueva conversación');
  assert.equal(isDefaultTitle(es.title), true);
  assert.deepEqual(es.docIds, ['a', 'b']);
  assert.deepEqual(es.messages, []);
  assert.equal(es.language, 'es');
  assert.equal(es.style.tone, 'peer');

  const va = newChat('va');
  assert.equal(va.title, 'Nova conversa');
  assert.deepEqual(va.docIds, []);
});

test('titleFor uses the first real user question, trimmed to 48 characters', () => {
  const empty = newChat('es');
  assert.equal(titleFor(empty), 'Nueva conversación');

  const short = { ...empty, messages: [msg({ role: 'user', text: '¿Qué es la fotosíntesis?' })] };
  assert.equal(titleFor(short), '¿Qué es la fotosíntesis?');

  const long = { ...empty, messages: [msg({ role: 'user', text: 'x'.repeat(80) })] };
  const title = titleFor(long);
  assert.equal(title.length, 49); // 48 chars + the ellipsis character
  assert.ok(title.endsWith('…'));

  // An assistant message, or a user message with no real text (a streaming
  // placeholder), does not count as "the first question".
  const onlyAssistant = { ...empty, messages: [msg({ role: 'assistant', text: 'hola' }), msg({ role: 'user', text: '   ' })] };
  assert.equal(titleFor(onlyAssistant), 'Nueva conversación');
});

test('toHistory keeps only finished text messages, ignoring flashcards, quizzes, streaming and error turns', () => {
  const messages = [
    msg({ id: '1', role: 'user', text: 'Explícame la Revolución Francesa' }),
    msg({ id: '2', role: 'assistant', text: 'Empezó en 1789...' }),
    msg({ id: '3', role: 'user', mode: 'flashcards', text: '' }),
    msg({ id: '4', role: 'assistant', mode: 'flashcards', text: '', status: 'done', flashcards: [{ front: 'a', back: 'b' }] }),
    msg({ id: '5', role: 'assistant', text: 'a medias', status: 'streaming' }),
    msg({ id: '6', role: 'assistant', text: '', status: 'error', error: 'boom' }),
  ];
  const history = toHistory(messages);
  assert.deepEqual(history, [
    { role: 'user', text: 'Explícame la Revolución Francesa' },
    { role: 'assistant', text: 'Empezó en 1789...' },
  ]);
});

test('appendMessage adds the message and bumps updatedAt to its timestamp', () => {
  const chat = newChat('es');
  const updated = appendMessage(chat, msg({ text: 'hola', at: '2026-02-02T00:00:00.000Z' }));
  assert.equal(updated.messages.length, 1);
  assert.equal(updated.updatedAt, '2026-02-02T00:00:00.000Z');
  assert.equal(chat.messages.length, 0, 'the original chat is untouched');
});

test('updateMessage patches only the matching message and leaves the rest alone', () => {
  const chat = { ...newChat('es'), messages: [msg({ id: 'a', text: 'uno' }), msg({ id: 'b', text: 'dos' })] };
  const updated = updateMessage(chat, 'a', { text: 'uno editado', status: 'done' });
  assert.equal(updated.messages[0].text, 'uno editado');
  assert.equal(updated.messages[1].text, 'dos');
});

test('pruneChats leaves state untouched under the limit, and always keeps the active chat over the limit', () => {
  const under = { chats: [newChat('es')], activeId: null };
  assert.equal(pruneChats(under, 30), under);

  const chats = Array.from({ length: 35 }, (_, i) => ({
    ...newChat('es'),
    id: `c${i}`,
    updatedAt: new Date(2026, 0, i + 1).toISOString(), // c0 is the oldest, c34 the newest
  }));
  const state = { chats, activeId: 'c0' }; // the active chat is the very oldest one
  const pruned = pruneChats(state, 30);
  assert.equal(pruned.chats.length, 30);
  assert.ok(pruned.chats.some(chat => chat.id === 'c0'), 'the active chat survives even though it is the oldest');
  // The 29 most recently updated others (c6..c34) plus the active one (c0).
  for (let i = 6; i <= 34; i++) assert.ok(pruned.chats.some(chat => chat.id === `c${i}`));
});

test('pruneChats with no active chat simply keeps the most recently updated ones', () => {
  const chats = Array.from({ length: 32 }, (_, i) => ({ ...newChat('es'), id: `c${i}`, updatedAt: new Date(2026, 0, i + 1).toISOString() }));
  const pruned = pruneChats({ chats, activeId: null }, 30);
  assert.equal(pruned.chats.length, 30);
  assert.equal(pruned.chats.some(chat => chat.id === 'c0'), false);
  assert.equal(pruned.chats.some(chat => chat.id === 'c1'), false);
  assert.ok(pruned.chats.some(chat => chat.id === 'c31'));
});

test('suggestions returns six bilingual prompts covering a mix of modes', () => {
  for (const language of ['es', 'va']) {
    const list = suggestions(language);
    assert.equal(list.length, 6);
    for (const item of list) {
      assert.ok(item.text.length > 0);
      assert.ok(['explain', 'summary', 'keypoints', 'flashcards', 'quiz', 'chat'].includes(item.mode));
    }
    const modes = new Set(list.map(item => item.mode));
    assert.ok(modes.has('chat') && modes.has('quiz') && modes.has('flashcards'), 'covers more than a single mode');
  }
  assert.notDeepEqual(suggestions('es'), suggestions('va'));
});

test('serializable turns a stuck "streaming" message into a gentle error, in the right language, and is stable to call twice', () => {
  const chat = { ...newChat('es'), messages: [msg({ id: 'a', text: 'a medi', status: 'streaming' }), msg({ id: 'b', text: 'listo', status: 'done' })] };
  const state = { chats: [chat], activeId: chat.id };
  const once = serializable(state);
  assert.equal(once.chats[0].messages[0].status, 'error');
  assert.ok(once.chats[0].messages[0].error.length > 0);
  assert.equal(once.chats[0].messages[1].status, 'done');
  assert.equal(once.chats[0].messages[1].text, 'listo', 'finished messages are untouched');

  const vaChat = { ...newChat('va'), messages: [msg({ id: 'a', text: 'a mig', status: 'streaming' })] };
  const vaOnce = serializable({ chats: [vaChat], activeId: null });
  assert.notEqual(vaOnce.chats[0].messages[0].error, once.chats[0].messages[0].error, 'the error text is translated');

  // Calling it again on its own output changes nothing further (idempotent / stable).
  const twice = serializable(once);
  assert.deepEqual(twice, once);
});

test('chatsStoreKey namespaces by demo vs real account, like the other student tools', () => {
  const demoKey = chatsStoreKey({ demo: true, userId: 'u1' });
  const realKey = chatsStoreKey({ demo: false, userId: 'u1' });
  assert.notEqual(demoKey, realKey);
  assert.match(demoKey, /tutor-chats/);
});

test('emptyChats is the inert starting point', () => {
  assert.deepEqual(emptyChats, { chats: [], activeId: null });
});
