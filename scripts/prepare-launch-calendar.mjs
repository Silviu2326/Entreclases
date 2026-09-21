import { writeFile } from 'node:fs/promises';
import { LAUNCH_TIMESTAMP } from '../lib/launch/config.ts';
const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace('.000','');
const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Entreclases//Lanzamiento//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:lanzamiento-20260928@entreclases.com','DTSTAMP:20260921T000000Z',`DTSTART:${stamp(LAUNCH_TIMESTAMP)}`,`DTEND:${stamp(LAUNCH_TIMESTAMP+15*60*1000)}`,'SUMMARY:Entreclases - lanzamiento en Valencia','DESCRIPTION:Apertura prevista de Entreclases. Consulta el estado en','  https://www.entreclases.com/. Registro sujeto a apertura confirmada.','URL:https://www.entreclases.com/','STATUS:TENTATIVE','TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'];
await writeFile(new URL('../public/entreclases-lanzamiento.ics',import.meta.url),lines.join('\r\n')+'\r\n');
console.log('Calendario preparado para '+new Date(LAUNCH_TIMESTAMP).toISOString());
