jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn(), replaceMvpGradeHistory: jest.fn() }))
jest.mock('../../../storage/mvp-grade-prefs', () => ({
  getMvpWeeklyCheckOff: jest.fn(),
  getMvpLastCheckedWeek: jest.fn(),
  getMvpBulkApplyAsked: jest.fn(),
  setMvpWeeklyCheckOff: jest.fn(),
  setMvpLastCheckedWeek: jest.fn(),
  setMvpBulkApplyAsked: jest.fn(),
}))
jest.mock('../../../storage/income', () => ({ getBulkFeeIncomeRecords: jest.fn() }))
jest.mock('../../../storage/boss-drops', () => ({ getBulkFeeDropRecords: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/character-profiles', () => ({ getCharacterProfiles: jest.fn() }))
jest.mock('../character-list', () => ({ fetchAndRecordCharacterList: jest.fn() }))
jest.mock('../bulk-apply', () => ({ applyFeesToPastRecords: jest.fn() }))
jest.mock('../recalculate-fees', () => ({ recalculateAutoFees: jest.fn() }))
jest.mock('../store', () => ({ useMvpGradeStore: { getState: () => ({ reload: mockReload }) } }))
jest.mock('../../toast/store', () => ({ useToastStore: { getState: () => ({ showSuccess: mockShowSuccess }) } }))

var mockReload: jest.Mock
var mockShowSuccess: jest.Mock
mockReload = jest.fn()
mockShowSuccess = jest.fn()

import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getCharacterAccountSightings } from '../../../storage/character-accounts'
import { getMvpGradeHistories, replaceMvpGradeHistory } from '../../../storage/mvp-grades'
import * as prefs from '../../../storage/mvp-grade-prefs'
import { getBulkFeeIncomeRecords } from '../../../storage/income'
import { getBulkFeeDropRecords } from '../../../storage/boss-drops'
import { getAuthConfig } from '../../../storage/api-key'
import { getCharacterProfiles } from '../../../storage/character-profiles'
import { fetchAndRecordCharacterList } from '../character-list'
import { applyFeesToPastRecords } from '../bulk-apply'
import { recalculateAutoFees } from '../recalculate-fees'
import { useMvpAskStore } from '../flow-store'

const m = (fn: unknown) => fn as jest.Mock
// 2026-09-22(화) 는 9/17 주다
const NOW = new Date('2026-09-22T03:00:00Z')

beforeEach(() => {
  jest.clearAllMocks()
  useMvpAskStore.setState({ ask: null, accounts: [] })
  m(getTrackedCharacterOcids).mockResolvedValue(['a1'])
  m(getCharacterAccountSightings).mockResolvedValue([
    { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
  ])
  m(getMvpGradeHistories).mockResolvedValue(new Map())
  m(prefs.getMvpWeeklyCheckOff).mockResolvedValue(false)
  m(prefs.getMvpLastCheckedWeek).mockResolvedValue(null)
  m(prefs.getMvpBulkApplyAsked).mockResolvedValue(false)
  m(getBulkFeeIncomeRecords).mockResolvedValue([{ id: 'x' }])
  m(getBulkFeeDropRecords).mockResolvedValue([])
  m(getAuthConfig).mockResolvedValue({ apiKey: 'key' })
  m(fetchAndRecordCharacterList).mockResolvedValue([
    { accountId: 'A', characters: [{ ocid: 'a1', name: '에이', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
  ])
  m(getCharacterProfiles).mockResolvedValue(new Map())
  m(recalculateAutoFees).mockResolvedValue(0)
})

describe('evaluate', () => {
  it('처음이면 추적 캐릭터의 ID 로 고르기를 열고 ID 표시를 채운다', async () => {
    await useMvpAskStore.getState().evaluate(NOW)

    const { ask, accounts } = useMvpAskStore.getState()
    expect(ask).toEqual({ kind: 'select', accountIds: ['A'], bulk: true })
    expect(accounts[0]).toMatchObject({ accountId: 'A', currentGrade: null })
    expect(accounts[0].summary?.representative.name).toBe('에이')
  })

  it('물을 것이 없으면 모달을 안 연다', async () => {
    m(getMvpGradeHistories).mockResolvedValue(new Map([['A', [{ startDate: '2026-09-10', grade: 'gold' }]]]))
    m(prefs.getMvpLastCheckedWeek).mockResolvedValue('2026-09-17')

    await useMvpAskStore.getState().evaluate(NOW)

    expect(useMvpAskStore.getState().ask).toBeNull()
    expect(fetchAndRecordCharacterList).not.toHaveBeenCalled()
  })
})

describe('evaluate 가드', () => {
  it('저장된 직접 바꾸기 값을 함께 준다. 새 ID 흐름이 그 체크박스를 끄지 않게', async () => {
    m(getMvpGradeHistories).mockResolvedValue(new Map([['B', [{ startDate: '2026-09-10', grade: 'gold' }]]]))
    m(getTrackedCharacterOcids).mockResolvedValue(['a1', 'b1'])
    m(getCharacterAccountSightings).mockResolvedValue([
      { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
      { ocid: 'b1', name: '비', accountId: 'B', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
    ])
    m(prefs.getMvpWeeklyCheckOff).mockResolvedValue(true)

    await useMvpAskStore.getState().evaluate(NOW)

    expect(useMvpAskStore.getState().ask?.kind).toBe('newId')
    expect(useMvpAskStore.getState().weeklyOff).toBe(true)
  })

  it('모달이 떠 있으면 다시 안 잰다', async () => {
    const ask = { kind: 'select' as const, accountIds: ['A'], bulk: false }
    useMvpAskStore.setState({ ask })

    await useMvpAskStore.getState().evaluate(NOW)

    expect(getTrackedCharacterOcids).not.toHaveBeenCalled()
    expect(useMvpAskStore.getState().ask).toBe(ask)
  })

  it('겹쳐 불러도 목록은 한 번만 받는다', async () => {
    await Promise.all([useMvpAskStore.getState().evaluate(NOW), useMvpAskStore.getState().evaluate(NOW)])

    expect(fetchAndRecordCharacterList).toHaveBeenCalledTimes(1)
  })
})

describe('complete', () => {
  it('고른 등급을 그 주부터 적고, 이번 주를 확인한 주로 남긴다', async () => {
    await useMvpAskStore.getState().evaluate(NOW)

    await useMvpAskStore.getState().complete(
      { choices: [{ accountId: 'A', grade: 'diamond', startWeek: '2026-09-10', changed: true }], weeklyOff: false, bulkApply: false },
      NOW,
    )

    expect(replaceMvpGradeHistory).toHaveBeenCalledWith('A', [{ startDate: '2026-09-10', grade: 'diamond' }], NOW.toISOString())
    expect(prefs.setMvpLastCheckedWeek).toHaveBeenCalledWith('2026-09-17')
    expect(prefs.setMvpBulkApplyAsked).toHaveBeenCalled()
    expect(applyFeesToPastRecords).not.toHaveBeenCalled()
    expect(mockReload).toHaveBeenCalled()
    expect(useMvpAskStore.getState().ask).toBeNull()
  })

  it('일괄 적용을 켰으면 지난 기록에 수수료를 붙인다', async () => {
    await useMvpAskStore.getState().evaluate(NOW)

    await useMvpAskStore.getState().complete(
      { choices: [{ accountId: 'A', grade: 'silver', startWeek: '2026-09-17', changed: true }], weeklyOff: true, bulkApply: true },
      NOW,
    )

    expect(applyFeesToPastRecords).toHaveBeenCalled()
    expect(prefs.setMvpWeeklyCheckOff).toHaveBeenCalledWith(true)
  })

  it('주간 확인에서 안 바꾼 ID 는 이력을 안 건드린다', async () => {
    m(getMvpGradeHistories).mockResolvedValue(new Map([['A', [{ startDate: '2026-09-10', grade: 'gold' }]]]))
    m(prefs.getMvpLastCheckedWeek).mockResolvedValue('2026-09-10')
    await useMvpAskStore.getState().evaluate(NOW)
    expect(useMvpAskStore.getState().ask).toEqual({ kind: 'weekly', accountIds: ['A'] })

    await useMvpAskStore.getState().complete(
      { choices: [{ accountId: 'A', grade: 'gold', startWeek: '2026-09-17', changed: false }], weeklyOff: false, bulkApply: false },
      NOW,
    )

    expect(replaceMvpGradeHistory).not.toHaveBeenCalled()
    expect(prefs.setMvpLastCheckedWeek).toHaveBeenCalledWith('2026-09-17')
  })

  it('지난 기록이 없어 체크박스가 안 섰어도 첫 흐름을 마치면 다시 안 묻는다', async () => {
    m(getBulkFeeIncomeRecords).mockResolvedValue([])
    await useMvpAskStore.getState().evaluate(NOW)
    expect(useMvpAskStore.getState().ask).toMatchObject({ bulk: false })

    await useMvpAskStore.getState().complete(
      { choices: [{ accountId: 'A', grade: 'normal', startWeek: '2026-09-17', changed: true }], weeklyOff: false, bulkApply: false },
      NOW,
    )

    expect(prefs.setMvpBulkApplyAsked).toHaveBeenCalled()
  })

  it('다시 계산해 요율이 달라진 기록이 있으면 토스트로 알린다', async () => {
    m(recalculateAutoFees).mockResolvedValue(12)
    await useMvpAskStore.getState().evaluate(NOW)

    await useMvpAskStore.getState().complete(
      { choices: [{ accountId: 'A', grade: 'diamond', startWeek: '2026-09-17', changed: true }], weeklyOff: false, bulkApply: false },
      NOW,
    )

    expect(mockShowSuccess).toHaveBeenCalledWith('자동 수수료 기록 12건을 다시 계산했어요')
  })
})
