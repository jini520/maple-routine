// 보스 수익 조각들이 공유하는 렌더 도우미. 테스트 파일이 아니라 **보조 파일**이라
// `*.test.tsx` 가 아니다(`jest.config.js` 의 `testMatch` 가 이름으로 거른다).
//
// 이 조각들은 셋을 전제한다: 테마(색이 `var(--color-*)` 라 프로바이더 밖에서는 스타일 자체가
// 사라진다), 안전영역(시트가 읽는다), 그리고 **보스 수익 컨텍스트**(`useBossProfitContext` 는
// 밖에서 부르면 던진다. 그것이 그 컨텍스트의 계약이다).
//
// 픽스처의 보스 key·이름은 **`weekly-bosses.json` 에서 뽑는다**(게임 레퍼런스
// 값을 테스트가 베끼면 두 벌이 된다).
import { render } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import type { BossProfitRow, BossProfitWeeklySubtotal } from '../../../features/boss-profit/store'
import weeklyBossesData from '../../../data/weekly-bosses.json'
import { bossNameOf } from '../../../lib/boss/bosses'

import { ThemeProvider } from '../../../theme/ThemeProvider'
import { 테스트_안전영역 } from '../../../components/__tests__/render-atom'
import { BossProfitContextProvider } from '../boss-profit-context'
import type { BossProfitContextValue } from '../boss-profit-context'

/** 픽스처가 쓰는 주간 보스의 key. 목록의 첫 항목이라 데이터가 바뀌어도 따라간다. */
export const 주간보스 = weeklyBossesData.weekly[0].key
export const 다른주간보스 = weeklyBossesData.weekly[1].key
export const 월간보스 = weeklyBossesData.monthly[0].key
/** 화면에 보이는 이름. 글자를 확인하는 단언이 쓴다. */
export const 주간보스이름 = weeklyBossesData.weekly[0].name
export const 다른주간보스이름 = weeklyBossesData.weekly[1].name
export const 월간보스이름 = weeklyBossesData.monthly[0].name

export const PERIOD = '2026-08-06'
export const NOW = new Date('2026-08-11T12:00:00+09:00')

/** `bossKey` 만 덮으면 보이는 이름도 그 보스의 것으로 따라간다. */
export function 보스행(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  const bossKey = overrides.bossKey ?? 주간보스
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    world: null,
    worldKey: null,
    bossKey,
    bossName: bossNameOf(bossKey, bossKey),
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: PERIOD,
    periodLabel: '이번 주',
    priceMeso: 20_400_000_000,
    maxPartySize: 6,
    partySize: 3,
    payoutMeso: 6_800_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

export function 주차소계(overrides: Partial<BossProfitWeeklySubtotal> = {}): BossProfitWeeklySubtotal {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    periodKey: PERIOD,
    totalMeso: 1_000_000_000,
    drops: [],
    state: 'recorded',
    ...overrides,
  }
}

export function 컨텍스트값(overrides: Partial<BossProfitContextValue> = {}): BossProfitContextValue {
  return {
    tab: 'weekly',
    periodKey: PERIOD,
    loadedTab: 'weekly',
    loadedPeriodKey: PERIOD,
    now: NOW,
    dropsByRowKey: {},
    partyPlans: {},
    setRowParty: jest.fn().mockResolvedValue(undefined),
    setBossDrops: jest.fn().mockResolvedValue(undefined),
    onRetryPeriod: jest.fn(),
    ...overrides,
  }
}

export function renderProfit(
  ui: ReactElement,
  context: BossProfitContextValue = 컨텍스트값(),
): ReturnType<typeof render> {
  return render(
    <SafeAreaProvider initialMetrics={테스트_안전영역}>
      <ThemeProvider>
        <BossProfitContextProvider value={context}>{ui as ReactNode}</BossProfitContextProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}
