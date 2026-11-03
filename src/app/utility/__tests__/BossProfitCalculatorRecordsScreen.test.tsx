// 계산 기록. 기록을 열면 계산기로 돌아가고, 지우면 목록에서 빠진다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useBossProfitCalculatorStore } from '../../../features/boss-profit-calculator/store'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { getBossProfitCalculatorRecords, setBossProfitCalculatorRecords, type BossProfitCalculatorRecord } from '../../../storage/boss-profit-calculator-records'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { BossProfitCalculatorRecordsScreen } from '../BossProfitCalculatorRecordsScreen'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
// 캐릭터는 쿼리 캐시에서 온다. 기록 줄의 이름을 보는 테스트만 채우고 나머지는 추적 캐릭터가 없는 상태로 둔다.
const mockCharacters: { ocid: string; characterName: string; imageUrl: string }[] = []
jest.mock('../../../features/boss-scheduler/use-boss-schedule', () => ({
  useBossSchedule: () => ({ status: 'loaded', characters: mockCharacters, error: null, trackedOcids: [], refresh: jest.fn() }),
}))

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const goBack = jest.fn()

// 2026-10-20 14:32 KST 와 2026-10-19 23:10 KST
const 새것: BossProfitCalculatorRecord = {
  id: 'new',
  savedAt: '2026-10-20T05:32:00.000Z',
  characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 1, shares: EVEN }] }],
}
const 옛것: BossProfitCalculatorRecord = { id: 'old', savedAt: '2026-10-19T14:10:00.000Z', characters: [{ ocid: 'ocid-1', bosses: [] }] }
const 둘이서: BossProfitCalculatorRecord = {
  id: 'pair',
  savedAt: '2026-10-18T03:00:00.000Z',
  characters: [
    { ocid: 'ocid-1', bosses: [] },
    { ocid: 'ocid-2', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 1, shares: EVEN }] },
  ],
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

beforeEach(async () => {
  installFakePreferences()
  installNoopNativePorts()
  jest.mocked(useScreenNavigation).mockReturnValue({ goBack } as unknown as ReturnType<typeof useScreenNavigation>)
  goBack.mockClear()
  mockCharacters.length = 0
  await setBossProfitCalculatorRecords([새것, 옛것])
  useBossProfitCalculatorStore.setState({ loaded: true, records: [새것, 옛것], openedId: 'new', bossesByOcid: {} })
})

describe('BossProfitCalculatorRecordsScreen', () => {
  it('제목은 저장한 날짜와 시간이고, 연 기록에 열려 있음이 붙는다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorRecordsScreen />)

    expect(view.getByText('10월 20일 (화)')).toBeTruthy()
    expect(view.getByText('14:32')).toBeTruthy()
    expect(view.getByText('10월 19일 (월)')).toBeTruthy()
    expect(view.getAllByText('열려 있음')).toHaveLength(1)
  })

  // 기록 하나에 캐릭터가 여럿이면 날짜와 금액 사이에 얼굴을 늘어놓을 폭이 모자란다. 글자 한 줄만 둔다.
  it('기록 줄은 첫 캐릭터 이름 외 n 이고, 얼굴과 보스 수는 없다', async () => {
    mockCharacters.push(
      { ocid: 'ocid-1', characterName: '아무개', imageUrl: 'https://example.test/a.png' },
      { ocid: 'ocid-2', characterName: '둘째', imageUrl: 'https://example.test/b.png' },
    )
    useBossProfitCalculatorStore.setState({ records: [새것, 옛것, 둘이서] })
    const view = await renderOverlay(<BossProfitCalculatorRecordsScreen />)

    expect(view.getByText('아무개 외 1')).toBeTruthy()
    expect(view.getAllByText('아무개')).toHaveLength(2)
    expect(view.queryByLabelText('아무개')).toBeNull()
    expect(view.queryByText(/^보스 \d+$/)).toBeNull()
  })

  it('기록을 누르면 그 기록을 열고 계산기로 돌아간다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorRecordsScreen />)

    await press(view.getByLabelText('10월 19일 (월) 23:10 기록 열기'))

    expect(useBossProfitCalculatorStore.getState().openedId).toBe('old')
    expect(goBack).toHaveBeenCalled()
  })

  it('지우면 목록과 저장소에서 빠진다', async () => {
    const view = await renderOverlay(<BossProfitCalculatorRecordsScreen />)

    await press(view.getByLabelText('10월 19일 (월) 23:10 기록 지우기'))

    expect(view.queryByText('10월 19일 (월)')).toBeNull()
    expect((await getBossProfitCalculatorRecords()).map((one) => one.id)).toEqual(['new'])
  })
})
