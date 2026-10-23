/**
 * 빠른 이동의 화면마다 가는 곳 · 아이콘과, 칸을 칠하는 색. 위젯과 편집 시트가 함께 쓴다.
 */
import { useCallback } from 'react'

import {
  BellRingIcon,
  CalculatorIcon,
  CalendarClockIcon,
  CrownIcon,
  DivideIcon,
  GearIcon,
  HammerIcon,
  ListChecksIcon,
  MegaphoneIcon,
  ProfitIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  TrendingUpIcon,
  UserRoundIcon,
  WalletIcon,
} from '../../components/atoms'
import type { IconProps } from '../../components/atoms/Icon/icon-base'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { withAlpha } from '../../lib/color'
import type { RootStackParamList, StackRouteName, TabRouteName } from '../../navigation/routes'
import { useThemeAppearance } from '../../theme/context'
import type { QuickLinkId } from '../../types/quick-links'

/** 인자 없이 열리는 하위 페이지. 칸 하나가 늘 같은 화면을 열어야 해서 인자가 필요한 화면은 고를 수 없다 */
type ParamlessRoute = { [K in StackRouteName]: undefined extends RootStackParamList[K] ? K : never }[StackRouteName]

export type QuickLinkTarget = { kind: 'tab'; page: TabRouteName } | { kind: 'push'; route: ParamlessRoute }

export const QUICK_LINK_TARGETS: Readonly<Record<QuickLinkId, QuickLinkTarget>> = {
  appointments: { kind: 'tab', page: 'Appointments' },
  content: { kind: 'tab', page: 'Content' },
  boss: { kind: 'tab', page: 'Boss' },
  profit: { kind: 'tab', page: 'Profit' },
  cashbook: { kind: 'tab', page: 'Cashbook' },
  stats: { kind: 'tab', page: 'Stats' },
  utility: { kind: 'tab', page: 'Utility' },
  'boss-manage': { kind: 'push', route: 'BossManage' },
  characters: { kind: 'push', route: 'SettingsCharacters' },
  'item-split': { kind: 'push', route: 'UtilityItemSplit' },
  'boss-profit-calculator': { kind: 'push', route: 'UtilityBossProfitCalculator' },
  'mvp-grade': { kind: 'push', route: 'SettingsMvpGrade' },
  // 분류를 넘기지 않으면 공지 목록이 모든 분류를 그린다.
  notices: { kind: 'push', route: 'SettingsNotices' },
  'notice-alerts': { kind: 'push', route: 'SettingsNoticeAlerts' },
  'app-settings': { kind: 'push', route: 'AppSettings' },
}

export const QUICK_LINK_ICONS: Readonly<Record<QuickLinkId, React.ComponentType<IconProps>>> = {
  appointments: CalendarClockIcon,
  content: ListChecksIcon,
  boss: SwordsIcon,
  profit: ProfitIcon,
  cashbook: WalletIcon,
  stats: TrendingUpIcon,
  utility: HammerIcon,
  'boss-manage': SlidersHorizontalIcon,
  characters: UserRoundIcon,
  'item-split': DivideIcon,
  'boss-profit-calculator': CalculatorIcon,
  'mvp-grade': CrownIcon,
  notices: MegaphoneIcon,
  'notice-alerts': BellRingIcon,
  'app-settings': GearIcon,
}

/** 칸의 원 바탕과 아이콘이 쓰는 `primary` 투명도. 어두운 바탕에서는 같은 투명도가 더 흐려 보여 더 올린다 */
const QUICK_LINK_ALPHA = {
  light: { tint: 0.06, ink: 0.55 },
  dark: { tint: 0.08, ink: 0.7 },
} as const

export function useQuickLinkColors(): { tint: string; ink: string } {
  const { definition } = useThemeAppearance()
  const alpha = QUICK_LINK_ALPHA[definition.mode]
  return { tint: withAlpha(definition.primary, alpha.tint), ink: withAlpha(definition.primary, alpha.ink) }
}

/** 칸 하나를 눌러 그 화면을 여는 함수 */
export function useOpenQuickLink(): (id: QuickLinkId) => void {
  const openTab = useOpenTab()
  const navigation = useScreenNavigation()

  return useCallback(
    (id: QuickLinkId) => {
      const target = QUICK_LINK_TARGETS[id]
      if (target.kind === 'tab') openTab(target.page)
      // 라우트 합집합 하나로는 `navigate` 의 겹쳐 쓴 시그니처가 고르지 못한다. 인자 없이 열린다는 것은 `ParamlessRoute` 가 보장한다.
      else (navigation.navigate as (route: ParamlessRoute) => void)(target.route)
    },
    [openTab, navigation],
  )
}
