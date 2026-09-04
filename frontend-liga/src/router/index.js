import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AcceptInvite from '../views/AcceptInvite.vue';
import AcceptPlayerInvite from '../views/AcceptPlayerInvite.vue';

const Login          = () => import('../views/Login.vue');
const ForgotPassword = () => import('../views/ForgotPassword.vue');
const ResetPassword  = () => import('../views/ResetPassword.vue');
const Landing = () => import('../views/Landing.vue');
const Bootstrap = () => import('../views/Bootstrap.vue');
const Home = () => import('../views/Home.vue');
const ClubsList = () => import('../views/ClubsList.vue');
const ClubDetail = () => import('../views/ClubDetail.vue');
const RosterView = () => import('../views/RosterView.vue');
const PlayersList = () => import('../views/PlayersList.vue');
const PlayerDetail = () => import('../views/PlayerDetail.vue');
const ClubPlayers = () => import('../views/ClubPlayers.vue');
const PlayerCreate = () => import('../views/PlayerCreate.vue');
const PlayerEdit = () => import('../views/PlayerEdit.vue');
const PlayerChangeClub = () => import('../views/PlayerChangeClub.vue');
const PlayersImport    = () => import('../views/PlayersImport.vue');
const ClubSeries = () => import('../views/ClubSeries.vue');
const ClubTournamentDetail = () => import('../views/ClubTournamentDetail.vue');
const RefereesList = () => import('../views/RefereesList.vue');
const CategoriesList = () => import('../views/CategoriesList.vue');
const VenuesList = () => import('../views/VenuesList.vue');
const SchedulesList = () => import('../views/SchedulesList.vue');
const TransfersView = () => import('../views/TransfersView.vue');
const TransfersKpiDashboard = () => import('../views/TransfersKpiDashboard.vue');
const SeasonsList = () => import('../views/SeasonsList.vue');
const LedgerView = () => import('../views/LedgerView.vue');
const TournamentsList = () => import('../views/TournamentsList.vue');
const TournamentDetail = () => import('../views/TournamentDetail.vue');
const TournamentFixture = () => import('../views/TournamentFixture.vue');
const TournamentStandings = () => import('../views/TournamentStandings.vue');
const TournamentTopScorers = () => import('../views/TournamentTopScorers.vue');
const TournamentFairplay = () => import('../views/TournamentFairplay.vue');
const TournamentCosts = () => import('../views/TournamentCosts.vue');
const MatchControlSheet = () => import('../views/MatchControlSheet.vue');
const PlayerProfile = () => import('../views/PlayerProfile.vue');

const routes = [
    {
        path: '/',
        name: 'Landing',
        component: Landing,
        meta: { requiresAuth: false, guestOnly: true },
    },
    {
        path: '/login',
        name: 'Login',
        component: Login,
        meta: { requiresAuth: false, guestOnly: true },
    },
    {
        path: '/forgot-password',
        name: 'ForgotPassword',
        component: ForgotPassword,
        meta: { requiresAuth: false, guestOnly: true },
    },
    {
        path: '/reset-password',
        name: 'ResetPassword',
        component: ResetPassword,
        meta: { requiresAuth: false },
    },
    {
        path: '/accept-invite',
        name: 'AcceptInvite',
        component: AcceptInvite,
        meta: { requiresAuth: false },
    },
    {
        path: '/aceptar-invitacion-jugador',
        name: 'AcceptPlayerInvite',
        component: AcceptPlayerInvite,
        meta: { requiresAuth: false },
    },
    {
        path: '/bootstrap',
        name: 'Bootstrap',
        component: Bootstrap,
        meta: { requiresAuth: true, requiresNoOrg: true },
    },
    {
        path: '/home',
        name: 'Home',
        component: Home,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs',
        name: 'ClubsList',
        component: ClubsList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/clubs/:clubId',
        name: 'ClubDetail',
        component: ClubDetail,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/roster',
        name: 'ClubRoster',
        component: RosterView,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/players',
        name: 'ClubPlayers',
        component: ClubPlayers,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/series',
        name: 'ClubSeries',
        component: ClubSeries,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/tournaments/:tournamentId',
        name: 'ClubTournamentDetail',
        component: ClubTournamentDetail,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/players/new',
        name: 'PlayerCreate',
        component: PlayerCreate,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/clubs/:clubId/players/import',
        name: 'PlayersImport',
        component: PlayersImport,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/players',
        name: 'PlayersList',
        component: PlayersList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/players/:playerId',
        name: 'PlayerDetail',
        component: PlayerDetail,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/players/:playerId/edit',
        name: 'PlayerEdit',
        component: PlayerEdit,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/players/:playerId/change-club',
        name: 'PlayerChangeClub',
        component: PlayerChangeClub,
        meta: { requiresAuth: true, requiresOrg: true },
    },
    {
        path: '/referees',
        name: 'RefereesList',
        component: RefereesList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/categories',
        name: 'CategoriesList',
        component: CategoriesList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/venues',
        name: 'VenuesList',
        component: VenuesList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/schedules',
        name: 'SchedulesList',
        component: SchedulesList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/transfers',
        name: 'TransfersView',
        component: TransfersView,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/transfers/dashboard',
        name: 'TransfersKpiDashboard',
        component: TransfersKpiDashboard,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/seasons',
        name: 'SeasonsList',
        component: SeasonsList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/ledger',
        name: 'LedgerView',
        component: LedgerView,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/seasons/:seasonId/tournaments',
        name: 'SeasonTournaments',
        component: TournamentsList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments',
        name: 'TournamentsList',
        component: TournamentsList,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId',
        name: 'TournamentDetail',
        component: TournamentDetail,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId/fixture',
        alias: ['/tournaments/:tournamentId/matchdays', '/tournaments/:tournamentId/matches'],
        name: 'TournamentFixture',
        component: TournamentFixture,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId/standings',
        name: 'TournamentStandings',
        component: TournamentStandings,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId/top-scorers',
        name: 'TournamentTopScorers',
        component: TournamentTopScorers,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId/fairplay',
        name: 'TournamentFairplay',
        component: TournamentFairplay,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/tournaments/:tournamentId/costs',
        name: 'TournamentCosts',
        component: TournamentCosts,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    {
        path: '/matches/:matchId',
        name: 'MatchControlSheet',
        component: MatchControlSheet,
        meta: { requiresAuth: true, requiresOrg: true, orgAdminOnly: true },
    },
    // ==================== Rol Jugador ====================
    // Dashboard propio del Jugador (login con Google, vinculado a un
    // lg_player). Sin requiresOrg: el jugador no tiene org/club en el
    // sentido admin — su alcance se resuelve 100% vía authStore.state.player.
    {
        path: '/mi-perfil',
        name: 'PlayerProfile',
        component: PlayerProfile,
        meta: { requiresAuth: true },
    },
    // Standings/goleadores/fairplay reusan EXACTAMENTE los mismos componentes
    // que las rutas de administración (/tournaments/:id/...), pero en rutas
    // alternativas sin `orgAdminOnly` — así un Jugador puede verlas sin que
    // el guard lo mande a /bootstrap o a una ruta que no puede pisar.
    // Los componentes ya son de solo lectura (sin controles de administración
    // embebidos), así que no hace falta gatear nada dentro de ellos.
    {
        path: '/mi-perfil/torneos/:tournamentId/posiciones',
        name: 'PlayerTournamentStandings',
        component: TournamentStandings,
        meta: { requiresAuth: true },
    },
    {
        path: '/mi-perfil/torneos/:tournamentId/goleadores',
        name: 'PlayerTournamentTopScorers',
        component: TournamentTopScorers,
        meta: { requiresAuth: true },
    },
    {
        path: '/mi-perfil/torneos/:tournamentId/fairplay',
        name: 'PlayerTournamentFairplay',
        component: TournamentFairplay,
        meta: { requiresAuth: true },
    },
    // Catch-all
    {
        path: '/:pathMatch(.*)*',
        redirect: '/home'
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// Navigation guards
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.state.isAuthenticated;
    const club = authStore.myClub();
    // Un ADMIN_CLUB puro (invitado directo a un club, sin membresía de
    // organización propia) también "tiene contexto" vía su club — no debe
    // ir a /bootstrap a crear una organización nueva.
    const hasOrg = !!authStore.state.org || !!club;
    // Un usuario vinculado como Jugador (fila en lg_player_users, resuelto
    // por authStore.state.player vía GET /players/me tras el login) que NO
    // tiene org ni club admin: su "home" es su propio dashboard (/mi-perfil),
    // nunca /bootstrap ni las rutas de administración de organización/club.
    const isPlayerOnly = !hasOrg && !!authStore.state.player;
    const playerHome = '/mi-perfil';

    // 1. If route requires auth and user is not authenticated -> Login
    if (to.meta.requiresAuth && !isAuthenticated) {
        return next('/login');
    }

    // 2. If route is for guests only (Login) and user is authenticated
    if (to.meta.guestOnly && isAuthenticated) {
        // Con org -> Home. Jugador puro -> su dashboard. Si no, Bootstrap.
        if (hasOrg) return next('/home');
        if (isPlayerOnly) return next(playerHome);
        return next('/bootstrap');
    }

    // 3. If route requires an Org (Home) but user doesn't have one -> Bootstrap
    // (salvo que sea un Jugador puro, que nunca pasa por Bootstrap: su rol
    // ya está resuelto, no tiene una organización que crear).
    if (to.meta.requiresOrg && !hasOrg) {
        return next(isPlayerOnly ? playerHome : '/bootstrap');
    }

    // 4. If route requires NO Org (Bootstrap) but user has one -> Home
    // (un Jugador puro tampoco debe entrar a Bootstrap).
    if (to.meta.requiresNoOrg && (hasOrg || isPlayerOnly)) {
        return next(hasOrg ? '/home' : playerHome);
    }

    // 5. Administrador de club puro (no ADMIN de organización): su alcance
    // es únicamente su propio club — nada de rutas a nivel de organización,
    // y "Home" no tiene sentido para él, va directo a su club.
    if (isAuthenticated && club && !authStore.isOrgAdmin()) {
        if (to.meta.orgAdminOnly) {
            return next(`/clubs/${club.id}`);
        }
        if (to.name === 'Home') {
            return next(`/clubs/${club.id}`);
        }
    }

    // 6. Caso simétrico al punto 5, para un Jugador puro (sin org ni club
    // admin): su alcance es únicamente su propio dashboard — nada de rutas
    // de administración de organización/club, ni "Home".
    if (isPlayerOnly) {
        if (to.meta.orgAdminOnly) {
            return next(playerHome);
        }
        if (to.name === 'Home') {
            return next(playerHome);
        }
    }

    next();
});

export default router;
