# Estándar de ciclo de vida de series e inscripción a torneos

## Alcance

Aplica a series de club, temporadas, torneos, inscripciones y cobros asociados.
El backend y la base de datos son la fuente de verdad; la interfaz solo refleja
las decisiones del servidor.

## Series y temporadas

- Toda serie nueva se crea activa. El cliente no puede forzar una creación inactiva.
- Al cerrar una temporada se desactivan todas las series de los clubes de la misma
  organización.
- Las series no se reactivan automáticamente al abrir una temporada posterior.
- El cierre de temporada exige autorización administrativa sobre la organización.

## Eliminación

- Una serie inscrita en cualquier torneo no puede eliminarse.
- La integridad se protege tanto con una validación del backend como con una clave
  foránea `ON DELETE RESTRICT`/`NO ACTION`.
- El backend devuelve un código de error estable para que la interfaz explique el
  bloqueo sin depender del texto del motor de base de datos.

## Torneos activos e inscripción

- Se consideran activos los torneos `REGISTRATION` e `IN_PROGRESS`.
- Solo `REGISTRATION` admite nuevas inscripciones.
- Una serie es elegible únicamente si está activa, pertenece a la misma organización,
  coincide con la categoría requerida, aún no está inscrita y cumple cupos y demás
  restricciones configuradas.
- La inscripción de club, generación de cobro e inscripción de serie es atómica e
  idempotente: no debe dejar estados parciales si una etapa falla.
- Las decisiones de elegibilidad se exponen con resultado y razones estables para
  que el frontend pueda deshabilitar acciones y explicar el motivo.

## Contratos de visualización

- La vista de club puede consultar torneos activos y visualizar su detalle sin
  obtener permisos administrativos de organización.
- El detalle incluye encabezado descriptivo y participantes con número visual,
  club, serie, estado y estado de inscripción/pago.
- El número de fila es solo presentación y no forma parte del contrato persistido.
