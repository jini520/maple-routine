// 주간 보스 수익 계산기 화면. 합계 · 난이도 펼침 · 결과 저장의 두 갈래를 본다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useBossProfitCalculatorStore } from '../../../features/boss-profit-calculator/store'
import { partySizeKey, useBossSchedulerStore } from '../../../features/boss-scheduler/store'
import { useBossSchedule } from '../../../features/boss-scheduler/use-boss-schedule'
import { readBossCharacters, type BossCharacterView } from '../../../features/boss-scheduler/views'
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
// 캐릭터는 쿼리 캐시에서 온다. 화면은 훅으로, 계산기 스토어는 `readBossCharacters` 로 같은 캐시를 보므로
// 둘을 같은 목록으로 세운다. 보스 스토어(파티 인원 · 수동 추적)는 실물이다.
jest.mock('../../../features/boss-scheduler/use-boss-schedule', () => ({ useBossSchedule: jest.fn() }))
jest.mock('../../../features/boss-scheduler/views', () => ({ readBossCharacters: jest.fn() }))

const mockedUseBossSchedule = jest.mocked(useBossSchedule)
const mockedReadBossCharacters = jest.mocked(readBossCharacters)

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
  const characters = [
    character('ocid-1', '단풍전사', [registered('루시드', 'hard'), registered('카링', 'normal')]),
    character('ocid-2', '도토리법사', [registered('윌', 'hard')]),
  ]
  mockedUseBossSchedule.mockReturnValue({
    status: 'loaded',
    characters,
    error: null,
    trackedOcids: ['ocid-1', 'ocid-2'],
    refresh: jest.fn(),
  })
  mockedReadBossCharacters.mockReturnValue(characters)
  useBossSchedulerStore.setState({
    partySizes: { [partySizeKey('ocid-1', 'kaling', 'normal')]: 3 },
    partyShares: {},
    manualTrackedByOcid: {},
  })
  useBossProfitCalculatorStore.setState({ loaded: false, records: [], openedId: null, bossesByOcid: {} })
  mockShowSuccess.mockClear()
})

/** 고른 캐릭터(ocid-1)를 더 보기 메뉴의 스케줄러 데이터 가져오기로 채운다 */
async function importSelected(view: Awaited<ReturnType<typeof renderOverlay>>): Promise<void> {
  await press(view.getByLabelText('더 보기'))
  await press(view.getByLabelText('스케줄러 데이터 가져오기'))
}

describe('BossProfitCalculatorScreen', () => {
  // 캐릭터 하나만 따져 볼 때 다른 캐릭터의 값을 먼저 걷어 내지 않아도 되게 한다(사용자 결정).
  it('처음 열면 모든 캐릭터가 비어 있고, 카드 머리에 안내와 보스 선택이 선다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    expect(view.getByText('0캐릭터 · 보스 0')).toBeTruthy()
    expect(view.getByText('이 캐릭터가 잡을 보스를 선택하세요')).toBeTruthy()
    expect(view.getByLabelText('보스 선택')).toBeTruthy()
    expect(view.getByTestId('calculator-character-total').props.children).toBe('0')
  })

  it('스케줄러 데이터 가져오기는 고른 캐릭터만 채우고, 바닥에 그 캐릭터의 수익이 선다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)
    const now = new Date()
    const 루시드 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'hard', partySize: 1, shares: EVEN }, now)
    const 카링 = bossPayoutMeso({ bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: EVEN }, now)

    await importSelected(view)

    expect(view.getByText('1캐릭터 · 보스 2')).toBeTruthy()
    expect(view.getByTestId('calculator-boss-count').props.children).toBe('2 / 12')
    expect(view.getByTestId('calculator-character-total').props.children).toBe(formatMesoUnits(루시드 + 카링))
    expect(view.getByTestId('calculator-total').props.children).toBe(formatMesoUnits(루시드 + 카링))
    expect(view.getByText(formatEok(루시드 + 카링))).toBeTruthy()
    expect(view.getByTestId('calculator-boss-payout-kaling').props.children).toBe(formatMesoUnits(카링))
  })

  // 로그인이 만료돼 동기화가 실패해도 캐시는 마지막으로 본 캐릭터를 든다. 그 값으로 연다.
  it('스케줄러 동기화가 실패한 상태여도 들고 있는 캐릭터로 연다', async () => {
    mockedUseBossSchedule.mockReturnValue({ ...mockedUseBossSchedule(), status: 'error' })

    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    expect(view.getByText('0캐릭터 · 보스 0')).toBeTruthy()
  })

  // 금액은 값을 고칠 때마다 다시 센다. 계산 버튼이 없다.
  it('난이도를 펼쳐 바꾸면 그 줄의 몫이 바로 바뀐다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)
    await importSelected(view)

    await press(view.getByLabelText('루시드 난이도 하드, 눌러서 바꾸기'))
    await press(view.getByLabelText('루시드 노멀'))

    const 노멀 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'normal', partySize: 1, shares: EVEN }, new Date())
    expect(view.getByTestId('calculator-boss-payout-lucid').props.children).toBe(formatMesoUnits(노멀))
  })

  // 보스를 다 빼도 카드는 사라지지 않고 머리만 남는다. 지울 보스가 없으면 초기화를 두지 않는다.
  it('초기화하면 카드가 머리만 남고, 빈 카드의 메뉴에는 초기화가 없다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)
    await importSelected(view)

    await press(view.getByLabelText('더 보기'))
    await press(view.getByLabelText('초기화'))

    expect(view.getByText('이 캐릭터가 잡을 보스를 선택하세요')).toBeTruthy()
    await press(view.getByLabelText('더 보기'))
    expect(view.queryByLabelText('초기화')).toBeNull()
  })

  // 기록을 연 뒤 묻지 않고 덮기만 하면 그 기록에서 고쳐 새 기록을 만들 방법이 없다.
  it('연 기록이 없으면 묻지 않고 남기고, 연 기록이 있으면 덮을지 새로 남길지 묻는다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorScreen />)

    await press(view.getByLabelText('결과 저장'))
    expect(await getBossProfitCalculatorRecords()).toHaveLength(1)
    expect(mockShowSuccess).toHaveBeenCalledWith('결과를 저장했어요')
    expect(view.queryByText('기존 저장된 기록에 덮어쓸까요?')).toBeNull()

    await press(view.getByLabelText('결과 저장'))
    expect(view.getByText('기존 저장된 기록에 덮어쓸까요?')).toBeTruthy()
    await press(view.getByText('새 기록으로'))

    expect(await getBossProfitCalculatorRecords()).toHaveLength(2)
  })
})
