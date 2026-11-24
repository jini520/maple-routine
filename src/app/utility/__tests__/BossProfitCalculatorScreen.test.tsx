// 주간 보스 수익 계산기 화면. 합계 · 난이도 펼침 · 결과 저장의 두 경우를 본다.
import { act, fireEvent, within } from '@testing-library/react-native'

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
// 자동 수수료가 읽는 등급 기록. ocid-1 은 다이아(3%) 메이플 ID 이고, ocid-2 는 등급을 고르지 않은 메이플 ID 라 일반(5%)이다.
jest.mock('../../../features/mvp-grade/fee-context', () => ({
  loadFeeContext: jest.fn(async () => ({
    histories: new Map([['A', [{ startDate: '2026-06-01', grade: 'diamond' }]]]),
    sightings: [
      { ocid: 'ocid-1', name: '단풍전사', accountId: 'A', firstSeenOn: '2026-06-01', lastSeenOn: '2026-11-20' },
      { ocid: 'ocid-2', name: '도토리법사', accountId: 'B', firstSeenOn: '2026-06-01', lastSeenOn: '2026-11-20' },
    ],
    fallbackOcid: 'ocid-1',
  })),
}))
// 캐릭터는 쿼리 캐시에서 온다. 화면은 훅으로, 계산기 스토어는 `readBossCharacters` 로 같은 캐시를 보므로
// 둘을 같은 목록으로 세운다. 보스 스토어(파티 인원 · 수동 추적)는 실물이다.
jest.mock('../../../features/boss-scheduler/use-boss-schedule', () => ({ useBossSchedule: jest.fn() }))
jest.mock('../../../features/boss-scheduler/views', () => ({ readBossCharacters: jest.fn() }))

const mockedUseBossSchedule = jest.mocked(useBossSchedule)
const mockedReadBossCharacters = jest.mocked(readBossCharacters)

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
/** 등급을 고르지 않은 메이플 ID 의 요율. 균등 분배는 수수료를 안 보므로 몫과 상관이 없다 */
const NORMAL_FEE = 5

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
    manualCompletedByOcid: {},
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
    const 루시드 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'hard', partySize: 1, shares: EVEN }, now, NORMAL_FEE)
    const 카링 = bossPayoutMeso({ bossKey: 'kaling', difficulty: 'normal', partySize: 3, shares: EVEN }, now, NORMAL_FEE)

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

    const 노멀 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'normal', partySize: 1, shares: EVEN }, new Date(), NORMAL_FEE)
    expect(view.getByTestId('calculator-boss-payout-lucid').props.children).toBe(formatMesoUnits(노멀))
  })

  // 계산기는 저장한 날이 아니라 오늘을 센다. 자동 수수료도 그 캐릭터의 오늘 등급 요율이다.
  it('요율이 빈 비율 보스는 그 캐릭터의 오늘 등급 요율로 세고, 파티 모달이 그 등급의 자동으로 열려 적용해도 요율을 비워 둔다', async () => {
    useBossSchedulerStore.setState({
      partyShares: {
        [partySizeKey('ocid-1', 'kaling', 'normal')]: { crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: null, splitFeeAuto: true },
      },
    })
    const view = await renderOverlay(<BossProfitCalculatorScreen />)
    await importSelected(view)
    const now = new Date()
    const 비율 = { bossKey: 'kaling', difficulty: 'normal' as const, partySize: 3, shares: { myShare: 2, sharesTotal: 5, splitFeePercent: null } }
    const 루시드 = bossPayoutMeso({ bossKey: 'lucid', difficulty: 'hard', partySize: 1, shares: EVEN }, now, NORMAL_FEE)
    const 다이아 = bossPayoutMeso(비율, now, 3)

    expect(formatMesoUnits(다이아)).not.toBe(formatMesoUnits(bossPayoutMeso(비율, now, NORMAL_FEE)))
    expect(view.getByTestId('calculator-boss-payout-kaling').props.children).toBe(formatMesoUnits(다이아))
    expect(view.getByTestId('calculator-character-total').props.children).toBe(formatMesoUnits(루시드 + 다이아))

    await press(view.getByLabelText('카링 파티 인원과 비율 변경'))
    const modal = view.getByTestId('party-size-modal')
    expect(within(modal).getByLabelText('MVP 다이아')).toBeTruthy()
    expect(within(modal).getByText('3%')).toBeTruthy()
    await press(within(modal).getByTestId('party-size-modal-apply'))

    const 카링 = useBossProfitCalculatorStore.getState().bossesByOcid['ocid-1']?.find((boss) => boss.bossKey === 'kaling')
    expect(카링?.shares).toEqual({ myShare: 2, sharesTotal: 5, splitFeePercent: null })
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
