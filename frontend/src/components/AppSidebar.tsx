import { useEffect, useMemo, useState } from 'react'
import { Input, Sidebar, useSidebar } from '@cloudflare/kumo'
import {
  Bell,
  Broadcast,
  Flag,
  Gear,
  House,
  MagnifyingGlass,
  Megaphone,
  Package,
  Prohibit,
  Robot,
  ShieldCheck,
  SlidersHorizontal,
  Sword,
  TextT,
  Trophy,
  Users,
  type Icon,
} from '@phosphor-icons/react'
import { useLocation } from '@tanstack/react-router'

interface NavItem {
  label: string
  href: string
  icon: Icon
  description?: string
}

interface NavGroup {
  name: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    name: 'Overview',
    items: [
      { label: 'Dashboard', href: '/', icon: House, description: 'Server health & stats' },
      { label: 'Settings', href: '/settings', icon: Gear, description: 'Server URL & JWT' },
    ],
  },
  {
    name: 'Communication',
    items: [
      { label: 'Server messages', href: '/server-messages', icon: Megaphone, description: 'Announcements shown in-game' },
      { label: 'Server notification', href: '/server-notification', icon: Bell, description: 'Push in-game notifications' },
    ],
  },
  {
    name: 'Gameplay',
    items: [
      { label: 'Version', href: '/version', icon: Package, description: 'Minimum client version' },
      { label: 'Users', href: '/users', icon: Users, description: 'Accounts, roles, reports & bans' },
      { label: 'Configuration', href: '/configuration', icon: SlidersHorizontal, description: 'Cloud configuration' },
      { label: 'Sessions', href: '/sessions', icon: Broadcast, description: 'Active player sessions' },
      { label: 'Matches', href: '/matches', icon: Sword, description: 'Hosted & joinable matches' },
      { label: 'Scores', href: '/scores', icon: Trophy, description: 'Leaderboard' },
    ],
  },
  {
    name: 'Safety & security',
    items: [
      { label: 'Reports', href: '/reports', icon: Flag, description: 'Player reports' },
      { label: 'Bans', href: '/bans', icon: Prohibit, description: 'Player bans' },
      { label: 'Blocked words', href: '/blocked-words', icon: TextT, description: 'Text moderation list' },
      { label: 'Anti-cheat', href: '/anti-cheat', icon: ShieldCheck, description: 'Runtime rules engine' },
    ],
  },
  {
    name: 'Integrations',
    items: [{ label: 'Bots', href: '/bots', icon: Robot, description: 'Bot accounts, tokens & roles' }],
  },
]

function matches(item: NavItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q) ||
    (item.description ?? '').toLowerCase().includes(q) ||
    item.href.toLowerCase().includes(q)
  )
}

export function AppSidebar() {
  const location = useLocation()
  const { openMobile, setOpenMobile } = useSidebar()

  /* After the mobile sidebar closes, Kumo has locked body scroll (position:fixed
   * on <body>) during the overlay. Safari iOS permanently loses the ability to
   * collapse its toolbar after this lock/unlock cycle.
   *
   * Wait past the sidebar animation (180ms → 300ms) then force a complete
   * body reflow by toggling display — this is the only known way to make
   * WebKit re-attach its scroll observer so the toolbar can collapse again. */
  useEffect(() => {
    if (!openMobile) {
      const timer = setTimeout(() => {
        // Nuclear option: force WebKit to completely re-layout the body.
        // This is the only reliable way to re-attach the toolbar-collapse
        // observer after Kumo's body scroll lock/unlock cycle.
        const { body } = document
        body.style.display = 'none'
        void body.offsetHeight // trigger reflow
        body.style.display = ''
        // Restore scroll position after the reflow
        window.scrollTo(0, window.scrollY)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [openMobile])
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => matches(i, q)) })).filter((g) => g.items.length > 0)
  }, [query])

  const active = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname === href || location.pathname.startsWith(`${href}/`)
  }

  return (
    <Sidebar className="lg:sticky lg:top-0 lg:h-svh">
      <Sidebar.Content>
        <div className="mx-3 mb-2">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-kumo-subtle"
            />
            <Input
              size="sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages…"
              className="w-full pl-8"
              aria-label="Search pages"
            />
          </div>
        </div>

        {groups.map((group) => (
          <Sidebar.Group key={group.name}>
            <Sidebar.GroupLabel>{group.name}</Sidebar.GroupLabel>
            <Sidebar.Menu>
              {group.items.map((item) => (
                <Sidebar.MenuItem key={item.href}>
                  <Sidebar.MenuButton
                    href={item.href}
                    icon={<item.icon size={18} weight="bold" />}
                    active={active(item.href)}
                    tooltip={item.label}
                    // On mobile the sidebar is an overlay: collapse it after navigating.
                    onClick={() => setOpenMobile(false)}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        ))}

        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
            <MagnifyingGlass size={18} className="text-kumo-inactive" />
            <p className="text-sm text-kumo-subtle">No pages match “{query}”.</p>
          </div>
        )}
      </Sidebar.Content>
    </Sidebar>
  )
}
