# superliga

## Descripción
Plataforma de gestión de una liga deportiva: inscripción de clubes/equipos/series
a torneos, fixture y resultados de partidos, tabla de posiciones/goleadores/
fairplay, y un módulo de ledger financiero por club (costos de inscripción y
por fecha). Incluye un rol de autoservicio para jugadores (login con Google,
perfil propio, ver su serie y estadísticas de su torneo).

## Arquitectura
Sistema con backend serverless + frontend Vue, cada uno en su propio repo
independiente dentro de esta carpeta padre:

| Capa | Path | Stack |
|---|---|---|
| DB / Auth | (gestionado por Supabase, no vive en un path local) | Supabase (Postgres + Auth), consumido vía `@supabase/supabase-js` |
| Backend | `backend-liga/` | Node.js + Serverless Framework sobre AWS Lambda (`serverless.yml`, `serverless-http`). Auth propia con JWT (`jsonwebtoken`, `bcryptjs`) + login Google (`google-auth-library`). Envío de mail con `nodemailer`. |
| Frontend | `frontend-liga/` | Vue 3 + Vite (sin meta-framework). `vue-router` para ruteo, `axios` para consumo de API, `xlsx` para importar/exportar la nómina de jugadores masivamente (`views/PlayersImport.vue`, `services/import.service.js`) |

## Convenciones
- **Commits**: desde ago-2026 el trabajo reciente sigue Conventional Commits
  en español (`feat:`, `fix:`, `refactor:`, `chore:` + descripción) —
  confirmado en el historial de ambos repos. Commits anteriores a esa fecha
  no seguían una convención estricta (mensajes libres tipo "actualizacion
  torneos y temporadas").
- **Branches**: sin convención de naming unificada entre repos —
  `backend-liga` trabaja sobre una rama personal (`2dcarrasco`),
  `frontend-liga` sobre `master`. No asumir que ambos usan el mismo flujo
  de branching.
- **Estilo de código**: sin linter/formatter configurado en ninguno de los
  dos repos (no se encontró `.eslintrc`/`.prettierrc`) — no hay una
  convención de estilo forzada por tooling.

## Notas de despliegue
- **Supabase**: proyecto en Supabase Cloud — el `db-architect` gestiona
  schema/migraciones ahí (vía SQL/migrations de Supabase), no hay servidor de
  base de datos local.
- **Backend**: `npm run deploy` corre `serverless deploy` → despliega a AWS
  Lambda. `npm run dev` levanta `serverless offline` para desarrollo local.
- **Frontend**: `npm run build` genera el bundle con Vite.
  _(pendiente de completar: dónde se hostea el resultado — no se encontró
  configuración de CI/hosting en el repo, confirmar con el equipo)_

## Reglas para agentes de este proyecto
- `backend-dev` nunca debe asumir que la autenticación es 100% de Supabase
  Auth — este backend maneja su propia capa de JWT además de Supabase, hay
  que revisar el código existente antes de tocar auth.
- `db-architect` trabaja contra Supabase (Postgres), no contra una base local.

---
_Este archivo es local a este proyecto y contiene solo contexto de negocio.
La arquitectura de agentes (ADF) es genérica y vive en `tools/dev-toolkit/` —
no dupliques esa info acá. `CLAUDE.md` y `GEMINI.md` son symlinks a este
mismo archivo, para no mantener el negocio duplicado entre los dos CLIs._

## ⚠️ Regla de trabajo diario
Este proyecto tiene `backend-liga/` y `frontend-liga/` como repos git propios
dentro de `superliga/`. **Abrir siempre la sesión de Claude Code / Gemini CLI
desde la raíz de `superliga`**, nunca parado adentro de `backend-liga` o
`frontend-liga` — esos repos hijos no ven `.claude/agents/` del padre (se
confirmó: `/agents` ahí da "No agents found"). El `agent_orchestrator` se
encarga de tocar los archivos correctos en cada subcarpeta sin necesitar
`cd` a ella.
