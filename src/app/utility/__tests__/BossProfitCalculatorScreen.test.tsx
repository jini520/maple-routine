// 주간 보스 수익 계산기 화면. 합계 · 난이도 펼침 · 결과 저장의 두 갈래를 본다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useBossProfitCalculatorStore } from '../../../features/boss-profit-calculator/store'
import { partySizeKey, useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { bossPayoutMeso, formatEok } from '../../../lib/boss/boss-profit-calculator'
import { matchBossContent, type MatchedBoss } from '../../../lib/boss/boss-matching'
import { bossKeyOfApiName } from '../../../lib/boss/bosses'
import { formatMesoUnits } from '../../../lib/drop/drop-price'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { getBossProfitCalculatorRecords } from '../../../storage/boss-profit-calculator-records'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import type { BossDifficulty } from '../../../types'
import { BossProfitCalculatorScreen } from '../BossProfitCalculatorScreen'

const mockShowSuccess = jest.fn()
jest.mock('../../../features/toast/store', () => ({
  useToastStore: { getState: () => ({ showSuccess: mockShowSuccess, showError: jest.fn(), showInfo: jest.fn() }) },
}))
jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }

function registered(name: string, difficulty: BossDifficulty): MatchedBoss {
  return matchBossContent({
    bossKey: bossKeyOfApiName(name),
    apiName: name,
    difficulty,
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
  })
}

function character(ocid: string, characterName: string, weeklyBosses: MatchedBoss[]): BossCharacterView {
  return {
    ocid,
    characterName,
    weeklyBosses,
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
  }
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(() => {
  installFakePreferences()
  installNoopNativePorts()
  jest.mocked(useScreenNavigation).mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
  useTrackingModeStore.setState({ mode: 'auto' })
  useCharacterSelectionStore.setState({ selectedOcid: 'ocid-1' })
  useBossSchedulerStore.setState({
    status: 'loaded',
    trackedOcids: ['ocid-1', 'ocid-2'],
    characters: [
      character('ocid-1', '단풍전사', [registered('루시드', 'hard'), registered('카링', 'normal')]),
      character('ocid-2', '도토리법사', [registered('윌', 'hard')]),
    ],
    partySizes: { [partySizeKey('ocid-1', 'kaling', 'normal')]: 3 },
    partyShares: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
  })
  useBossProfitCalculatorStore.setState({ loaded: false, records: [], openedId: null, bossesByOcid: {} })
  mockShowSuccess.mockClear()
})

describe('BossProfitCalculatorScreen', () => {
  it('보스 관리 값으로 채우고 합계와 캐릭터별 금액을 적는다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)
    const now = new Date()
    const 루시드 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'hard', partySize: 1, shares: EVEN }, now)
    const 카링 = bossPayoutMeso({ bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: EVEN }, now)
    const 윌 = bossPayoutMeso({ bossKey: 'will', difficulty: 'hard', partySize: 1, shares: EVEN }, now)

    expect(view.getByTestId('calculator-total').props.children).toBe(formatMesoUnits(루시드 + 카링 + 윌))
    expect(view.getByText(formatEok(루시드 + 카링))).toBeTruthy()
    expect(view.getByText('2캐릭터 · 보스 3')).toBeTruthy()
    expect(view.getByTestId('calculator-boss-payout-kaling').props.children).toBe(formatMesoUnits(카링))
  })

  // 로그인이 만료돼 동기화가 실패해도 스케줄러는 마지막으로 본 캐릭터를 든다. 그 값으로 연다.
  it('스케줄러 동기화가 실패한 상태여도 들고 있는 캐릭터로 연다', async () => {
    useBossSchedulerStore.setState({ status: 'error' })

    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    expect(view.getByText('2캐릭터 · 보스 3')).toBeTruthy()
  })

  // 금액은 값을 고칠 때마다 다시 센다. 계산 버튼이 없다.
  it('난이도를 펼쳐 바꾸면 그 줄의 몫이 바로 바뀐다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    await press(view.getByLabelText('루시드 난이도 하드, 눌러서 바꾸기'))
    await press(view.getByLabelText('루시드 노멀'))

    const 노멀 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'normal', partySize: 1, shares: EVEN }, new Date())
    expect(view.getByTestId('calculator-boss-payout-lucid').props.children).toBe(formatMesoUnits(노멀))
  })

  it('초기화하면 그 캐릭터는 보스를 고르라는 카드가 된다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    await press(view.getByLabelText('초기화'))

    expect(view.getByText('이 캐릭터가 잡을 보스를 선택하세요')).toBeTruthy()
  })

  // 계산기는 늘 마지막 기록으로 열리므로, 묻지 않고 덮기만 하면 새 기록을 만들 방법이 없다.
  it('연 기록이 없으면 묻지 않고 남기고, 연 기록이 있으면 덮을지 새로 남길지 묻는다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    await press(view.getByLabelText('결과 저장'))
    expect(await getBossProfitCalculatorRecords()).toHaveLength(1)
    expect(mockShowSuccess).toHaveBeenCalledWith('결과를 저장했어요')
    expect(view.queryByText('연 기록을 덮을까요?')).toBeNull()

    await press(view.getByLabelText('결과 저장'))
    expect(view.getByText('연 기록을 덮을까요?')).toBeTruthy()
    await press(view.getByText('새 기록으로'))

    expect(await getBossProfitCalculatorRecords()).toHaveLength(2)
  })
})
