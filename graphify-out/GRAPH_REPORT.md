# Graph Report - superliga  (2026-09-01)

## Corpus Check
- Corpus is ~22,987 words - fits in a single context window. You may not need a graph.

## Summary
- 176 nodes · 305 edges · 13 communities (9 shown, 4 thin omitted)
- Extraction: 88% EXTRACTED · 10% INFERRED · 2% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.91)
- Token cost: 347,889 input · 0 output

## Community Hubs (Navigation)
- Club-Tournament Registration Task
- ADF Shared Agents & Skills
- Player Role Task
- Project Overview Docs
- Per-Provider Agent Variants
- Player Role Frontend Views
- new-task Command
- check_global_tools.sh
- link.sh Setup
- project_bootstrap Skill
- build.sh Agent Generation
- bootstrap.sh Setup
- update.sh Setup

## God Nodes (most connected - your core abstractions)
1. `agents/frontmatter/{claude,gemini}/ (por proveedor)` - 17 edges
2. `dev-toolkit README` - 15 edges
3. `agent_orchestrator skill` - 15 edges
4. `tournaments_specialist.js` - 11 edges
5. `REGISTER_CLUB capability` - 10 edges
6. `INVITE_PLAYER capability` - 10 edges
7. `ACCEPT_PLAYER_INVITE capability` - 10 edges
8. `adf_health_check skill` - 10 edges
9. `evidence_logger skill` - 10 edges
10. `LIST_TOURNAMENT_CLUBS capability` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Regla: abrir sesión CLI desde la raíz de superliga` --semantically_similar_to--> `Regla: detección de agentes se corta en el borde del repo git`  [INFERRED] [semantically similar]
  PROJECT.md → tools/dev-toolkit/README.md
- `CLUB_ORG_MISMATCH validation` --semantically_similar_to--> `EMAIL_MISMATCH check`  [INFERRED] [semantically similar]
  .claude/evidence/T-20260825-113906/backend.md → .claude/evidence/T-20260828-103923/backend.md
- `frontend-dev agent role` --implements--> `PlayerProfile.vue`  [EXTRACTED]
  .gemini/agents/frontend-dev.md → .claude/evidence/T-20260828-103923/frontend.md
- `security-reviewer agent role` --implements--> `Security Review T-20260828-103923 (APPROVED)`  [EXTRACTED]
  .gemini/agents/security-reviewer.md → .claude/evidence/T-20260828-103923/security-review.md
- `UPDATE_MY_PLAYER_PROFILE capability (strict whitelist)` --semantically_similar_to--> `UPDATE_TOURNAMENT capability`  [INFERRED] [semantically similar]
  .claude/evidence/T-20260828-103923/backend.md → .claude/evidence/T-20260825-113906/backend.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ADF workflow for T-20260825-113906 (club/team tournament registration)** — claude_evidence_t_20260825_113906_plan_task, claude_evidence_t_20260825_113906_backend_tournaments_specialist, claude_evidence_t_20260825_113906_db_migration, claude_evidence_t_20260825_113906_frontend_tournament_detail_view, claude_evidence_t_20260825_113906_qa_report_result, claude_evidence_t_20260825_113906_security_review_result [EXTRACTED 1.00]
- **ADF workflow for T-20260828-103923 (rol Jugador)** — claude_evidence_t_20260828_103923_plan_task, claude_evidence_t_20260828_103923_backend_players_specialist, claude_evidence_t_20260828_103923_db_migration, claude_evidence_t_20260828_103923_frontend_player_profile_view, claude_evidence_t_20260828_103923_qa_report_result, claude_evidence_t_20260828_103923_security_review_result [EXTRACTED 1.00]
- **Modo Consultivo shared across all ADF Specialist/Validator roles** — gemini_agents_backend_dev, gemini_agents_db_architect, gemini_agents_frontend_dev, gemini_agents_qa_tester, gemini_agents_security_reviewer [EXTRACTED 1.00]
- **backend-dev: definición multi-proveedor (shared + frontmatter)** — tools_dev_toolkit_readme_agents_frontmatter, tools_dev_toolkit_agents_frontmatter_claude_backend_dev_agent, tools_dev_toolkit_agents_frontmatter_codex_backend_dev_agent, tools_dev_toolkit_agents_frontmatter_gemini_backend_dev_agent [INFERRED 0.85]
- **Familia de symlinks de contexto de negocio (PROJECT/CLAUDE/GEMINI/AGENTS)** — project_doc, claude_doc, gemini_doc, agents_doc [INFERRED 0.90]
- **Gobernanza de auth dual (JWT + Supabase) para backend-dev** — project_backend_dev_auth_rule, project_supabase, project_backend_liga, tools_dev_toolkit_agents_frontmatter_claude_backend_dev_agent [INFERRED 0.80]
- **Protocolo compartido Modo Consultivo (Specialists y Validators ADF)** — tools_dev_toolkit_agents_shared_backend_dev_modo_consultivo, tools_dev_toolkit_agents_shared_db_architect_modo_consultivo, tools_dev_toolkit_agents_shared_frontend_dev_modo_consultivo, tools_dev_toolkit_agents_shared_qa_tester_modo_consultivo, tools_dev_toolkit_agents_shared_security_reviewer_modo_consultivo [EXTRACTED 1.00]
- **Flujo de ciclo de vida de tarea ADF (delegar, validar, registrar evidencia)** — tools_dev_toolkit_commands_new_task_command, tools_dev_toolkit_skills_agent_orchestrator_skill_flujo_estandar, tools_dev_toolkit_skills_evidence_logger_skill_evidence_logger [INFERRED 0.85]
- **Roles de solo lectura y diagnóstico (health check, secrets, validators)** — tools_dev_toolkit_skills_adf_health_check_skill_adf_health_check, tools_dev_toolkit_skills_secrets_scanner_skill_secrets_scanner, tools_dev_toolkit_agents_shared_security_reviewer_validator_seguridad, tools_dev_toolkit_agents_shared_qa_tester_validator_calidad [INFERRED 0.75]

## Communities (13 total, 4 thin omitted)

### Community 0 - "Club-Tournament Registration Task"
Cohesion: 0.11
Nodes (38): lib/club_access.js (assertClubAccess/isOrgAdmin/getAccessibleClubIds), CLUB_HAS_REGISTERED_TEAMS design decision, CLUB_ORG_MISMATCH validation, createInscriptionCharge(), CREATE_TOURNAMENT capability, DELETE_TOURNAMENT capability, handler.js (tournament/club routes), lib/ledger.js (+30 more)

### Community 1 - "ADF Shared Agents & Skills"
Cohesion: 0.12
Nodes (35): Formato de output esperado (Backend), Modo Consultivo (Backend Specialist), Specialist de Backend, Formato de output esperado (DB), Modo Consultivo (DB Specialist), Specialist de Base de Datos, Formato de output esperado (Frontend), Modo Consultivo (Frontend Specialist) (+27 more)

### Community 2 - "Player Role Task"
Cohesion: 0.09
Nodes (31): mock_db.js test util, ACCEPT_PLAYER_INVITE capability, auth_specialist.js, EMAIL_MISMATCH check, GET_MY_PLAYER_PROFILE capability, handler.js (/players routes), INVITE_PLAYER capability, utils/mailer.js (sendPlayerInviteEmail) (+23 more)

### Community 3 - "Project Overview Docs"
Cohesion: 0.10
Nodes (21): agent_orchestrator, backend-liga (Node.js + Serverless/AWS Lambda), Conventional Commits en español, Separación negocio (PROJECT.md) vs ADF genérico (dev-toolkit), frontend-liga (Vue 3 + Vite), Plataforma de gestión de liga deportiva (dominio), Regla: abrir sesión CLI desde la raíz de superliga, Supabase (Postgres + Auth) (+13 more)

### Community 4 - "Per-Provider Agent Variants"
Cohesion: 0.24
Nodes (18): Regla: backend-dev y capa dual de auth (JWT + Supabase), Regla: db-architect trabaja contra Supabase, no DB local, backend-dev (Claude frontmatter), db-architect (Claude frontmatter), frontend-dev (Claude frontmatter), qa-tester (Claude frontmatter), security-reviewer (Claude frontmatter), backend-dev (Codex frontmatter) (+10 more)

### Community 5 - "Player Role Frontend Views"
Cohesion: 0.22
Nodes (9): AcceptPlayerInvite.vue, stores/auth.js, Login.vue, Navbar.vue, router/index.js guard, TournamentFairplay.vue (reused), TournamentStandings.vue (reused), TournamentTopScorers.vue (reused) (+1 more)

### Community 6 - "new-task Command"
Cohesion: 0.67
Nodes (3): /new-task command, agent_orchestrator skill, evidence_logger skill

### Community 7 - "check_global_tools.sh"
Cohesion: 0.83
Nodes (3): check_tool(), is_wsl(), check-global-tools.sh script

### Community 9 - "project_bootstrap Skill"
Cohesion: 0.67
Nodes (3): Detección de stack por archivos de manifiesto, Generación/actualización de .gitignore raíz, project_bootstrap skill

## Ambiguous Edges - Review These
- `agents/frontmatter/{claude,gemini}/ (por proveedor)` → `backend-dev (Codex frontmatter)`  [AMBIGUOUS]
  tools/dev-toolkit/agents/frontmatter/codex/backend-dev.md · relation: implements
- `agents/frontmatter/{claude,gemini}/ (por proveedor)` → `db-architect (Codex frontmatter)`  [AMBIGUOUS]
  tools/dev-toolkit/agents/frontmatter/codex/db-architect.md · relation: implements
- `agents/frontmatter/{claude,gemini}/ (por proveedor)` → `frontend-dev (Codex frontmatter)`  [AMBIGUOUS]
  tools/dev-toolkit/agents/frontmatter/codex/frontend-dev.md · relation: implements
- `agents/frontmatter/{claude,gemini}/ (por proveedor)` → `qa-tester (Codex frontmatter)`  [AMBIGUOUS]
  tools/dev-toolkit/agents/frontmatter/codex/qa-tester.md · relation: implements
- `agents/frontmatter/{claude,gemini}/ (por proveedor)` → `security-reviewer (Codex frontmatter)`  [AMBIGUOUS]
  tools/dev-toolkit/agents/frontmatter/codex/security-reviewer.md · relation: implements

## Knowledge Gaps
- **26 isolated node(s):** `build.sh script`, `bootstrap.sh script`, `update.sh script`, `evidence_logger skill`, `lib/ledger.js` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 48 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `agents/frontmatter/{claude,gemini}/ (por proveedor)` and `backend-dev (Codex frontmatter)`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `agents/frontmatter/{claude,gemini}/ (por proveedor)` and `db-architect (Codex frontmatter)`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `agents/frontmatter/{claude,gemini}/ (por proveedor)` and `frontend-dev (Codex frontmatter)`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `agents/frontmatter/{claude,gemini}/ (por proveedor)` and `qa-tester (Codex frontmatter)`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **What is the exact relationship between `agents/frontmatter/{claude,gemini}/ (por proveedor)` and `security-reviewer (Codex frontmatter)`?**
  _Edge tagged AMBIGUOUS (relation: implements) - confidence is low._
- **Why does `ACCEPT_PLAYER_INVITE capability` connect `Player Role Task` to `Player Role Frontend Views`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `stores/auth.js` connect `Player Role Frontend Views` to `Player Role Task`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._