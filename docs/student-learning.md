# Centro de estudio durante todo el curso

## Recorrido

La creación de asignaturas solo exige un nombre. Tema actual, objetivo, curso y fecha de examen son opcionales; curso y fecha se despliegan cuando se necesitan. Una asignatura se puede archivar y recuperar sin perder sus materiales.

La mesa propone continuar, repasar conceptos pendientes o avanzar en una asignatura. Las sesiones de 5, 10 y 20 minutos combinan diagnóstico, explicación, preguntas, detección de errores, casos, ordenar pasos y explicar con palabras propias. Preferencias e intereses son editables; importar intereses del perfil requiere una acción explícita.

Las citas se validan contra el texto aportado. Esa comprobación acredita el fragmento, no garantiza que toda interpretación del modelo sea correcta. La demo usa una lección determinista identificada como ejemplo. La explicación libre en demo se autoevalúa y no cuenta como recuerdo independiente.

La memoria considera ayudas, errores y días distintos de práctica. Repasos a 1/3/7/14 días; no se infiere dominio de un solo acierto. Se conservan completas las últimas 20 sesiones terminadas y todas las pendientes. Las anteriores pasan a resúmenes con tema, fecha, actividades y progreso, evitando duplicar sus documentos indefinidamente. El historial del curso sigue siendo consultable.

## Persistencia y privacidad

`universe_student_state` guarda por cuenta y herramienta: asignaturas, texto de apuntes, aprendizaje, tests, notas/calificaciones, calendario, trabajo en equipo y bibliotecas. RLS exige titularidad y membresía. La RPC de guardado utiliza revisión optimista: un dispositivo no sobrescribe silenciosamente cambios de otro. Ante conflicto se ofrece descargar la copia local y cargar la versión de la cuenta. La demo solo guarda en el navegador.

Cada herramienta tiene límite de 4 MB en la base de datos. Los errores de cuota y conexión se muestran y permiten exportar una copia del estado en memoria. Las fotos de apuntes mantienen el comportamiento anterior: son temporales, no se guardan en la nube. Las sesiones guiadas requieren texto; los archivos originales no se suben a este almacén. La conversación libre anterior del tutor conserva su persistencia propia.

## Activación pendiente en el proyecto correcto

Proyecto de Entreclases: `avngidebyxsliavjkfvp`. La sesión CLI disponible durante la implementación pertenece a otra cuenta; no se han aplicado migraciones ni desplegado funciones en proyectos ajenos.

1. Autenticar Supabase CLI con una cuenta que tenga acceso a ese proyecto.
2. Revisar y aplicar `supabase/migrations/202609270033_student_learning.sql` después de las migraciones previas. Vincular explícitamente ese proyecto y revisar `supabase db push --dry-run` antes de aplicar las pendientes.
3. Configurar en los secretos de las Edge Functions `OPENAI_API_KEY`. No debe existir una variante NEXT_PUBLIC de esa clave. Opcional: `STUDY_MODEL` (por defecto `gpt-6-luna`). `OPENAI_BASE_URL` solo si se usa un endpoint administrado y de confianza.
4. Desplegar `study-tutor` y `study-session` con `--project-ref avngidebyxsliavjkfvp`. Ambas validan sesión y consumen cuotas compartidas: 6 preparaciones y 30 consultas/evaluaciones al día por miembro.
5. Publicar el frontend y probar con una cuenta real: crear asignatura sin examen, vincular texto, generar una sesión, explicar con palabras propias, recargar y abrirla desde otro dispositivo. Confirmar una cita y un error intencionado con material conocido antes de abrirlo a usuarios.

El antiguo `study-tutor` cambia de Anthropic a OpenAI Responses manteniendo su contrato de streaming. No basta con desplegar el frontend: la migración y el secreto son necesarios. No se ha probado una llamada real al modelo sin ese acceso.

## Verificación local

- TypeScript del frontend y Deno de ambas funciones.
- Build de Next.js.
- Tests `student-learning`, `student-learning-policy`, `student-openai` y `student-tutor`.
- Navegador: asignatura sin fecha, preferencias, sesión con todos los tipos, ayuda, pausa/recarga/continuación, cierre, progreso y móvil sin desbordamiento.
