import { writeFile } from 'node:fs/promises';
import { legalSections } from '../lib/legal/content.ts';
import { legalTitles, LEGAL_VERSION, LEGAL_CONTACT } from '../lib/legal/config.ts';

for (const locale of ['es','va']) {
 const va=locale==='va';
 let text=va ? '# Entreclases — Textos legals\n\n' : '# Entreclases — Textos legales\n\n';
 text+=`**${va?'Esborrany pendent de completar i validar':'Borrador pendiente de completar y validar'} · ${LEGAL_VERSION}**\n\n`;
 text+=va ? 'Falten la identificació del titular, les dades de proveïdors i conservació i la comprovació de les mesures operatives. La regla de 18 anys és una proposta pendent de confirmar. No és una versió final aprovada.\n\n' : 'Faltan la identificación del titular, los datos de proveedores y conservación y la comprobación de las medidas operativas. La regla de 18 años es una propuesta pendiente de confirmar. No es una versión final aprobada.\n\n';
 text+=`[${va?'Dades pendents del titular':'Datos pendientes del titular'}](PENDIENTES-TITULAR.md) · [${va?'Procediments operatius':'Procedimientos operativos'}](OPERACIONES.md)\n\n`;
 text+=`**${va?'Titular, NIF/CIF, domicili i registre':'Titular, NIF/CIF, domicilio y registro'}:** ${va?'pendent de facilitar':'pendiente de facilitar'}.\n\n**${va?'Contacte previst':'Contacto previsto'}:** ${LEGAL_CONTACT} (${va?'pendent de confirmar atenció efectiva':'pendiente de confirmar atención efectiva'}).\n\n`;
 for(const kind of Object.keys(legalTitles)) {
  text+=`---\n\n## ${legalTitles[kind][va?1:0]}\n\n`;
  for(const section of legalSections(kind,locale)){
   text+=`### ${section.title}\n\n`;
   for(const p of section.paragraphs)text+=`${p}\n\n`;
   for(const p of section.bullets)text+=`- ${p}\n`;
   if(section.bullets.length)text+='\n';
  }
 }
 text+=`---\n\n${va?'Fonts normatives i notes de revisió':'Fuentes normativas y notas de revisión'}: [PENDIENTES-TITULAR.md](PENDIENTES-TITULAR.md).\n`;
 await writeFile(new URL(`../docs/legal/TEXTOS-${locale.toUpperCase()}.md`,import.meta.url),text);
}
console.log('Exportados los textos legales en español y valenciano.');
