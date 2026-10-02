// 지금 뒤에 시작하는 회차를 시각 순으로. today 의 다음 파티 스케줄 위젯이 쓴다.
import { upcomingOccurrences } from '../upcoming'
import type { PartyAppointment } from '../../../types/party-appointment'

function appointment(id: string, schedule: PartyAppointment['schedule'], timeKst = '21:00'): PartyAppointment {
  return {
    id,
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst,
    durationMinutes: 30,
    leadMinutes: 10,
    schedule,
    exceptions: {},
  }
}

// 2026-10-07(수) 19:00 KST
const NOW = new Date('2026-10-07T10:00:00Z')

describe('upcomingOccurrences', () => {
  it('지금 뒤에 시작하는 회차를 시각 순으로 낸다', () => {
    const items = upcomingOccurrences(
      [appointment('b', { type: 'once', dateKey: '2026-10-08' }), appointment('a', { type: 'once', dateKey: '2026-10-07' })],
      NOW,
    )

    expect(items.map((item) => item.appointment.id)).toEqual(['a', 'b'])
  })

  // 시작하면 다음으로 넘어간다(사용자 결정).
  it('이미 시작한 회차는 뺀다', () => {
    const items = upcomingOccurrences([appointment('a', { type: 'once', dateKey: '2026-10-07' }, '18:30')], NOW)

    expect(items).toEqual([])
  })

  // 리셋 주와 상관없이 가장 가까운 것을 찾는다(사용자 결정).
  it('한참 뒤의 한 번 약속도 찾는다', () => {
    const items = upcomingOccurrences([appointment('far', { type: 'once', dateKey: '2027-01-20' })], NOW)

    expect(items.map((item) => item.dateKey)).toEqual(['2027-01-20'])
  })

  it('반복 약속은 앞으로의 회차를 개수만큼 낸다', () => {
    const weekly = appointment('w', { type: 'weekly', weekday: 4, fromWeek: '2026-10-01', untilWeek: null })

    expect(upcomingOccurrences([weekly], NOW, 3).map((item) => item.dateKey)).toEqual([
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
    ])
  })

  it('약속이 없으면 빈 목록이다', () => {
    expect(upcomingOccurrences([], NOW)).toEqual([])
  })
})
