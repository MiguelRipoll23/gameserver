import { useState } from 'react'
import { Button, Input, InputArea, LayerCard, Loader, Select, Text, useKumoToastManager } from '@cloudflare/kumo'
import {
  Bell,
  Broadcast,
  Flag,
  HardDrives,
  Megaphone,
  Package,
  Prohibit,
  Robot,
  ShieldCheck,
  Sword,
  TextT,
  Trophy,
  Users,
} from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiGet, useApiMutation } from '../hooks/useApi'
import { useConfig } from '../lib/config'
import { PageHeader } from '../components/PageHeader'

const REFRESH_OPTIONS: Record<string, string> = {
  off: 'Off',
  '30s': '30s',
  '1m': '1 min',
  '5m': '5 min',
  '15m': '15 min',
  '30m': '30 min',
}

const REFRESH_MS: Record<string, number> = {
  off: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 mb-2.5 text-xs font-semibold tracking-wider text-kumo-subtle uppercase">{children}</h2>
)

/**
 * Section grid: two equal columns that fill the available width on mobile,
 * switching to content-hugging cards (min 11rem) that wrap from md up.
 * Every row is stretched to the tallest card in the section.
 */
const SECTION_GRID =
  'grid auto-rows-fr gap-3 grid-cols-2 md:[grid-template-columns:repeat(auto-fit,minmax(11rem,max-content))]'

/** Card header with a larger, flat (no background) brand-colored icon above the centered title. */
function CardHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className="text-kumo-brand">{icon}</span>
      <Text variant="heading3" as="h3">{title}</Text>
    </div>
  )
}

/** Counter/status card fed by the single console-dashboard response. */
function DashCard({
  title,
  icon,
  count,
  chip,
  loading,
  error,
}: {
  title: string
  icon: React.ReactNode
  count?: number | null
  chip?: string | null
  loading: boolean
  error: string
}) {
  return (
    <LayerCard className="flex min-w-0 flex-col gap-3 p-4 md:min-w-44">
      <CardHeader title={title} icon={icon} />
      <div className="flex flex-1 items-center justify-center">
        {loading ? (
          <Loader size="sm" />
        ) : error ? (
          <Text variant="error" size="sm">{error}</Text>
        ) : count !== undefined ? (
          <span className="text-3xl font-semibold text-kumo-strong">{count === null ? '—' : count}</span>
        ) : chip !== undefined ? (
          chip === null ? (
            <Text variant="secondary" size="sm">Not set</Text>
          ) : (
            <span className="max-w-full truncate rounded-md bg-kumo-tint px-2.5 py-1 text-[13px] text-kumo-strong">{chip}</span>
          )
        ) : (
          <Text variant="secondary" size="sm">—</Text>
        )}
      </div>
    </LayerCard>
  )
}

interface ServerMessagePreview {
  title?: unknown
  content?: unknown
  createdAt?: unknown
}

interface DashboardData {
  minimumVersion?: unknown
  usersCount?: unknown
  botsCount?: unknown
  sessionsCount?: unknown
  matchesCount?: unknown
  scoresCount?: unknown
  reportsCount?: unknown
  bansCount?: unknown
  blockedWordsCount?: unknown
  antiCheatRulesCount?: unknown
  latestServerMessage?: ServerMessagePreview | null
}

const formatTs = (v: unknown): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  try {
    return new Date(n).toLocaleString()
  } catch {
    return ''
  }
}

/** Latest server message rendered as a prefilled, read-only form. */
function ServerMessageCard({
  msg,
  loading,
  error,
}: {
  msg: ServerMessagePreview | null | undefined
  loading: boolean
  error: string
}) {
  return (
    <LayerCard className="flex min-w-44 w-full flex-col gap-3 p-4 sm:w-96">
      <CardHeader title="Server message" icon={<Megaphone size={24} weight="fill" />} />
      {loading && !msg ? (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader size="sm" />
          <Text variant="secondary" size="sm">Loading messages…</Text>
        </div>
      ) : error && !msg ? (
        <div className="flex justify-center py-4">
          <Text variant="error" size="sm">{error}</Text>
        </div>
      ) : !msg ? (
        <div className="py-4 text-center">
          <Text variant="secondary" size="sm">No server messages yet.</Text>
        </div>
      ) : (
        <>
          <Input
            label="Title"
            disabled
            value={msg.title !== undefined ? String(msg.title) : ''}
            placeholder="Untitled"
          />
          <InputArea
            label="Content"
            disabled
            rows={3}
            value={msg.content !== undefined ? String(msg.content) : ''}
            placeholder="No content"
          />
          <Input label="Time" disabled value={formatTs(msg.createdAt)} placeholder="—" />
        </>
      )}
    </LayerCard>
  )
}

type Channel = 'GLOBAL' | 'MENU' | 'MATCH'

const NOTIFICATION_CHANNELS: Record<Channel, string> = {
  GLOBAL: 'Global',
  MENU: 'Menu',
  MATCH: 'Match',
}

/** Quick in-place notification composer backed by POST /server-notification. */
function NotificationCard() {
  const toast = useKumoToastManager()
  const send = useApiMutation(
    ['POST /api/v1/server-notification'],
    (input: { channelName: Channel; text: string }) =>
      getClient().POST('/api/v1/server-notification', { body: input }),
  )
  const [text, setText] = useState('')
  const [channel, setChannel] = useState<Channel>('GLOBAL')
  const [error, setError] = useState('')

  const submit = async () => {
    if (!text.trim()) {
      setError('Notification text is required')
      return
    }
    const r = await send.mutateAsync({ channelName: channel, text: text.trim() })
    if (r.ok) {
      toast.add({ id: 'dash-notif', title: 'Notification sent', description: `Broadcast to ${channel}`, variant: 'success' })
      setText('')
      setError('')
    } else {
      toast.add({ id: 'dash-notif-err', title: `Failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <LayerCard className="flex min-w-44 w-full flex-col gap-3 p-4 sm:w-80">
      <CardHeader title="Server notification" icon={<Bell size={24} weight="fill" />} />
      <Input
        label="Message"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError('')
        }}
        error={error}
        placeholder="Send a message to players…"
        onKeyDown={(e) => e.key === 'Enter' && void submit()}
      />
      <Select
        label="Channel"
        size="sm"
        value={channel}
        onValueChange={(v) => setChannel((v ?? 'GLOBAL') as Channel)}
        items={NOTIFICATION_CHANNELS}
        className="w-full"
        aria-label="Notification channel"
      />
      <Button variant="primary" onClick={() => void submit()} loading={send.isPending} icon={<Broadcast size={15} />}>
        Send
      </Button>
    </LayerCard>
  )
}

export function DashboardPage() {
  const { config } = useConfig()
  const [refreshKey, setRefreshKey] = useState('5m')
  const refreshMs = REFRESH_MS[refreshKey]

  const dashboard = useApiGet(
    ['GET /api/v1/console-dashboard'],
    () => getClient().GET('/api/v1/console-dashboard'),
    Boolean(config.baseUrl),
    { refetchInterval: refreshMs || false },
  )

  const result = dashboard.data
  const body =
    result?.isJson && result.body && typeof result.body === 'object'
      ? (result.body as DashboardData)
      : null
  const loading = dashboard.isLoading && !result
  const error = result && !result.ok ? (result.status ? `HTTP ${result.status}` : 'Server unreachable') : ''

  const count = (v: unknown): number | null => (typeof v === 'number' ? v : null)

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Live overview of your game server."
        actions={
          <Select
            aria-label="Auto refresh interval"
            size="sm"
            value={refreshKey}
            onValueChange={(v) => setRefreshKey((v ?? '5m') as string)}
            items={Object.fromEntries(Object.entries(REFRESH_OPTIONS).map(([k, label]) => [k, `Refresh: ${label}`]))}
          />
        }
      />

      <SectionLabel>Announcements</SectionLabel>
      <div className="flex flex-wrap gap-3">
        <ServerMessageCard msg={body?.latestServerMessage} loading={loading} error={error} />
        <NotificationCard />
      </div>

      <SectionLabel>Gameplay</SectionLabel>
      <div className={SECTION_GRID}>
        <DashCard
          title="Minimum version"
          icon={<Package size={24} />}
          chip={typeof body?.minimumVersion === 'string' ? body.minimumVersion : null}
          loading={loading}
          error={error}
        />
        <DashCard title="Users" icon={<Users size={24} />} count={count(body?.usersCount)} loading={loading} error={error} />
        <DashCard title="Sessions" icon={<HardDrives size={24} />} count={count(body?.sessionsCount)} loading={loading} error={error} />
        <DashCard title="Matches" icon={<Sword size={24} weight="fill" />} count={count(body?.matchesCount)} loading={loading} error={error} />
        <DashCard title="Scores" icon={<Trophy size={24} />} count={count(body?.scoresCount)} loading={loading} error={error} />
      </div>

      <SectionLabel>Safety &amp; security</SectionLabel>
      <div className={SECTION_GRID}>
        <DashCard title="Reports" icon={<Flag size={24} weight="fill" />} count={count(body?.reportsCount)} loading={loading} error={error} />
        <DashCard title="Bans" icon={<Prohibit size={24} weight="fill" />} count={count(body?.bansCount)} loading={loading} error={error} />
        <DashCard title="Blocked words" icon={<TextT size={24} />} count={count(body?.blockedWordsCount)} loading={loading} error={error} />
        <DashCard title="Anti-cheat rules" icon={<ShieldCheck size={24} />} count={count(body?.antiCheatRulesCount)} loading={loading} error={error} />
      </div>

      <SectionLabel>Integrations</SectionLabel>
      <div className={SECTION_GRID}>
        <DashCard title="Bots" icon={<Robot size={24} />} count={count(body?.botsCount)} loading={loading} error={error} />
      </div>

    </div>
  )
}
