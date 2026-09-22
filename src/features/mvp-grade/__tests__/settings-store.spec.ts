jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
jest.mock('../../../storage/character-accounts', () => ({ getCharacterAccountSightings: jest.fn() }))
jest.mock('../../../storage/mvp-grades', () => ({ getMvpGradeHistories: jest.fn(), replaceMvpGradeHistory: jest.fn() }))
jest.mock('../../../storage/mvp-grade-prefs', () => ({ getMvpWeeklyCheckOff: jest.fn(), setMvpWeeklyCheckOff: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/character-profiles', () => ({ getCharacterProfiles: jest.fn() }))
jest.mock('../character-list', () => ({ fetchAndRecordCharacterList: jest.fn() }))
jest.mock('../recalculate-fees', () => ({ recalculateAutoFees: jest.fn() }))
jest.mock('../store', () => ({ useMvpGradeStore: { getState: () => ({ reload: mockReload }) } }))
jest.mock('../../toast/store', () => ({
  useToastStore: { getState: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }) },
}))

var mockReload: jest.Mock
var mockShowSuccess: jest.Mock
var mockShowError: jest.Mock
mockReload = jest.fn()
mockShowSuccess = jest.fn()
mockShowError = jest.fn()

import { getTrackedCharacterOcids } from '../../../storage/character-selection'
import { getCharacterAccountSightings } from '../../../storage/character-accounts'
import { getMvpGradeHistories, replaceMvpGradeHistory } from '../../../storage/mvp-grades'
import { getMvpWeeklyCheckOff, setMvpWeeklyCheckOff } from '../../../storage/mvp-grade-prefs'
import { getAuthConfig } from '../../../storage/api-key'
import { getCharacterProfiles } from '../../../storage/character-profiles'
import { fetchAndRecordCharacterList } from '../character-list'
import { recalculateAutoFees } from '../recalculate-fees'
import { useMvpGradeSettingsStore } from '../settings-store'

const m = (fn: unknown) => fn as jest.Mock
const NOW = new Date('2026-09-22T03:00:00Z')

beforeEach(() => {
  jest.clearAllMocks()
  useMvpGradeSettingsStore.setState({ status: 'idle', accounts: [], weeklyOff: false })
  m(getTrackedCharacterOcids).mockResolvedValue(['a1'])
  m(getCharacterAccountSightings).mockResolvedValue([
    { ocid: 'a1', name: '에이', accountId: 'A', firstSeenOn: '2026-09-01', lastSeenOn: '2026-09-22' },
  ])
  m(getMvpGradeHistories).mockResolvedValue(
    new Map([
      ['A', [{ startDate: '2026-09-17', grade: 'diamond' }]],
      ['B', [{ startDate: '2026-01-01', grade: 'gold' }]],
    ]),
  )
  m(getMvpWeeklyCheckOff).mockResolvedValue(true)
  m(getAuthConfig).mockResolvedValue({ apiKey: 'key' })
  m(fetchAndRecordCharacterList).mockResolvedValue([
    { accountId: 'A', characters: [{ ocid: 'a1', name: '에이', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] },
  ])
  m(getCharacterProfiles).mockResolvedValue(new Map())
  m(recalculateAutoFees).mockResolvedValue(0)
})

describe('useMvpGradeSettingsStore', () => {
  it('추적 캐릭터의 ID 가 먼저 서고, 이력만 남은 ID 가 뒤에 선다', async () => {
    await useMvpGradeSettingsStore.getState().load()

    const { status, accounts, weeklyOff } = useMvpGradeSettingsStore.getState()
    expect(status).toBe('ready')
    expect(accounts?.map((account) => account.accountId)).toEqual(['A', 'B'])
    expect(accounts?.[0].summary?.representative.name).toBe('에이')
    expect(accounts?.[1].summary).toBeNull()
    expect(accounts?.[1].history).toEqual([{ startDate: '2026-01-01', grade: 'gold' }])
    expect(weeklyOff).toBe(true)
  })

  it('읽지 못하면 빈 목록이 아니라 실패다', async () => {
    m(getMvpGradeHistories).mockRejectedValue(new Error('db'))

    await useMvpGradeSettingsStore.getState().load()

    expect(useMvpGradeSettingsStore.getState().status).toBe('failed')
  })

  it('이력을 적으면 화면 값을 바꾸고 자동 수수료를 다시 계산해 알린다', async () => {
    await useMvpGradeSettingsStore.getState().load()
    m(recalculateAutoFees).mockResolvedValue(3)
    const next = [{ startDate: '2026-09-10', grade: 'red' as const }]

    await useMvpGradeSettingsStore.getState().saveHistory('A', next, NOW)

    expect(replaceMvpGradeHistory).toHaveBeenCalledWith('A', next, NOW.toISOString())
    expect(useMvpGradeSettingsStore.getState().accounts?.[0].history).toEqual(next)
    expect(mockShowSuccess).toHaveBeenCalledWith('자동 수수료 기록 3건을 다시 계산했어요')
    expect(mockReload).toHaveBeenCalled()
  })

  it('적지 못하면 알리고 화면 값은 그대로 둔다', async () => {
    await useMvpGradeSettingsStore.getState().load()
    m(replaceMvpGradeHistory).mockRejectedValue(new Error('db'))

    await useMvpGradeSettingsStore.getState().saveHistory('A', [], NOW)

    expect(mockShowError).toHaveBeenCalledWith('등급 기록을 저장하지 못했습니다')
    expect(useMvpGradeSettingsStore.getState().accounts[0].history).toEqual([{ startDate: '2026-09-17', grade: 'diamond' }])
    expect(recalculateAutoFees).not.toHaveBeenCalled()
  })

  it('매주 등급 확인 스위치는 저장값의 반대다', async () => {
    await useMvpGradeSettingsStore.getState().setWeeklyCheck(false)

    expect(setMvpWeeklyCheckOff).toHaveBeenCalledWith(true)
    expect(useMvpGradeSettingsStore.getState().weeklyOff).toBe(true)
  })
})
