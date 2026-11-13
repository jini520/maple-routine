/**
 * 빠른 이동의 화면마다 가는 곳 · 아이콘과, 칸을 칠하는 색. 위젯과 편집 시트가 함께 쓴다.
 */
import { useCallback } from 'react'

import {
  BackpackIcon,
  BellRingIcon,
  CalculatorIcon,
  CalendarClockIcon,
  CrosshairIcon,
  CrownIcon,
  DivideIcon,
  GearIcon,
  GemIcon,
  HammerIcon,
  IdCardIcon,
  ListChecksIcon,
  MegaphoneIcon,
  PaletteIcon,
  ProfitIcon,
  SlidersHorizontalIcon,
  SwordsIcon,
  TrendingUpIcon,
  UserRoundIcon,
  WalletIcon,
} from '../../components/atoms'
import type { IconProps } from '../../components/atoms/Icon/icon-base'
import { useGameTable } from '../../features/game-data/sync'
import { useOpenTab } from '../../hooks/useOpenTab'
import { useScreenNavigation } from '../../hooks/useScreenNavigation'
import { cashbookCategoryOf, type IncomeCategoryKey } from '../../lib/cashbook/categories'
import { withAlpha } from '../../lib/color'
import type { RootStackParamList, StackRouteName, TabRouteName } from '../../navigation/routes'
import { useThemeAppearance } from '../../theme/context'
import type { QuickLinkId } from '../../types/quick-links'

/** 인자 없이 열리는 하위 페이지. 칸 하나가 늘 같은 화면을 열어야 해서 인자가 필요한 화면은 고를 수 없다 */
type ParamlessRoute = { [K in StackRouteName]: undefined extends RootStackParamList[K] ? K : never }[StackRouteName]

/** `income` 은 가계부 탭으로 가서 그 분류의 새 수입 폼을 연다 */
export type QuickLinkTarget =
  | { kind: 'tab'; page: TabRouteName }
  | { kind: 'push'; route: ParamlessRoute }
  | { kind: 'income'; category: IncomeCategoryKey }

export const QUICK_LINK_TARGETS: Readonly<Record<QuickLinkId, QuickLinkTarget>> = {
  appointments: { kind: 'tab', page: 'Appointments' },
  content: { kind: 'tab', page: 'Content' },
  boss: { kind: 'tab', page: 'Boss' },
  profit: { kind: 'tab', page: 'Profit' },
  cashbook: { kind: 'tab', page: 'Cashbook' },
  stats: { kind: 'tab', page: 'Stats' },
  inventory: { kind: 'tab', page: 'Inventory' },
  utility: { kind: 'tab', page: 'Utility' },
  'income-hunting': { kind: 'income', category: 'hunting' },
  'income-hunt-loot-sale': { kind: 'income', category: 'hunt_loot_sale' },
  'boss-manage': { kind: 'push', route: 'BossManage' },
  characters: { kind: 'push', route: 'SettingsCharacters' },
  accounts: { kind: 'push', route: 'SettingsAccounts' },
  'item-split': { kind: 'push', route: 'UtilityItemSplit' },
  'boss-profit-calculator': { kind: 'push', route: 'UtilityBossProfitCalculator' },
  'mvp-grade': { kind: 'push', route: 'SettingsMvpGrade' },
  // 분류를 넘기지 않으면 공지 목록이 모든 분류를 그린다.
  notices: { kind: 'push', route: 'SettingsNotices' },
  'notice-alerts': { kind: 'push', route: 'SettingsNoticeAlerts' },
  theme: { kind: 'push', route: 'SettingsTheme' },
  'app-settings': { kind: 'push', route: 'AppSettings' },
}

export const QUICK_LINK_ICONS: Readonly<Record<QuickLinkId, React.ComponentType<IconProps>>> = {
  appointments: CalendarClockIcon,
  content: ListChecksIcon,
  boss: SwordsIcon,
  profit: ProfitIcon,
  cashbook: WalletIcon,
  stats: TrendingUpIcon,
  // 하단바와 같은 그림이다. 같은 화면이 두 곳에서 다른 그림이면 같은 화면으로 읽히지 않는다.
  inventory: BackpackIcon,
  utility: HammerIcon,
  'income-hunting': CrosshairIcon,
  'income-hunt-loot-sale': GemIcon,
  'boss-manage': SlidersHorizontalIcon,
  characters: UserRoundIcon,
  accounts: IdCardIcon,
  'item-split': DivideIcon,
  'boss-profit-calculator': CalculatorIcon,
  'mvp-grade': CrownIcon,
  notices: MegaphoneIcon,
  'notice-alerts': BellRingIcon,
  theme: PaletteIcon,
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

/**
 * 칸을 지금 열 수 있는지 가르는 함수. 가계부 분류 칸은 기기의 서버 갈래 표에 그 분류가 있어야 연다.
 *
 * 옛 사본에는 `사냥 전리품 판매` 줄이 없을 수 있다. 그때 가계부 시트도 그 분류를 고를 수 없다.
 */
export function useCanOpenQuickLink(): (id: QuickLinkId) => boolean {
  // 표가 바뀌면 다시 그려 숨었던 칸이 선다.
  useGameTable('cashbookCategories')
  return (id) => {
    const target = QUICK_LINK_TARGETS[id]
    return target.kind !== 'income' || cashbookCategoryOf('income', target.category) !== null
  }
}

/** 칸 하나를 눌러 그 화면을 여는 함수 */
export function useOpenQuickLink(): (id: QuickLinkId) => void {
  const openTab = useOpenTab()
  const navigation = useScreenNavigation()

  return useCallback(
    (id: QuickLinkId) => {
      const target = QUICK_LINK_TARGETS[id]
      if (target.kind === 'tab') openTab(target.page)
      else if (target.kind === 'income') openTab('Cashbook', { incomeCategory: target.category })
      // 라우트 합집합 하나로는 `navigate` 의 겹쳐 쓴 시그니처가 고르지 못한다. 인자 없이 열린다는 것은 `ParamlessRoute` 가 보장한다.
      else (navigation.navigate as (route: ParamlessRoute) => void)(target.route)
    },
    [openTab, navigation],
  )
}
