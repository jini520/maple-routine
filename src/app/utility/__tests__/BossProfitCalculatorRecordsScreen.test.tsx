// 계산 기록. 기록을 열면 계산기로 돌아가고, 지우면 목록에서 빠진다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useBossProfitCalculatorStore } from '../../../features/boss-profit-calculator/store'
import { useBossSchedulerStore } from '../../../features/boss-scheduler/store'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { installNoopNativePorts } from '../../../native/__tests__/fake-native-ports'
import { getBossProfitCalculatorRecords, setBossProfitCalculatorRecords, type BossProfitCalculatorRecord } from '../../../storage/boss-profit-calculator-records'
import { installFakePreferences } from '../../../storage/__tests__/fake-preferences'
import { BossProfitCalculatorRecordsScreen } from '../BossProfitCalculatorRecordsScreen'

jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))

const EVEN = { myShare: null, sharesTotal: null, splitFeePercent: null }
const goBack = jest.fn()

// 2026-10-20 14:32 KST 와 2026-10-19 23:10 KST
const 새것: BossProfitCalculatorRecord = {
  id: 'new',
  savedAt: '2026-10-20T05:32:00.000Z',
  characters: [{ ocid: 'ocid-1', bosses: [{ bossKey: 'kaling', difficulty: 'normal', partySize: 1, shares: EVEN }] }],
}
const 옛것: BossProfitCalculatorRecord = { id: 'old', savedAt: '2026-10-19T14:10:00.000Z', characters: [{ ocid: 'ocid-1', bosses: [] }] }

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
  useBossSchedulerStore.setState({ characters: [] })
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
