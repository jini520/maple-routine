import { decideMvpAsk, type MvpAskInput } from '../ask'

const base: MvpAskInput = {
  trackedAccountIds: ['A', 'B'],
  historyAccountIds: new Set(),
  weeklyOff: false,
  lastCheckedWeek: null,
  thisWeek: '2026-09-17',
  bulkAsked: false,
  hasPastRecords: false,
}

describe('decideMvpAsk', () => {
  it('처음이면 추적 캐릭터가 속한 ID 전부로 고르기를 연다', () => {
    expect(decideMvpAsk(base)).toEqual({ kind: 'select', accountIds: ['A', 'B'], bulk: false })
  })

  it('지난 기록이 있는 기존 사용자면 일괄 적용 체크박스가 선다', () => {
    expect(decideMvpAsk({ ...base, hasPastRecords: true })).toEqual({ kind: 'select', accountIds: ['A', 'B'], bulk: true })
  })

  it('한 번 물었으면 일괄 적용을 다시 안 묻는다', () => {
    expect(decideMvpAsk({ ...base, hasPastRecords: true, bulkAsked: true })).toMatchObject({ bulk: false })
  })

  it('이력이 있는 ID 가 있고 새 ID 만 비면 그 ID 하나만 묻는다', () => {
    expect(decideMvpAsk({ ...base, historyAccountIds: new Set(['A']) })).toEqual({ kind: 'newId', accountIds: ['B'], bulk: false })
  })

  it('모두 이력이 있으면 주가 바뀐 뒤에 주간 확인을 연다', () => {
    const all = { ...base, historyAccountIds: new Set(['A', 'B']) }
    expect(decideMvpAsk({ ...all, lastCheckedWeek: '2026-09-10' })).toEqual({ kind: 'weekly', accountIds: ['A', 'B'] })
    expect(decideMvpAsk({ ...all, lastCheckedWeek: '2026-09-17' })).toBeNull()
  })

  it('주간 확인을 끈 사용자에게는 안 묻는다', () => {
    const all = { ...base, historyAccountIds: new Set(['A', 'B']), weeklyOff: true, lastCheckedWeek: '2026-09-10' }
    expect(decideMvpAsk(all)).toBeNull()
  })

  it('추적 캐릭터의 소속을 아직 모르면 묻지 않는다', () => {
    expect(decideMvpAsk({ ...base, trackedAccountIds: [] })).toBeNull()
  })
})
