import type { Icon } from '@phosphor-icons/react'
import {
  Bell,
  ChartBar,
  ChatCircleText,
  Flag,
  Key,
  Megaphone,
  Package,
  Plug,
  Prohibit,
  Pulse,
  Ranking,
  Robot,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sword,
  Terminal,
  TextT,
  UserPlus,
  Users,
} from '@phosphor-icons/react'

const TAG_ICONS: Record<string, Icon> = {
  Default: Pulse,
  'Game version': Package,
  'User registration': UserPlus,
  'User authentication': Key,
  'Server connection': Plug,
  Discord: ChatCircleText,
  'Game configuration': SlidersHorizontal,
  'Server messages': Megaphone,
  'Server stats': ChartBar,
  Matches: Sword,
  'User scores': Ranking,
  'User reports': Flag,
  'User bans': Prohibit,
  'Anti-cheat rules': ShieldCheck,
  'Server notification': Bell,
  Users: Users,
  'User roles': Shield,
  Bots: Robot,
  'Bot roles': Robot,
  'Blocked words': TextT,
  General: Terminal,
}

export function tagIcon(tag: string): Icon {
  return TAG_ICONS[tag] ?? Terminal
}
