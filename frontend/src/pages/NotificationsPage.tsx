import { useState } from 'react'
import { Button, Input, InputArea, LayerCard, Text, useKumoToastManager } from '@cloudflare/kumo'
import { Bell, BellRinging, Broadcast } from '@phosphor-icons/react'
import { getClient } from '../api/client'
import { errorText, useApiMutation } from '../hooks/useApi'
import { PageHeader } from '../components/PageHeader'

const CHANNELS = ['GLOBAL', 'MENU', 'MATCH'] as const
type Channel = (typeof CHANNELS)[number]

const CHANNEL_HINTS: Record<Channel, string> = {
  GLOBAL: 'Every connected client receives it',
  MENU: 'Players sitting in the main menu',
  MATCH: 'Players currently in a match',
}

function ChannelPills({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHANNELS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`cursor-pointer rounded-full px-3 py-1 text-[13px] transition-none ${
            value === c ? 'bg-kumo-brand text-kumo-inverse' : 'bg-kumo-tint text-kumo-default hover:bg-kumo-base ring ring-kumo-line'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

export function NotificationsPage() {
  const toast = useKumoToastManager()
  const broadcast = useApiMutation(
    ['POST /api/v1/server-notification'],
    (input: { channelName: Channel; text: string }) =>
      getClient().POST('/api/v1/server-notification', { body: input }),
  )
  const user = useApiMutation(
    ['POST /api/v1/server-notification/user'],
    (input: { channelName: Channel; userId: string; text: string }) =>
      getClient().POST('/api/v1/server-notification/user', { body: input }),
  )

  const [channel, setChannel] = useState<Channel>('GLOBAL')
  const [text, setText] = useState('')
  const [textError, setTextError] = useState('')

  const [userChannel, setUserChannel] = useState<Channel>('GLOBAL')
  const [userId, setUserId] = useState('')
  const [userText, setUserText] = useState('')
  const [userError, setUserError] = useState('')

  const submitBroadcast = async () => {
    if (!text.trim()) {
      setTextError('Notification text is required')
      return
    }
    const r = await broadcast.mutateAsync({ channelName: channel, text: text.trim() })
    if (r.ok) {
      toast.add({ id: 'notif-ok', title: `Notification sent to ${channel}`, variant: 'success' })
      setText('')
      setTextError('')
    } else {
      toast.add({ id: 'notif-err', title: `Failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  const submitUser = async () => {
    const errs: string[] = []
    if (!userId.trim()) errs.push('User ID is required')
    if (!userText.trim()) errs.push('Notification text is required')
    setUserError(errs.join(' · '))
    if (errs.length > 0) return
    const r = await user.mutateAsync({ channelName: userChannel, userId: userId.trim(), text: userText.trim() })
    if (r.ok) {
      toast.add({ id: 'notif-u-ok', title: 'Notification sent', description: `Delivered to ${userId.trim().slice(0, 12)}… on ${userChannel}`, variant: 'success' })
      setUserText('')
      setUserError('')
    } else {
      toast.add({ id: 'notif-u-err', title: `Failed (HTTP ${r.status})`, description: errorText(r), variant: 'error' })
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Server notification"
        description="Push in-game notifications to players in real time — to an entire channel or to a single user."
        icon={<Bell size={20} weight="fill" />}
      />

      <div className="grid gap-4">
        <LayerCard className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-kumo-tint text-kumo-brand">
              <Broadcast size={16} weight="fill" />
            </span>
            <Text variant="heading3" as="h3">Broadcast to a channel</Text>
          </div>
          <div>
            <div className="mb-1.5">
              <Text variant="secondary" size="sm">Channel</Text>
            </div>
            <ChannelPills value={channel} onChange={setChannel} />
            <div className="mt-1.5">
              <Text variant="secondary" size="sm">{CHANNEL_HINTS[channel]}</Text>
            </div>
          </div>
          <InputArea
            label="Message text"
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={textError}
            rows={3}
            placeholder="This is a test notification coming from the server"
          />
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => void submitBroadcast()} loading={broadcast.isPending} icon={<Broadcast size={15} />}>
              Broadcast
            </Button>
          </div>
        </LayerCard>

        <LayerCard className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-kumo-tint text-kumo-brand">
              <BellRinging size={16} weight="fill" />
            </span>
            <Text variant="heading3" as="h3">Notify a single user</Text>
          </div>
          <div>
            <div className="mb-1.5">
              <Text variant="secondary" size="sm">Channel</Text>
            </div>
            <ChannelPills value={userChannel} onChange={setUserChannel} />
          </div>
          <Input
            label="User ID"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="550e8400-e29b-41d4-a716-446655440000"
            className="font-mono text-[12.5px]"
          />
          <InputArea
            label="Message text"
            required
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            error={userError}
            rows={2}
            placeholder="This notification is just for you"
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => void submitUser()} loading={user.isPending} icon={<BellRinging size={15} />}>
              Send to user
            </Button>
          </div>
        </LayerCard>
      </div>
    </div>
  )
}
