import { forwardRef } from 'react'
import { LinkProvider, Sidebar, useSidebar, type LinkComponentProps } from '@cloudflare/kumo'
import { Link as RouterLink, Outlet } from '@tanstack/react-router'
import { List, X } from '@phosphor-icons/react'
import { AppSidebar } from './components/AppSidebar'
import { WelcomePage } from './pages/WelcomePage'
import { useConfig } from './lib/config'

/** Bridges Kumo links to the TanStack Router so sidebar navigation is SPA-style. */
const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>((props, ref) => {
  const { href, ...rest } = props
  return <RouterLink ref={ref} to={href ?? ''} {...rest} />
})
AppLink.displayName = 'AppLink'

/**
 * Floating circular "liquid glass" sidebar toggle (mobile only).
 * Replaces the old full-width mobile header: a translucent, blurred button
 * that floats above the content and opens/closes the mobile sidebar overlay.
 */
function MobileSidebarTrigger() {
  const { openMobile, toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={openMobile ? 'Close sidebar' : 'Open sidebar'}
      aria-expanded={openMobile}
      className={`animate-rise fixed bottom-4 left-4 flex size-13 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-kumo-base/55 text-kumo-strong shadow-lg shadow-black/15 backdrop-blur-xl transition-all duration-200 ease-out hover:scale-105 hover:bg-kumo-base/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-kumo-brand active:scale-95 lg:hidden ${openMobile ? 'z-30' : 'z-[60]'}`}
    >
      {openMobile ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
    </button>
  )
}

export function App() {
  const { config } = useConfig()

  // Manager-only console: gate everything behind a configured manager JWT.
  if (!config.token) {
    return (
      <LinkProvider component={AppLink}>
        <WelcomePage />
      </LinkProvider>
    )
  }

  return (
    <LinkProvider component={AppLink}>
      {/* Portrait tablets (≥768px) behave like mobile: the sidebar is an overlay with the floating trigger.
          The breakpoint sits at 1024px (lg) so only landscape tablets and up get the docked sidebar. */}
      <Sidebar.Provider className="w-full" defaultOpen collapsible="icon" peekable mobileBreakpoint={1024} animationDuration={180}>
        <AppSidebar />
        <main className="min-w-0 flex-1 bg-kumo-recessed">
          <div className="animate-rise mx-auto w-full max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6 lg:px-8">
            <Outlet />
          </div>
        </main>
        <MobileSidebarTrigger />
      </Sidebar.Provider>
    </LinkProvider>
  )
}
