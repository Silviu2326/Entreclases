import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), require=createRequire(import.meta.url), cache=new Map();
function load(relative){let filename=resolve(root,relative);if(!extname(filename))filename=['.tsx','.ts','/index.ts','/index.tsx'].map(ext=>filename+ext).find(existsSync);if(extname(filename)==='.css')return {};if(cache.has(filename))return cache.get(filename).exports;const loadedModule={exports:{}};cache.set(filename,loadedModule);const code=ts.transpileModule(readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(path=>path.startsWith('@/')?load(path.slice(2)):path.startsWith('.')?load(resolve(dirname(filename),path)):path==='next/navigation'?router:require(path),loadedModule,loadedModule.exports);return loadedModule.exports;}
const router={useRouter:()=>({push(){},replace(){}}),useSearchParams:()=>new URLSearchParams(),usePathname:()=>'/'};
const {parseMarkdown,parseInline,readingMinutes,slugify}=load('lib/blog/markdown');
const {posts,postBySlug,postPath,postUrl}=load('lib/blog/posts');
const {blogPostMetadata,blogIndexMetadata}=load('lib/blog/metadata');
const {BlogPost}=load('components/entreclase/blog-post');
const {BlogIndex}=load('components/entreclase/blog-index');
const {routes}=load('lib/i18n/routes');
const {pageMetadata}=load('lib/i18n/metadata');
const sitemap=load('app/sitemap').default;
// Outside Next the Link component drops the trailing slash the site adds at build time.
const bare=path=>path.replace(/\/$/,'');

test('The Markdown subset renders headings, lists, quotes and inline marks, and nothing else',()=>{
 const blocks=parseMarkdown('## Título con acento\n\nPárrafo con **negrita**, *cursiva* y [un enlace](/blog/).\nSigue el párrafo.\n\n- uno\n- dos\n\n1. primero\n2. segundo\n\n> cita\n\n### Sub\n\n## Título con acento');
 assert.deepEqual(blocks.map(b=>b.kind),['heading','paragraph','list','list','quote','heading','heading']);
 assert.equal(blocks[0].id,'titulo-con-acento');
 assert.equal(blocks[6].id,'titulo-con-acento-2');
 assert.deepEqual(blocks[1].inline,[{kind:'text',text:'Párrafo con '},{kind:'strong',text:'negrita'},{kind:'text',text:', '},{kind:'em',text:'cursiva'},{kind:'text',text:' y '},{kind:'link',text:'un enlace',href:'/blog/'},{kind:'text',text:'. Sigue el párrafo.'}]);
 assert.equal(blocks[2].ordered,false);assert.equal(blocks[3].ordered,true);assert.equal(blocks[3].items.length,2);
 assert.equal(blocks[5].level,3);
 // Raw HTML is text, never markup.
 assert.deepEqual(parseInline('<script>alert(1)</script>'),[{kind:'text',text:'<script>alert(1)</script>'}]);
 assert.equal(slugify('Où étudier à València?'),'ou-etudier-a-valencia');
 assert.equal(readingMinutes('palabra '.repeat(450)),2);
});

test('Every post has a distinct slug per language, a date, a keyword and a description that fits a result snippet',()=>{
 for(const locale of ['es','va']){
  const slugs=posts.map(p=>p[locale].slug);
  assert.equal(new Set(slugs).size,posts.length);
  for(const post of posts){
   const text=post[locale];
   assert.match(text.slug,/^[a-z0-9-]+$/);
   assert.ok(text.title.length>20&&text.title.length<=110,`${text.slug} title length`);
   assert.ok(text.description.length>=80&&text.description.length<=200,`${text.slug} description length ${text.description.length}`);
   assert.ok(text.keyword.length>4);
   assert.ok(readingMinutes(text.body)>=3,`${text.slug} is long enough to be worth indexing`);
   assert.match(post.date,/^\d{4}-\d{2}-\d{2}$/);
   assert.ok(existsSync(resolve(root,'public'+post.cover)));
   assert.equal(postBySlug(locale,text.slug),post);
   // The other language is reachable through the slug of that language, never through a Spanish slug on the Valencian path.
   assert.ok(postPath(locale,post).startsWith(routes[locale].blog));
  }
 }
 // The Valencian slug of a post is never its Spanish slug: the two pages would otherwise fight for one URL.
 for(const post of posts)assert.notEqual(post.es.slug,post.va.slug);
 // Newest first.
 for(let i=1;i<posts.length;i++)assert.ok(posts[i-1].date>=posts[i].date);
});

test('Internal links inside the posts point at pages that exist, in the same language',()=>{
 const known=new Set([...Object.values(routes.es),...Object.values(routes.va),...posts.flatMap(p=>[postPath('es',p),postPath('va',p)])]);
 for(const post of posts)for(const locale of ['es','va']){
  for(const block of parseMarkdown(post[locale].body)){
   const inline=block.kind==='list'?block.items.flat():block.inline;
   for(const part of inline)if(part.kind==='link'&&part.href.startsWith('/')){
    assert.ok(known.has(part.href),`${post[locale].slug} links to ${part.href}`);
    assert.equal(part.href.startsWith('/va/'),locale==='va',`${post[locale].slug} keeps the language in ${part.href}`);
   }
  }
 }
});

test('The blog pages are indexable, announce their twin and carry structured data',()=>{
 for(const locale of ['es','va']){
  assert.equal(pageMetadata(locale,'blog').robots,undefined);
  const index=blogIndexMetadata(locale);
  assert.equal(index.alternates.canonical,routes[locale].blog);
  assert.equal(index.alternates.languages['ca-ES'],'https://www.entreclases.com'+routes.va.blog);
  const html=renderToStaticMarkup(React.createElement(BlogIndex,{locale}));
  assert.match(html,/<h1>/);assert.match(html,/"@type":"Blog"/);
  for(const post of posts)assert.ok(html.includes(`href="${bare(postPath(locale,post))}"`),`index lists ${post.id}`);
  assert.ok(html.includes(`href="${bare(routes[locale==='va'?'es':'va'].blog)}"`));
  for(const post of posts){
   const meta=blogPostMetadata(locale,post);
   assert.equal(meta.alternates.canonical,postPath(locale,post));
   assert.equal(meta.alternates.languages.es,postUrl('es',post));
   assert.equal(meta.alternates.languages['ca-ES'],postUrl('va',post));
   assert.equal(meta.robots,undefined);
   assert.equal(meta.openGraph.type,'article');
   const page=renderToStaticMarkup(React.createElement(BlogPost,{locale,post}));
   assert.ok(page.includes(`<h1>${post[locale].title.replace(/&/g,'&amp;')}</h1>`)||page.includes('<h1>'),`${post.id} has a heading`);
   assert.match(page,/"@type":"BlogPosting"/);assert.match(page,/"@type":"BreadcrumbList"/);
   assert.ok(!page.includes('</script><script>alert'),'structured data cannot be escaped from');
   assert.ok(page.includes(`href="${bare(postPath(locale==='va'?'es':'va',post))}"`),`${post.id} links its twin`);
   assert.ok(page.includes(`href="${bare(routes[locale].roadmap)}"`),`${post.id} links the roadmap`);
   assert.ok(!page.includes('[object Object]'));
  }
 }
});

test('The sitemap lists the public pages and every post in both languages, and nothing private',()=>{
 const entries=sitemap(), urls=entries.map(e=>e.url);
 for(const name of ['home','roadmap','blog'])for(const locale of ['es','va'])assert.ok(urls.includes('https://www.entreclases.com'+routes[locale][name]));
 for(const post of posts)for(const locale of ['es','va']){
  const entry=entries.find(e=>e.url===postUrl(locale,post));
  assert.ok(entry,`${post.id} ${locale} in sitemap`);
  assert.equal(entry.lastModified,post.updated??post.date);
  assert.equal(entry.alternates.languages['ca-ES'],postUrl('va',post));
 }
 for(const name of ['app','demo','login','register','account','legal'])for(const locale of ['es','va'])assert.ok(!urls.includes('https://www.entreclases.com'+routes[locale][name]),`${name} stays out`);
 assert.ok(!existsSync(resolve(root,'public/sitemap.xml')),'the static sitemap would shadow the generated one');
 assert.equal(new Set(urls).size,urls.length);
});
