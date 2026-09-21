# Preparación del lanzamiento de Entreclases

## Cambios

- Dominio canónico, alternancias de idioma y enlaces sociales en `https://www.entreclases.com`; robots y sitemap.
- Portada con demo temprana, mensaje de una invitación por cuenta universitaria y marca consistente.
- Inicio centrado en próximos planes, grupos y conversaciones; navegación directa a planes, grupos, apuntes y proyectos. El mapa se carga al abrirlo.
- Avisos ficticios limitados a la demo.
- Primer hilo gratuito por cuenta sin hilos cobrados anteriormente. Los siguientes cuestan 5 ClasiCoins. Inscribirse en un plan ya no da monedas. Se conservan saldos e historiales.
- Dominios de prueba separados de la instalación inicial y desactivados por la migración de lanzamiento.
- Regiones de acceso controladas en servidor: Valencia abierta, Madrid cerrada. No se añade ni habilita ningún dominio universitario real.
- Páginas de privacidad y condiciones en ambos idiomas, con contacto accesible. Su información legal está pendiente de completar.

## Actualizar una instalación existente

1. Comprueba qué migraciones están aplicadas y conserva una copia de seguridad de la base de datos.
2. Aplica únicamente las pendientes, en orden, incluidas `202609220017_launch_regions.sql` y `202609220018_participation_incentives.sql`. No ejecutes `setup.sql` en una instalación existente. La migración histórica `202609210016_enable_test_domains.sql` se conserva para no reescribir el historial; la 017 desactiva sus dominios. No dejes esa migración histórica como último estado de producción.
3. Confirma que los dominios universitarios admitidos tienen la región correcta. `opre.com` y `xarly.com` deben seguir desactivados en producción. El script de `supabase/development/` es solo para entornos de pruebas.
4. Completa `LEGAL_CONTROLLER_NAME` y `LEGAL_CONTROLLER_ADDRESS` antes de compilar. Completa también bases jurídicas, conservación y proveedores/transferencias en las páginas legales tras validar la configuración efectiva. Confirma que `hola@entreclases.com` recibe correo. Los textos actuales no son una política legal final.
5. Compila y publica la aplicación con las variables del entorno de producción. Al ser una exportación estática, cambiar las variables legales requiere recompilar.
6. Comprueba un alta universitaria, verificación por correo, primer hilo, invitación +1, perfil invitado, correo de recuperación y navegación móvil en el entorno desplegado.

Este trabajo no ejecuta cambios en Supabase ni publica la web de producción. Las páginas de marketing describen las reglas nuevas y deben publicarse después de actualizar el servidor.

## Instalación nueva

`npm run supabase:prepare` genera `supabase/setup.sql` excluyendo la migración que activa dominios de prueba. Usa ese archivo solo en un proyecto nuevo dedicado. No aplica cambios remotos por sí mismo.

## Antes de abrir Madrid

No basta con activar una fila. Revisa dominios institucionales exactos, campus y lugares, validación de perfiles y el contenido de bienvenida. El catálogo actual sigue centrado en Valencia. Prepara actividad y responsables en una universidad concreta. Después podrá activarse su dominio y la región `madrid` con permisos administrativos; los usuarios no pueden cambiar estas reglas.

## Verificación y límites

- Pruebas automatizadas de autenticación, RLS, invitaciones, saldo y actualización de incentivos en PostgreSQL en memoria.
- Render estático de las pantallas principales en español y valenciano.
- Compilación de producción y lint.
- La conexión del navegador de revisión al servidor local está bloqueada; queda pendiente la comprobación visual interactiva en una URL de despliegue accesible.
- No se ha validado la configuración del proyecto Supabase de producción ni realizado una prueba de concurrencia distribuida.
