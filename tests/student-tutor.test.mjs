import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
// Compile only the local, pure TypeScript module under test; no browser,
// network or Supabase client involved — demo-tutor.ts only imports types.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function load(relative) {
  const filename = resolve(root, relative);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    (path) => { assert.ok(path.startsWith('.')); return load(resolve(dirname(filename), path) + '.ts'); },
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}
const { demoTutor } = load('lib/community/student/demo-tutor.ts');

// ~830 characters: several paragraphs, proper nouns, dates, colon and "es"
// definitions, so every demo mode (summary, keypoints, flashcards, quiz) has
// real material to work with.
const NOTES_ES = `La Revolución Francesa comenzó en 1789 y transformó Europa para siempre. La Bastilla era una prisión símbolo del absolutismo: el pueblo de París la asaltó el 14 de julio de ese año. La Asamblea Nacional es el órgano que redactó la Declaración de los Derechos del Hombre y del Ciudadano.

Robespierre lideró el periodo conocido como el Terror, que duró desde 1793 hasta 1794. Durante esos meses miles de personas fueron ejecutadas mediante la guillotina, un instrumento que se convirtió en símbolo del periodo. La guillotina es un aparato diseñado para ejecutar de forma rápida.

Napoleón Bonaparte aprovechó la inestabilidad para tomar el poder en 1799. Su golpe de estado, el 18 de Brumario, puso fin al Directorio. Es importante recordar que la Revolución cambió para siempre la relación entre el pueblo y el Estado en toda Europa.`;

const NOTES_VA = `La Revolució Francesa va començar en 1789 i va transformar Europa per sempre. La Bastilla era una presó símbol de l'absolutisme: el poble de París la va assaltar el 14 de juliol d'eixe any. L'Assemblea Nacional és l'òrgan que va redactar la Declaració dels Drets de l'Home i del Ciutadà.

Robespierre va liderar el període conegut com el Terror, que va durar des de 1793 fins a 1794. Durant eixos mesos milers de persones van ser executades mitjançant la guillotina, un instrument que es va convertir en símbol del període. La guillotina és un aparell dissenyat per a executar de forma ràpida.

Napoleó Bonaparte va aprofitar la inestabilitat per a prendre el poder en 1799. El seu colp d'estat, el 18 de Brumari, va posar fi al Directori. És important recordar que la Revolució va canviar per sempre la relació entre el poble i l'Estat a tota Europa.`;

test('El resumen, los puntos clave, las tarjetas y el chat trabajan con el texto real de los apuntes', async () => {
  const summary = await demoTutor({ mode: 'summary', language: 'es', notes: NOTES_ES });
  assert.equal(summary.warning, undefined, 'con texto suficiente no hay aviso');
  assert.ok(summary.text.includes('- '), 'el resumen es una lista');
  assert.ok(summary.text.toLowerCase().includes('revolución'), 'usa el texto real, no un genérico');

  const keypoints = await demoTutor({ mode: 'keypoints', language: 'es', notes: NOTES_ES });
  assert.ok(keypoints.text.length > 0);
  assert.ok(keypoints.topics.length >= 1 && keypoints.topics.length <= 5);

  const flashcards = (await demoTutor({ mode: 'flashcards', language: 'es', notes: NOTES_ES })).flashcards;
  assert.ok(flashcards.length >= 6, `se esperaban al menos 6 tarjetas, hubo ${flashcards.length}`);
  for (const card of flashcards) {
    assert.ok(card.front.trim().length > 0);
    assert.ok(card.back.trim().length > 0);
  }

  const explain = await demoTutor({ mode: 'explain', language: 'es', notes: NOTES_ES, question: '¿Quién fue Robespierre?' });
  assert.ok(explain.text.toLowerCase().includes('robespierre'), 'la respuesta debe tocar lo que se pregunta');

  const chat = await demoTutor({
    mode: 'chat', language: 'es', notes: NOTES_ES,
    history: [{ role: 'user', text: '¿Qué pasó con Napoleón?' }, { role: 'assistant', text: 'Tomó el poder en 1799.' }, { role: 'user', text: '¿Y la guillotina?' }],
  });
  assert.ok(chat.text.toLowerCase().includes('guillotina'), 'el chat responde a la última pregunta del historial');
});

test('El quiz saca exactamente el número de preguntas pedido, sin opciones repetidas y con la respuesta dentro de rango', async () => {
  for (const count of [5, 10, 20]) {
    const { quiz, topics } = await demoTutor({ mode: 'quiz', language: 'es', notes: NOTES_ES, count, kind: 'test' });
    assert.equal(quiz.length, count);
    for (const question of quiz) {
      assert.equal(question.options.length, 4, 'test: siempre 4 opciones');
      assert.equal(new Set(question.options).size, 4, 'sin opciones repetidas');
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, 'la respuesta cae dentro del rango de opciones');
      assert.ok(topics.includes(question.topic), 'cada pregunta usa uno de los temas detectados');
    }
  }
});

test('El quiz de verdadero/falso usa las dos opciones fijas del idioma, y el corto no lleva opciones', async () => {
  const truefalseEs = (await demoTutor({ mode: 'quiz', language: 'es', notes: NOTES_ES, count: 10, kind: 'truefalse' })).quiz;
  for (const question of truefalseEs) {
    assert.deepEqual(question.options, ['Verdadero', 'Falso']);
    assert.ok(question.answer === 0 || question.answer === 1);
  }
  const truefalseVa = (await demoTutor({ mode: 'quiz', language: 'va', notes: NOTES_VA, count: 10, kind: 'truefalse' })).quiz;
  for (const question of truefalseVa) {
    assert.deepEqual(question.options, ['Vertader', 'Fals']);
  }
  const short = (await demoTutor({ mode: 'quiz', language: 'es', notes: NOTES_ES, count: 5, kind: 'short' })).quiz;
  for (const question of short) {
    assert.equal(question.options, undefined);
    assert.equal(typeof question.answer, 'string');
    assert.ok(question.answer.length > 0);
  }
});

test('La demo es determinista: mismos apuntes y mismo modo dan siempre el mismo resultado', async () => {
  const request = { mode: 'quiz', language: 'es', notes: NOTES_ES, count: 10, kind: 'test' };
  const first = await demoTutor(request);
  const second = await demoTutor({ ...request });
  assert.deepEqual(first, second);

  const firstCards = await demoTutor({ mode: 'flashcards', language: 'es', notes: NOTES_ES });
  const secondCards = await demoTutor({ mode: 'flashcards', language: 'es', notes: NOTES_ES });
  assert.deepEqual(firstCards, secondCards);
});

test('Un texto demasiado corto avisa pero sigue devolviendo algo utilizable', async () => {
  const short = 'La fotosíntesis convierte luz en energía.';
  const summary = await demoTutor({ mode: 'summary', language: 'es', notes: short });
  assert.ok(summary.warning, 'debe avisar de que hace falta más texto');
  assert.ok(summary.text.length > 0, 'aun así devuelve algo');

  const quiz = await demoTutor({ mode: 'quiz', language: 'va', notes: short, count: 5, kind: 'test' });
  assert.equal(quiz.quiz.length, 5, 'el quiz se rellena aunque el texto sea corto');
});
