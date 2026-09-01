# QA Report — T-20260825-113906

**Timestamp:** 2026-08-25
**Rol:** qa-tester
**Status:** approved

## Resultados de tests
- `backend-liga` `npm test` (node --test): **15/15 pass**, reproducido de forma independiente (no se confió solo en el reporte de backend-dev).
- `frontend-liga` `npm run build` (Vite): build exitoso, sin errores ni warnings relevantes.
- Smoke test e2e (`serverless offline`): **no ejecutado** — requiere credenciales reales de Supabase no disponibles en el sandbox de validación. Se priorizó revisión de código + tests automatizados según instrucción. Recomendado un smoke test manual en un entorno real antes de producción.

## Checklist contra el requerimiento original

1. **Torneo no se puede crear sin costo de inscripción** — ✅ `tournaments_specialist.js:257-267` (MISSING_FIELDS / INVALID_INSCRIPTION_FEE), `request_validator.js:351`, columna NOT NULL en DB. Frontend: `TournamentsList.vue:78-84,369-372`.
2. **Club no aparece en listado de agregar equipo hasta estar inscrito** — ✅ Gate `CLUB_NOT_REGISTERED` en `tournaments_specialist.js:411-417`. Frontend: `TournamentDetail.vue` filtra el dropdown de series a `registeredClubIds` (líneas 276-282) y deshabilita el buscador si no hay clubes inscritos.
3. **Solo se inscribe serie de la categoría del torneo** — ✅ `CATEGORY_MISMATCH` en `tournaments_specialist.js:404-409` (se omite solo si `tournament.category_id` es NULL, caso borde documentado). Filtro best-effort en frontend, backend como autoridad final.
4. **Inscripción permitida a ADMIN org y ADMIN_CLUB (solo su propio club)** — ✅ `assertClubAccess` en `REGISTER_CLUB` (línea 526) y `REGISTER_TEAM` (línea 390). Gap menor de cobertura de test (sin test FORBIDDEN dedicado a REGISTER_CLUB, cubierto indirectamente) — no es un defecto funcional.
5. **Solo torneos disponibles (REGISTRATION + temporada activa si no es admin org)** — ✅ Igual en `_registerClub` (536-549) y `_registerTeam` (400-428). Nota: `TournamentsList.vue` no filtra por status en el listado de administración, pero el gate real está del lado del servidor.
6. **Inscripción de club queda PENDIENTE hasta que admin org registra el pago** — ✅ `createInscriptionCharge` dispara una vez por club con `tournament.inscription_fee`; `computeEntryStatus` devuelve PENDIENTE por defecto. Pago reutiliza el flujo existente, gateado a `authStore.isOrgAdmin()`.

## Notas adicionales
- Migración revisada: `lg_tournament_clubs` con UNIQUE(tournament_id, club_id), FKs ON DELETE CASCADE, RLS consistente con el resto del schema.
- Rutas en `handler.js` y reglas en `request_validator.js` correctamente cableadas según el contrato de `backend.md`.
- `userId` se inyecta globalmente desde el contexto de auth (`lambda_adapter.js:204`), mismo patrón que ya usaba `REGISTER_TEAM` — sin gap introducido.
- El selector "Inscribir club" en el frontend ya viene pre-filtrado por `getAccessibleClubIds` (defensa en profundidad sobre el gate del backend).
- Diffs acotados exactamente a lo descrito en `backend.md`/`frontend.md`, sin archivos fuera de alcance.

## Veredicto: **APPROVED**
