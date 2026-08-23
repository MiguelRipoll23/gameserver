import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { App } from './App'
import { DashboardPage } from './pages/DashboardPage'
import { MessagesPage } from './pages/MessagesPage'
import { BotsPage } from './pages/BotsPage'
import { UsersPage } from './pages/UsersPage'
import { MatchesPage } from './pages/MatchesPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { GameConfigPage } from './pages/GameConfigPage'
import { AntiCheatPage } from './pages/AntiCheatPage'
import { BlockedWordsPage } from './pages/BlockedWordsPage'
import { SettingsPage } from './pages/SettingsPage'
import { ScoresPage } from './pages/ScoresPage'
import { VersionPage } from './pages/VersionPage'
import { ReportsPage } from './pages/ReportsPage'
import { BansPage } from './pages/BansPage'
import { SessionsPage } from './pages/SessionsPage'

const rootRoute = createRootRoute({ component: App })

const routes = {
  dashboard: createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage }),
  messages: createRoute({ getParentRoute: () => rootRoute, path: '/server-messages', component: MessagesPage }),
  bots: createRoute({ getParentRoute: () => rootRoute, path: '/bots', component: BotsPage }),
  users: createRoute({ getParentRoute: () => rootRoute, path: '/users', component: UsersPage }),
  matches: createRoute({ getParentRoute: () => rootRoute, path: '/matches', component: MatchesPage }),
  notifications: createRoute({ getParentRoute: () => rootRoute, path: '/server-notification', component: NotificationsPage }),
  gameConfig: createRoute({ getParentRoute: () => rootRoute, path: '/configuration', component: GameConfigPage }),
  antiCheat: createRoute({ getParentRoute: () => rootRoute, path: '/anti-cheat', component: AntiCheatPage }),
  blockedWords: createRoute({ getParentRoute: () => rootRoute, path: '/blocked-words', component: BlockedWordsPage }),
  scores: createRoute({ getParentRoute: () => rootRoute, path: '/scores', component: ScoresPage }),
  version: createRoute({ getParentRoute: () => rootRoute, path: '/version', component: VersionPage }),
  reports: createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage }),
  sessions: createRoute({ getParentRoute: () => rootRoute, path: '/sessions', component: SessionsPage }),
  bans: createRoute({
    getParentRoute: () => rootRoute,
    path: '/bans',
    component: BansPage,
    /** Prefill params carried over from a report's "Ban" quick action. */
    validateSearch: (search: Record<string, unknown>) => ({
      userId: typeof search.userId === 'string' ? search.userId : undefined,
      reason: typeof search.reason === 'string' ? search.reason : undefined,
    }),
  }),
  settings: createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
}

const routeTree = rootRoute.addChildren([
  routes.dashboard,
  routes.messages,
  routes.bots,
  routes.users,
  routes.matches,
  routes.notifications,
  routes.gameConfig,
  routes.antiCheat,
  routes.blockedWords,
  routes.scores,
  routes.version,
  routes.reports,
  routes.sessions,
  routes.bans,
  routes.settings,
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
