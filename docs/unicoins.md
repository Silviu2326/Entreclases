# ClasiCoins: incentivos de participación

Las ClasiCoins son la moneda interna de Entreclase. El propósito es animar a los estudiantes a participar y proponer actividad en su comunidad. No hay compra, venta, transferencia entre cuentas, retirada ni conversión a dinero. No se ha integrado ningún sistema de pagos ni una criptomoneda.

## Reglas de esta versión

| Acción | Movimiento | Condiciones |
| --- | ---: | --- |
| Completar el primer perfil verificado | +20 | Una bienvenida por cuenta. Los perfiles existentes la reciben al abrir su saldo. |
| Crear un evento/plan | −10 | Solo si se crea correctamente. |
| Abrir un hilo del foro | −5 | Publicaciones y preguntas del muro, también en grupos. |
| Apuntarse a un evento ajeno | +3 | Primera inscripción, máximo 2 eventos recompensados al día. |
| Responder a un hilo ajeno | +2 | Primera respuesta en ese hilo, máximo 3 hilos recompensados al día. |

Leer, responder, apuntarse, dar me gusta, mandar mensajes, compartir apuntes y crear o entrar en grupos no consumen ClasiCoins. Los límites de recompensa se renuevan a medianoche de Europe/Madrid. Alcanzarlos no bloquea la participación. Una participación que ocurre después del límite diario no puede repetirse al día siguiente para obtener monedas: la primera oportunidad queda registrada aunque no haya premio.

Salir y volver al mismo evento, responder de nuevo en el mismo hilo, inscribirse en un evento propio o responderse a uno mismo no genera recompensas adicionales. Salirse de un evento no resta las monedas ganadas. Cancelar un evento o eliminar un hilo no devuelve su coste; los movimientos y las oportunidades consumidas no se borran con el contenido. Las acciones anteriores al lanzamiento de ClasiCoins no se cobran ni se recompensan retroactivamente.

Estos importes iniciales son decisiones de producto, no precios en euros. La fuente de interfaz y demo es `lib/community/unicoins.ts`; el contrato de servidor es `universe_coin_rules()` en la migración. Las pruebas comparan ambos. Un cambio posterior de reglas requiere una nueva migración y actualizar los textos correspondientes; no editar una migración ya aplicada.

## Integración

La landing incluye una historia y tabla de reglas, un gancho de bienvenida junto al registro y una explicación explícita de la finalidad. La aplicación muestra saldo en la cabecera, una sección ClasiCoins, los últimos 50 movimientos, contadores diarios, coste antes de crear y avisos de recompensa. Todo está en español y valenciano. La URL de la sección es `/app/?view=unicoins`, con variantes `/va/app/`, `/demo/` y `/va/demo/`.

El foro corresponde al muro existente: crear una publicación o pregunta abre un hilo, y sus comentarios son las respuestas. Las conversaciones privadas permanecen gratuitas y no generan monedas.

La demo mantiene las monedas en memoria durante esa visita. Los perfiles y contenidos precargados se consideran anteriores al sistema; no se les aplican cargos retroactivos. Las inscripciones precargadas ya tienen consumida su oportunidad de recompensa. Recargar, cambiar de idioma o salir reinicia la demo, como el resto de su contenido. Esto no inicializa ni concede saldo en una cuenta real.

## Activar con cuentas reales

La conexión pública de Supabase está comprobada; la instalación de las tablas sigue pendiente. Aplicar `202609090005_unicoins.sql` después de las cuatro migraciones anteriores en el proyecto dedicado a Entreclase, antes de activar esta versión del cliente con cuentas reales. La función de lectura del saldo debe existir; si no existe, la app real muestra el error de preparación y no abre una versión gratuita que omita las reglas.

La migración crea carteras, un registro de movimientos y otro de primeras participaciones. Las políticas RLS permiten leer únicamente los datos propios de una cuenta universitaria verificada y vigente. Los clientes no tienen permisos para insertar, actualizar o borrar saldo, movimientos ni oportunidades. Las funciones internas de crédito y débito no son invocables por clientes; solo las usan triggers del servidor. El endpoint de cartera comprueba al miembro sin aceptar un usuario de destino.

Los triggers cobran y conceden recompensas en la misma transacción que la creación o participación. Bloquean la fila de la cartera al comprobar saldo o límite diario. Un error revierte la operación completa y no deja saldos negativos ni movimientos huérfanos. El identificador del recurso se conserva en los registros aunque ese recurso se elimine, evitando reiniciar la recompensa. Los formularios de creación mantienen un UUID durante el reintento sin editar; si la operación ya se confirmó, el adaptador recupera el registro existente sin volver a cobrar.

## Verificación

Las pruebas ejecutadas sobre PostgreSQL en memoria verifican bienvenida única, contrato de importes, permisos, cargos, fondos insuficientes, revocación, límites diarios, oportunidades ya consumidas, conservación al borrar contenido y reversión transaccional. La demo comprueba débitos, saldo, reintentos e inscripciones repetidas. El render estático incluye la pantalla ClasiCoins en ambos idiomas. No se ha probado en un navegador ni contra un backend Supabase alojado; las pruebas de PostgreSQL usan una conexión y no simulan carga concurrente distribuida.
