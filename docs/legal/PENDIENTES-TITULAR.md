# Cierre del paquete legal — Entreclases

La web incluye siete documentos en español y valenciano: aviso legal, condiciones, privacidad, cookies/almacenamiento, normas de comunidad, ejercicio de derechos/baja y denuncias/revisión. No están aprobados como documentos definitivos. La regla de 18 años es una propuesta conservadora para esta versión, pendiente de confirmar por el titular.

## Datos que debe proporcionar el titular

| Dato | Configuración de compilación | Qué facilitar |
| --- | --- | --- |
| Titular | `LEGAL_CONTROLLER_NAME` | Nombre completo o razón social de quien presta el servicio y decide los tratamientos. No inferirlo del usuario de GitHub. |
| Identificación fiscal | `LEGAL_CONTROLLER_TAX_ID` | NIF/CIF que corresponda. |
| Domicilio | `LEGAL_CONTROLLER_ADDRESS` | Dirección completa de contacto legal. |
| Registro | `LEGAL_CONTROLLER_REGISTRY` | Datos registrales de la entidad o «No procede» confirmado por el titular. |
| DPD, si existe | `LEGAL_DPO_CONTACT` | Contacto del delegado efectivamente designado. Puede quedar vacío si no se ha designado ni resulta exigible. |
| Proveedores | `LEGAL_PROVIDER_DETAILS` | Entidades contratadas, funciones, región efectiva, países de acceso, encargados/subencargados, mecanismo de transferencia y cómo obtener copia de las garantías. |
| Conservación | `LEGAL_RETENTION_DETAILS` | Plazos reales y aprobados para soporte, seguridad, invitaciones, copias y datos restringidos tras la baja; procedimiento de eliminación. |

Configurar en el entorno privado del despliegue y recompilar: son páginas estáticas. Aunque las variables no lleven NEXT_PUBLIC, estos campos se publican deliberadamente en el HTML. No añadir credenciales ni documentos privados. Actualmente la información de proveedor/conservación es un texto común a ambos idiomas; proporcionar una redacción bilingüe cuando se complete.

`hola@entreclases.com` es el contacto que ya figuraba en el proyecto. Confirmar propiedad, recepción y atención humana; no se ha enviado ningún mensaje ni comprobado su entrega. Si cambia, actualizar el contacto central y las menciones de los documentos antes de compilar.

## Decisiones y comprobaciones previas a retirar el aviso de borrador

1. Confirmar el acceso de mayores de 18 años. Una casilla no verifica documentalmente la edad; el correo universitario tampoco. Si se admiten menores, revisar el producto, invitados, privacidad por defecto y tratamiento de sus datos antes de cambiar solo el texto.
2. Confirmar responsable y el régimen aplicable con asesoramiento jurídico, incluyendo DSA, condición de plataforma y posibles excepciones para micro/pequeñas empresas. El procedimiento de revisión de seis meses se propone como compromiso del servicio, sin afirmar que todas las obligaciones DSA sean automáticamente exigibles por igual.
3. Revisar los contratos de Vercel, Supabase y del proveedor efectivo de correo. No basta con escoger una región europea para descartar transferencias: revisar soporte, subencargados y garantías. No afirmar una adhesión al Data Privacy Framework sin comprobar la entidad y alcance vigentes.
4. Completar el inventario de cookies/conexiones en la URL de producción. No se han comprobado las cabeceras, scripts inyectados por el hosting ni las respuestas de todos los catálogos. Las imágenes externas se cargan al mostrar perfiles. Si incorporan tratamientos o almacenamiento que requieran consentimiento, bloquearlos previamente e implementar aceptar/rechazar y retirada con la misma facilidad. No se ha añadido un banner ficticio.
5. Revisar la base y prueba de la elección de campos opcionales y juegos sociales. Hay situación sentimental, biografías, gustos y posibles inferencias delicadas. No calificar todos los datos como ordinarios ni amparar datos del art. 9 RGPD en una aceptación general; determinar si procede consentimiento explícito, limitar campos o retirar funciones. Evaluar necesidad de EIPD y DPD según el tratamiento real.
6. Mantener prueba de la aceptación: el formulario envía versión de condiciones, versión del aviso y declaración de mayoría de edad en los metadatos de alta. Esos metadatos son editables por la persona usuaria; **no son un registro inmutable ni bastan como prueba de consentimiento**. Antes de apertura, registrar en servidor fecha, cuenta, versión e idioma en una tabla protegida, validar las declaraciones y diseñar aceptación de cambios para cuentas existentes y clientes móviles. No se ha añadido una migración ni un control de edad en servidor en este cambio.
7. Activar los procedimientos humanos del manual operativo: derechos, denuncias, revisión, incidentes y eliminación. Un enlace de correo no crea por sí solo un expediente ni garantiza acuse. Debe haber responsables y acceso efectivo al buzón.
8. Aplicar las migraciones 017 y 018 de la propuesta de lanzamiento antes de publicar las reglas de acceso y ClasiCoins de estos documentos. Esta entrega no cambia producción.
9. Documentar la lista de correo del prelanzamiento (`public.universe_waitlist`, migración 020) antes de publicarla: base jurídica del aviso de apertura, plazo de conservación de las direcciones que no lleguen a ser cuenta, procedimiento de baja y supresión a petición, y quién accede a la tabla con clave de servidor. El formulario informa y enlaza a privacidad, pero la política todavía no describe este tratamiento.

Solo tras completar lo anterior: `LEGAL_REVIEW_COMPLETED=true`. El aviso de borrador permanece si faltan datos esenciales aunque se active esa variable. Esa variable es una marca editorial, no una certificación de cumplimiento. Un abogado especializado debe validar la versión final con los datos y configuración reales.

## Fuentes consultadas

- [LSSI, especialmente arts. 10, 21, 22 y 27](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758).
- [RGPD, información, bases, derechos, categorías especiales y encargados](https://www.boe.es/doue/2016/119/L00001-00088.pdf).
- [LOPDGDD, incluidos menores y bloqueo de datos](https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673).
- [Reglamento de Servicios Digitales, condiciones, notificaciones, motivación y revisión](https://www.boe.es/doue/2022/277/L00001-00102.pdf).
- [Guía sobre cookies de la AEPD](https://www.aepd.es/guias/guia-cookies.pdf).

Consulta realizada el 21 de septiembre de 2026. Textos redactados para las funciones del repositorio; no se han copiado condiciones de otra plataforma ni añadido una renuncia general a responsabilidad o una cesión completa de los proyectos de usuarios.
