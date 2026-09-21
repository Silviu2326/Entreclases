# Operación legal de Entreclases

Propuesta de trabajo para el titular. Completar nombres de responsables, accesos y plazos internos; el código por sí solo no ejecuta estos procedimientos.

## Solicitudes de datos y baja

1. Registrar fecha de recepción, contacto, derecho solicitado, datos afectados y vencimiento de respuesta. Evitar duplicar documentos sensibles en chats de equipo.
2. Verificar identidad de forma proporcionada. Preferir sesión o correo verificado; no pedir DNI de forma sistemática. Facilitar alternativa si perdió acceso al correo.
3. Responder normalmente en un mes. Si procede prórroga de hasta dos meses adicionales, comunicarla con el motivo dentro del primer mes. Documentar excepciones o denegaciones y vías de reclamación.
4. Para acceso/portabilidad, incluir datos del interesado en formato adecuado sin revelar información de terceros ni credenciales. Revisar conversaciones, candidaturas y archivos compartidos.
5. Para baja, inventariar auth.users, perfil, almacenamiento de imágenes/apuntes/proyectos, mensajes, candidaturas, juegos, revista, invitaciones y registros de puntos. **No ejecutar solo un DELETE de auth.users**: comprobar cada dependencia, cascada y fichero antes de actuar.
6. `universe_plus_one` conserva identificadores y correo después de borrar cuentas; no tiene cascada para impedir reuso de plazas. Revisar eliminación o anonimización y registrar la base/plazo de cualquier dato mínimo que se conserve. Caducar una invitación a los siete días no borra la fila.
7. Diferenciar publicación retirada, eliminación de archivos activos, bloqueo legal, backups y copias de terceros. Registrar las acciones y explicar las limitaciones concretas. Revisar que una restauración de backup no reactive una cuenta suprimida.

## Denuncias y revisión

Canal público: hola@entreclases.com, accesible sin cuenta desde /denunciar/. Asignar una persona responsable y otra capaz de revisar la decisión cuando sea posible.

- Registrar identificador del caso, recepción, localización del contenido, hechos, norma invocada y contacto. La declaración de buena fe acompaña la plantilla de correo; la identidad tiene la excepción legal para avisos de abuso sexual infantil. El correo puede aportar datos de contacto incluso cuando no se exija un nombre; no prometer anonimato absoluto.
- Acusar recibo sin dilación indebida cuando haya contacto. Priorizar amenazas inmediatas, explotación sexual infantil, imágenes íntimas no consentidas y exposición de datos. No descargar ni redistribuir material ilícito; preservar solo evidencia necesaria y lícita.
- Revisar contexto y evidencias, sin convertir el número de avisos en retirada automática. Distinguir norma comunitaria de ilicitud y documentar medidas temporales.
- Comunicar resolución y motivos a las partes en lo procedente, sin exponer innecesariamente al denunciante: hechos, fundamento contractual/legal, medida, duración, alcance y vías de revisión. Indicar si se utilizaron sistemas automáticos; no afirmar que existen si no los hay.
- Conservar una vía gratuita de revisión durante al menos seis meses desde la notificación, conforme al compromiso propuesto. Revisar con intervención humana, corregir errores y comunicar el resultado.
- Comprobar las obligaciones efectivamente aplicables de DSA, incluyendo contacto con autoridades, transparencia, comunicación de sospechas de delitos graves y recursos externos. No asumir que ser una startup elimina todas las obligaciones de alojamiento.

## Matriz de conservación que debe aprobar el titular

| Categoría | Criterio propuesto | Pendiente de confirmar |
| --- | --- | --- |
| Cuenta y perfil | Prestación del servicio; supresión/baja y excepciones justificadas | Cómo se ejecuta la baja y qué datos pasan a bloqueo |
| Publicaciones, mensajes y equipos | Finalidad elegida, derechos de terceros y solicitudes | Tratamiento de hilos compartidos y propiedad de proyectos |
| Invitaciones no usadas | Validez de siete días; minimización posterior | Tarea de purga y plazo máximo de la fila, no implementados |
| Invitaciones usadas y puntos | Mínimo necesario para evitar reutilización y atender discrepancias | Justificación, anonimización y revisión periódica |
| Soporte, denuncias y revisiones | Tiempo de tramitación/revisión y posibles reclamaciones | Plazo por finalidad y acceso restringido |
| Registros de seguridad | Detección/investigación de incidentes | Plazo real de cada proveedor y capacidad de borrado |
| Backups | Recuperación del servicio, con acceso restringido | Ciclo de rotación, purga y reejecución de supresiones |

No introducir plazos arbitrarios en la web antes de confirmar que pueden cumplirse. Mantener registro de actividades y una ponderación documentada para cada interés legítimo usado.

## Incidentes

Registrar descubrimiento, alcance, datos/personas afectadas, contención y evidencias. Evaluar si existe una violación de seguridad de datos personales y el riesgo. Cuando proceda, notificar a la autoridad sin dilación indebida y, de ser posible, en 72 horas desde que se tiene constancia; justificar retrasos. Informar también a los afectados cuando exista alto riesgo y no concurra excepción aplicable. No prometer ausencia total de incidentes ni cifrado de extremo a extremo que el producto no tenga.

## Proyectos y promoción

Antes de promocionar un proyecto fuera de su espacio: documentar quién autoriza, qué materiales, autores/personas visibles, canales, finalidad, duración y retirada. La aceptación de condiciones no cede proyectos a Entreclases. Comprobar derechos de imágenes, música, marcas y portadas de catálogos. Un acuerdo entre participantes sobre propiedad, remuneración y salida es independiente de las condiciones de la plataforma.
