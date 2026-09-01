# Graph Report - superliga  (2026-09-01)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1768 nodes · 3472 edges · 93 communities (77 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6504a6cd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- successResponse
- adf/index.js
- TransfersView.vue
- design_system.py
- TournamentCosts.vue
- createSkillResult
- tournaments_specialist.js
- RefereesList.vue
- VenuesList.vue
- buildTask
- ClubDetail.vue
- backend-liga/package.json
- TournamentDetail.vue
- ClubsList.vue
- ClubSeries.vue
- PlayersSpecialist
- PlayersImport.vue
- MatchControlSheet.vue
- CategoriesList.vue
- TournamentsList.vue
- PlayerDocuments.vue
- LedgerView.vue
- PlayersList.vue
- SchedulesList.vue
- frontend-liga/package.json
- ArtifactLogger
- AuthSpecialist
- Navbar.vue
- tournaments.js
- club_finance_specialist.js
- tournaments_specialist.js
- SeasonsList.vue
- assertClubAccess
- PlayerDetail.vue
- SeriesRosterDetail.vue
- router/index.js
- ClubHeader.vue
- AcceptInvite.vue
- ClubPlayers.vue
- PlayerProfile.vue
- ResetPassword.vue
- AcceptPlayerInvite.vue
- PlayerChangeClub.vue
- PlayerCreate.vue
- players.service.js
- PlayerEdit.vue
- RosterView.vue
- clubSeries.js
- api/index.js
- Login.vue
- auth.js
- 003_player_users.sql
- transfers.service.js
- venueScheduling.js
- confirm
- TransfersSpecialist
- ACCEPT_PLAYER_INVITE capability
- UPDATE_MY_PLAYER_PROFILE capability (strict whitelist)
- notify.js
- ForgotPassword.vue
- Landing.vue
- seasons.service.js
- CategoriesSpecialist
- LoansSpecialist
- VenueSchedulingSpecialist
- REGISTER_CLUB capability
- stores/auth.js
- Bootstrap.vue
- TournamentStandings.vue
- clubFinance.service.js
- venues.js
- RefereesSpecialist
- roster.service.js
- chart-config.js
- PlayerDocumentsSpecialist
- SeasonsSpecialist
- main.js
- cloudinary.service.js
- folio.js
- player_documents.service.js
- fetchPlayers
- resetForm
- verifyApiKey
- fetchInactivePlayers
- LoadingState.vue
- getPlayerCategory
- HelloWorld.vue
- T-20260828-103923 task (rol Jugador)

## God Nodes (most connected - your core abstractions)
1. `createSkillResult()` - 163 edges
2. `successResponse()` - 50 edges
3. `errorResponse()` - 48 edges
4. `Skill` - 44 edges
5. `assertClubAccess()` - 36 edges
6. `TournamentsSpecialist` - 29 edges
7. `useAuthStore()` - 29 edges
8. `validateApiKey()` - 26 edges
9. `confirm` - 24 edges
10. `validateBody()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `CLUB_ORG_MISMATCH validation` --semantically_similar_to--> `EMAIL_MISMATCH check`  [INFERRED] [semantically similar]
  .claude/evidence/T-20260825-113906/backend.md → .claude/evidence/T-20260828-103923/backend.md
- `confirmDelete()` --calls--> `confirm`  [INFERRED]
  frontend-liga/src/views/SeasonsList.vue → frontend-liga/src/views/AcceptInvite.vue
- `onUnassignPlayer()` --calls--> `confirm`  [INFERRED]
  frontend-liga/src/components/SeriesRosterDetail.vue → frontend-liga/src/views/AcceptInvite.vue
- `submitChange()` --calls--> `confirm`  [INFERRED]
  frontend-liga/src/views/PlayerChangeClub.vue → frontend-liga/src/views/AcceptInvite.vue
- `UPDATE_MY_PLAYER_PROFILE capability (strict whitelist)` --semantically_similar_to--> `UPDATE_TOURNAMENT capability`  [INFERRED] [semantically similar]
  .claude/evidence/T-20260828-103923/backend.md → .claude/evidence/T-20260825-113906/backend.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **ADF workflow for T-20260825-113906 (club/team tournament registration)** — claude_evidence_t_20260825_113906_plan_task, claude_evidence_t_20260825_113906_backend_tournaments_specialist, claude_evidence_t_20260825_113906_db_migration, claude_evidence_t_20260825_113906_frontend_tournament_detail_view, claude_evidence_t_20260825_113906_qa_report_result, claude_evidence_t_20260825_113906_security_review_result [EXTRACTED 1.00]
- **ADF workflow for T-20260828-103923 (rol Jugador)** — claude_evidence_t_20260828_103923_plan_task, claude_evidence_t_20260828_103923_backend_players_specialist, claude_evidence_t_20260828_103923_db_migration, claude_evidence_t_20260828_103923_frontend_player_profile_view, claude_evidence_t_20260828_103923_qa_report_result, claude_evidence_t_20260828_103923_security_review_result [EXTRACTED 1.00]

## Communities (93 total, 11 thin omitted)

### Community 0 - "successResponse"
Cohesion: 0.12
Nodes (59): handler(), handler(), handler(), handler(), handler(), handler(), createCategory(), deleteCategory() (+51 more)

### Community 1 - "adf/index.js"
Cohesion: 0.06
Nodes (34): Skill, ArtifactType, createTaskResult(), TaskStatus, _orchestrator, _specialists, _validators, SENSITIVE_KEYS (+26 more)

### Community 2 - "TransfersView.vue"
Cohesion: 0.05
Nodes (47): TransfersKpiDashboard(), TransfersView(), addClubUser(), createClub(), getClubAdmins(), getClubById(), getClubs(), inviteClubAdmin() (+39 more)

### Community 3 - "design_system.py"
Cohesion: 0.05
Nodes (42): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+34 more)

### Community 4 - "TournamentCosts.vue"
Cohesion: 0.07
Nodes (39): TournamentCosts(), TournamentFixture(), addMatchEvent(), createMatchday(), deleteMatchEvent(), getFairplayRanking(), getMatchById(), getMatchdays() (+31 more)

### Community 5 - "createSkillResult"
Cohesion: 0.10
Nodes (5): createSkillResult(), ClubsSpecialist, MatchesSpecialist, TournamentCostsSpecialist, VenuesSpecialist

### Community 6 - "tournaments_specialist.js"
Cohesion: 0.09
Nodes (17): propagateWinner(), isOrgAdmin(), generateGroups(), generateKnockoutBracket(), generateRoundRobin(), nextPowerOfTwo(), seedPositions(), clearUnpaidMatchdayCharges() (+9 more)

### Community 7 - "RefereesList.vue"
Cohesion: 0.06
Nodes (36): RefereesList(), createReferee(), deleteReferee(), getRefereeById(), getReferees(), updateReferee(), state, useRefereesStore() (+28 more)

### Community 8 - "VenuesList.vue"
Cohesion: 0.05
Nodes (34): VenuesList(), authStore, availableVenues, cancelForm(), comunaOptions, { confirm, notifySuccess, notifyError }, currentPage, dashboardTiles (+26 more)

### Community 9 - "buildTask"
Cohesion: 0.13
Nodes (29): buildTask(), ERROR_HTTP_MAP, extractHeaders(), extractMeta(), resolveStatusCode(), taskResultToLambdaResponse(), withADF(), domains (+21 more)

### Community 10 - "ClubDetail.vue"
Cohesion: 0.05
Nodes (31): activeTab, allClubs, authStore, categories, catError, catLoading, { current, users, admins, loading, error, fetchClubById, addUserToClub, removeUserFromClub, createOrUpdateClub, fetchClubAdmins, inviteAdmin, removeAdmin }, editForm (+23 more)

### Community 11 - "backend-liga/package.json"
Cohesion: 0.06
Nodes (35): aws-sdk, author, dependencies, bcryptjs, dotenv, google-auth-library, jsonwebtoken, nodemailer (+27 more)

### Community 12 - "TournamentDetail.vue"
Cohesion: 0.06
Nodes (23): TournamentDetail(), authStore, {
  current, teams, clubs, loading, error,
  fetchTournamentById, fetchTeams, addTeam, removeTeam,
  fetchTournamentClubs, addClub, removeClub,
  runGenerateFixture, runGenerateKnockoutFromGroups, runGenerateConsolation,
}, filteredSeriesResults, FORMAT_LABELS, INSCRIPTION_STATUS_LABELS, { notifySuccess, notifyError, confirm, prompt }, onSaveStatus() (+15 more)

### Community 13 - "ClubsList.vue"
Cohesion: 0.06
Nodes (27): ClubsList(), activeClubs, authStore, avgPlayersPerClub, currentPage, dashboardTiles, filteredClubs, form (+19 more)

### Community 14 - "ClubSeries.vue"
Cohesion: 0.06
Nodes (23): ClubSeries(), availableTournaments, categories, club, clubRoster, clubTabs, { confirm, notifySuccess, notifyError }, editingSeriesId (+15 more)

### Community 15 - "PlayersSpecialist"
Cohesion: 0.12
Nodes (12): computeAge(), decorateFolio(), formatClubFolio(), isVeteranByBirthDate(), VETERAN_AGE_THRESHOLD, VETERAN_FOLIO_PREFIX, CAPABILITIES, PlayersSpecialist (+4 more)

### Community 16 - "PlayersImport.vue"
Cohesion: 0.08
Nodes (29): PlayersImport(), HEADER_MAP, importPlayers(), normalizeHeader(), normalizeRut(), parseExcelDate(), parseExcelFile(), parseName() (+21 more)

### Community 17 - "MatchControlSheet.vue"
Cohesion: 0.07
Nodes (22): MatchControlSheet(), authStore, BRACKET_NOTE_LABELS, bracketNote, bracketNoteLabel, { confirm, notifySuccess, notifyError }, { current, events, loading, error, fetchMatchById, saveLogistics, saveResult, fetchEvents, addEvent, removeEvent }, currentRoster (+14 more)

### Community 18 - "CategoriesList.vue"
Cohesion: 0.11
Nodes (23): CategoriesList(), createCategoryForOrg(), deleteCategoryById(), listCategoriesByOrg(), listSports(), updateCategoryById(), authStore, cancelForm() (+15 more)

### Community 19 - "TournamentsList.vue"
Cohesion: 0.08
Nodes (21): TournamentsList(), authStore, cancelForm(), categories, { confirm, notifySuccess, notifyError }, defaultForm(), form, FORMAT_LABELS (+13 more)

### Community 20 - "PlayerDocuments.vue"
Cohesion: 0.08
Nodes (18): deleting, docName, docToDelete, documents, doDelete(), fileInputRef, isDragging, listError (+10 more)

### Community 21 - "LedgerView.vue"
Cohesion: 0.08
Nodes (26): LedgerView(), getPaymentStats(), activeTab, authStore, CATEGORIES, CATEGORY_LABELS, CLUB_STATUS_LABELS, clubs (+18 more)

### Community 22 - "PlayersList.vue"
Cohesion: 0.09
Nodes (23): PlayersList(), activeTab, currentMeta, dashboardTiles, goNext(), goPrev(), goToPage(), icons (+15 more)

### Community 23 - "SchedulesList.vue"
Cohesion: 0.08
Nodes (17): SchedulesList(), authStore, {
  availabilityByVenue,
  bookingsByKey,
  error: schedulingError,
  fetchAvailability,
  addAvailability,
  removeAvailability,
  fetchBookings,
  addBooking,
  removeBooking,
}, bookingForm, { confirm, notifySuccess, notifyError }, DAY_LABELS, dayOptions, ensureForms() (+9 more)

### Community 24 - "frontend-liga/package.json"
Cohesion: 0.08
Nodes (24): axios, crypto-js, dependencies, axios, crypto-js, vue, vue-router, xlsx (+16 more)

### Community 25 - "ArtifactLogger"
Cohesion: 0.16
Nodes (4): ArtifactLogger, sanitize(), TraceBuilder, AgentOrchestrator

### Community 26 - "AuthSpecialist"
Cohesion: 0.15
Nodes (8): AuthSpecialist, generateSlug(), getClubMemberships(), getOrgMemberships(), createSupabaseMock(), FUTURE, run(), createMockDb()

### Community 27 - "Navbar.vue"
Cohesion: 0.09
Nodes (16): authStore, closeAllMenus(), closeMobileMenu(), isParamsRouteActive, isPlayersRouteActive, isSeasonsRouteActive, mobileMenuOpen, myClub (+8 more)

### Community 28 - "tournaments.js"
Cohesion: 0.21
Nodes (21): createTournament(), deleteTournament(), generateConsolation(), generateFixture(), generateKnockoutFromGroups(), getStages(), getStandings(), getTournamentById() (+13 more)

### Community 29 - "club_finance_specialist.js"
Cohesion: 0.19
Nodes (10): CAPABILITIES, ClubFinanceSpecialist, computeEntryStatus(), createInscriptionCharge(), createMatchdayCharges(), decorateLedgerEntry(), getSeasonCostCatalog(), LEDGER_CATEGORIES (+2 more)

### Community 30 - "tournaments_specialist.js"
Cohesion: 0.16
Nodes (22): lib/club_access.js (assertClubAccess/isOrgAdmin/getAccessibleClubIds), CLUB_HAS_REGISTERED_TEAMS design decision, CREATE_TOURNAMENT capability, DELETE_TOURNAMENT capability, handler.js (tournament/club routes), LIST_TOURNAMENT_CLUBS capability, request_validator.js (tournaments rules), tournaments_specialist.js (+14 more)

### Community 31 - "SeasonsList.vue"
Cohesion: 0.13
Nodes (19): SeasonsList(), getCostCatalog(), upsertCostCatalog(), authStore, cancelForm(), { confirm, notifySuccess, notifyError }, confirmDelete(), costForm (+11 more)

### Community 32 - "assertClubAccess"
Cohesion: 0.20
Nodes (8): ageByBirthYear(), CAPABILITIES, ClubSeriesSpecialist, computePlayerAge(), exactAge(), assertClubAccess(), getAccessibleClubIds(), assertPlayerAccess()

### Community 33 - "PlayerDetail.vue"
Cohesion: 0.10
Nodes (15): PlayerDetail(), invitePlayerAccess(), categories, clubName, fileInput, handleInvitePlayer(), INVITE_ERROR_MESSAGES, inviteEmail (+7 more)

### Community 34 - "SeriesRosterDetail.vue"
Cohesion: 0.13
Nodes (16): ageByBirthYear(), assignedPlayerIds, assigningIds, bulkAssigning, { confirm, notifySuccess, notifyError }, eligiblePlayers, exactAge(), meetsMinAge() (+8 more)

### Community 35 - "router/index.js"
Cohesion: 0.11
Nodes (17): ClubDetail(), PlayerProfile(), routes, TournamentFairplay(), TournamentTopScorers(), authStore, backLabel, backTarget (+9 more)

### Community 36 - "ClubHeader.vue"
Cohesion: 0.13
Nodes (17): activeCount, currentYear, emit, kpis, kpisLoading, loadAll(), loadKpis(), loadPaymentStatus() (+9 more)

### Community 37 - "AcceptInvite.vue"
Cohesion: 0.12
Nodes (17): clubName, confirmError, doAccept(), emailMasked, error, errorMsg, handleSubmit(), isNew (+9 more)

### Community 38 - "ClubPlayers.vue"
Cohesion: 0.14
Nodes (17): ClubPlayers(), activeCount, activeTab, categories, changePage(), clubAdmins, clubsStore, fetchPlayers() (+9 more)

### Community 39 - "PlayerProfile.vue"
Cohesion: 0.12
Nodes (17): updateMyPlayerProfile(), applyProfile(), authStore, club, form, handleSave(), loaded, loadError (+9 more)

### Community 40 - "ResetPassword.vue"
Cohesion: 0.13
Nodes (15): ResetPassword(), authStore, confirmError, confirmPassword, error, handleSubmit(), newPassword, newPasswordError (+7 more)

### Community 41 - "AcceptPlayerInvite.vue"
Cohesion: 0.15
Nodes (14): loadGoogleScript(), useGoogleAuth(), authStore, { credential: googleCredential, error: googleError, renderButton }, error, ERROR_MESSAGES, errorMsg, googleBtnEl (+6 more)

### Community 42 - "PlayerChangeClub.vue"
Cohesion: 0.12
Nodes (14): PlayerChangeClub(), authStore, availableClubs, clubs, clubsStore, { confirm, notifySuccess, notifyError }, error, form (+6 more)

### Community 43 - "PlayerCreate.vue"
Cohesion: 0.14
Nodes (14): PlayerCreate(), getAvailableFolios(), availableFolios, club, folioError, form, loadAvailableFolios(), loadingFolios (+6 more)

### Community 44 - "players.service.js"
Cohesion: 0.33
Nodes (14): changeClub(), createPlayer(), createPlayerForClub(), getPlayerById(), getPlayers(), listActivePlayersByOrg(), listInactivePlayersByOrg(), listPlayersByClub() (+6 more)

### Community 45 - "PlayerEdit.vue"
Cohesion: 0.14
Nodes (12): PlayerEdit(), listCategories(), fetchCategories(), loadData(), loadCategories(), categories, form, loadPlayer() (+4 more)

### Community 46 - "RosterView.vue"
Cohesion: 0.15
Nodes (11): RosterView(), addForm, { confirm, notifySuccess, notifyError }, deactivate(), handleAddPlayer(), isFull, { items, loading, error, limit, fetchRoster, addPlayerToRoster, updateRosterStatus }, loadRoster() (+3 more)

### Community 47 - "clubSeries.js"
Cohesion: 0.32
Nodes (11): assignPlayerToSeries(), createSeries(), deleteSeries(), getClubSeries(), getSeriesRoster(), searchSeries(), unassignPlayerFromSeries(), updateSeries() (+3 more)

### Community 48 - "api/index.js"
Cohesion: 0.18
Nodes (6): apiClient, authAPI, clubsAPI, financeAPI, playersAPI, transfersService

### Community 49 - "Login.vue"
Cohesion: 0.18
Nodes (11): Login(), authStore, checkRedirect(), { credential: googleCredential, error: googleError, renderButton }, currentTab, email, googleBtnEl, handleLogin() (+3 more)

### Community 50 - "auth.js"
Cohesion: 0.21
Nodes (8): authStore, isAuthenticated, Home(), getMyPlayerProfile(), state, useAuthStore(), authStore, router

### Community 51 - "003_player_users.sql"
Cohesion: 0.24
Nodes (11): 002_club_admins.sql / INVITE_CLUB_ADMIN precedent, fn_accept_player_invite(), fn_get_player_link(), fn_invite_player(), lg_player_invites table, lg_player_users table, 003_player_users.sql, RLS policy for player tables (unified permissive pattern) (+3 more)

### Community 52 - "transfers.service.js"
Cohesion: 0.25
Nodes (10): acceptTransfer(), cancelTransfer(), createTransfer(), listTransfers(), rejectTransfer(), aceptar(), cancelar(), fetchTransfers() (+2 more)

### Community 53 - "venueScheduling.js"
Cohesion: 0.38
Nodes (9): createAvailability(), createBooking(), deleteAvailability(), deleteBooking(), getAvailability(), getBookings(), state, unwrap() (+1 more)

### Community 54 - "confirm"
Cohesion: 0.18
Nodes (11): confirm, confirmRemoveUser(), handleRemoveAdmin(), onDeleteSeries(), confirmDelete(), removeFranja(), removeReserva(), onRemoveClub() (+3 more)

### Community 56 - "ACCEPT_PLAYER_INVITE capability"
Cohesion: 0.24
Nodes (10): mock_db.js test util, ACCEPT_PLAYER_INVITE capability, auth_specialist.js, EMAIL_MISMATCH check, INVITE_PLAYER capability, utils/mailer.js (sendPlayerInviteEmail), mock_db.js .rpc() extension, agent_orchestrator.js PUBLIC_OPERATIONS (+2 more)

### Community 57 - "UPDATE_MY_PLAYER_PROFILE capability (strict whitelist)"
Cohesion: 0.27
Nodes (10): GET_MY_PLAYER_PROFILE capability, handler.js (/players routes), lib/player_access.js (assertPlayerAccess), players_specialist.js, UPDATE_MY_PLAYER_PROFILE capability (strict whitelist), PlayerDetail.vue, PlayerProfile.vue, players.service.js (+2 more)

### Community 58 - "notify.js"
Cohesion: 0.22
Nodes (7): confirmBtnRef, DEFAULT_TITLES, defaultTitle, promptInputRef, {
  visible,
  mode,
  type,
  title,
  message,
  confirmText,
  cancelText,
  isDestructive,
  inputValue,
  inputType,
  inputPlaceholder,
  handleConfirm,
  handleCancel,
}, state, useNotifyStore()

### Community 59 - "ForgotPassword.vue"
Cohesion: 0.22
Nodes (8): ForgotPassword(), authStore, email, emailError, error, handleSubmit(), sent, validateEmail()

### Community 60 - "Landing.vue"
Cohesion: 0.20
Nodes (8): Landing(), heroStats, matches, performance, perfTiles, plans, trainers, year

### Community 61 - "seasons.service.js"
Cohesion: 0.36
Nodes (8): createSeason(), deleteSeason(), getSeasons(), updateSeason(), state, useSeasonsStore(), createNewSeason(), loadSeasons()

### Community 65 - "REGISTER_CLUB capability"
Cohesion: 0.31
Nodes (9): CLUB_ORG_MISMATCH validation, createInscriptionCharge(), lib/ledger.js, REGISTER_CLUB capability, REGISTER_TEAM (_registerTeam) capability, lg_tournament_clubs table, RLS policy (anon/authenticated permissive), T-20260825-113906 task (club/team tournament registration) (+1 more)

### Community 66 - "stores/auth.js"
Cohesion: 0.22
Nodes (9): AcceptPlayerInvite.vue, stores/auth.js, Login.vue, Navbar.vue, router/index.js guard, TournamentFairplay.vue (reused), TournamentStandings.vue (reused), TournamentTopScorers.vue (reused) (+1 more)

### Community 67 - "Bootstrap.vue"
Cohesion: 0.22
Nodes (6): Bootstrap(), authStore, countryCode, orgName, orgSlug, router

### Community 68 - "TournamentStandings.vue"
Cohesion: 0.22
Nodes (8): TournamentStandings(), authStore, backLabel, backTarget, groupedStandings, isPlayerOnly, route, { standings, loading, error, fetchStandings }

### Community 69 - "clubFinance.service.js"
Cohesion: 0.28
Nodes (8): createLedgerEntry(), getLedgerEntries(), recordPayment(), formatMoney(), loadEntries(), openPaymentPrompt(), submitNewEntry(), onRegisterPayment()

### Community 70 - "venues.js"
Cohesion: 0.47
Nodes (7): createVenue(), deleteVenue(), getVenueById(), getVenues(), updateVenue(), state, useVenuesStore()

### Community 72 - "roster.service.js"
Cohesion: 0.46
Nodes (6): addToRoster(), getRosterByClub(), updateRosterEntry(), state, useRosterStore(), loadClubRoster()

### Community 73 - "chart-config.js"
Cohesion: 0.25
Nodes (3): CHART_COLORS, CHART_SEMANTIC, darkDefaults

### Community 76 - "main.js"
Cohesion: 0.33
Nodes (4): theme, useTheme(), app, router

### Community 77 - "cloudinary.service.js"
Cohesion: 0.48
Nodes (6): assertCredentials(), buildSignature(), uploadDocument(), uploadImage(), handleEditFileChange(), handleFileChange()

### Community 78 - "folio.js"
Cohesion: 0.38
Nodes (6): computeAge(), formatFolio(), isVeteranAge(), VETERAN_AGE_THRESHOLD, VETERAN_FOLIO_PREFIX, folioDisplay

### Community 79 - "player_documents.service.js"
Cohesion: 0.40
Nodes (4): doUpload(), formatFileSize(), registerDocument(), uploadDocument()

### Community 80 - "fetchPlayers"
Cohesion: 0.40
Nodes (5): changePlayerPage(), fetchPlayers(), handlePlayerFilter(), handlePlayerSearch(), togglePlayerStatus()

### Community 81 - "resetForm"
Cohesion: 0.50
Nodes (5): cancelForm(), handlePostSaveOption(), resetForm(), startCreate(), toggleViewMode()

### Community 83 - "fetchInactivePlayers"
Cohesion: 0.50
Nodes (4): fetchInactivePlayers(), saveEdit(), switchTab(), syncEditForm()

### Community 85 - "getPlayerCategory"
Cohesion: 0.67
Nodes (3): filteredPlayers, getPlayerCategory(), playersByCategory

## Knowledge Gaps
- **615 isolated node(s):** `supabaseAnon`, `_orchestrator`, `_specialists`, `_validators`, `SENSITIVE_KEYS` (+610 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 835 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuthStore()` connect `auth.js` to `RefereesList.vue`, `VenuesList.vue`, `ClubDetail.vue`, `TournamentDetail.vue`, `ClubsList.vue`, `PlayersImport.vue`, `MatchControlSheet.vue`, `CategoriesList.vue`, `TournamentsList.vue`, `LedgerView.vue`, `PlayersList.vue`, `SchedulesList.vue`, `Navbar.vue`, `SeasonsList.vue`, `router/index.js`, `PlayerProfile.vue`, `ResetPassword.vue`, `AcceptPlayerInvite.vue`, `PlayerChangeClub.vue`, `Login.vue`, `ForgotPassword.vue`, `Bootstrap.vue`, `TournamentStandings.vue`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `useNotifyStore()` connect `notify.js` to `SeriesRosterDetail.vue`, `TransfersView.vue`, `TournamentCosts.vue`, `RefereesList.vue`, `VenuesList.vue`, `ClubDetail.vue`, `PlayerChangeClub.vue`, `TournamentDetail.vue`, `ClubsList.vue`, `ClubSeries.vue`, `RosterView.vue`, `PlayersImport.vue`, `MatchControlSheet.vue`, `CategoriesList.vue`, `TournamentsList.vue`, `LedgerView.vue`, `SchedulesList.vue`, `SeasonsList.vue`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `createSkillResult()` connect `createSkillResult` to `assertClubAccess`, `adf/index.js`, `VenueSchedulingSpecialist`, `tournaments_specialist.js`, `RefereesSpecialist`, `PlayerDocumentsSpecialist`, `SeasonsSpecialist`, `PlayersSpecialist`, `TransfersSpecialist`, `AuthSpecialist`, `club_finance_specialist.js`, `CategoriesSpecialist`, `LoansSpecialist`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `supabaseAnon`, `_orchestrator`, `_specialists` to the rest of the system?**
  _615 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `successResponse` be split into smaller, more focused modules?**
  _Cohesion score 0.11754911754911755 - nodes in this community are weakly interconnected._
- **Should `adf/index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06498015873015874 - nodes in this community are weakly interconnected._
- **Should `TransfersView.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.05028248587570622 - nodes in this community are weakly interconnected._