// 진행 중인 회차와 지금 뒤에 시작하는 회차. today 위젯과 시간표 · 보드가 쓴다.
import { accentOccurrences, runningOccurrences, upcomingOccurrences } from '../upcoming'
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

  // 시작한 회차는 `runningOccurrences` 의 몫이다.
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
})

describe('runningOccurrences', () => {
  const once = (id: string, timeKst: string) => appointment(id, { type: 'once', dateKey: '2026-10-07' }, timeKst)

  // 30분짜리 회차다. 종료 시각에는 이미 끝났고, 시작 시각에는 이미 시작했다.
  it('시작했고 끝나지 않은 회차만 시작 순으로 낸다', () => {
    const items = runningOccurrences(
      [once('later', '19:10'), once('now', '19:00'), once('ended', '18:30'), once('earlier', '18:40')],
      NOW,
    )

    expect(items.map((item) => item.appointment.id)).toEqual(['earlier', 'now'])
  })

  // 2026-10-08 은 목요일이고 새 리셋 주의 첫날이다. 회차는 시작한 주에 속해서 이번 주만 보면 놓친다.
  it('수요일 밤에 시작해 자정을 넘긴 회차는 목요일에도 진행 중이다', () => {
    const items = runningOccurrences([once('overnight', '23:50')], new Date('2026-10-08T00:10:00+09:00'))

    expect(items.map((item) => item.dateKey)).toEqual(['2026-10-07'])
  })
})

describe('accentOccurrences', () => {
  const once = (id: string, timeKst: string) => appointment(id, { type: 'once', dateKey: '2026-10-07' }, timeKst)

  it('진행 중인 회차가 겹치면 전부이고 다음 회차는 빠진다', () => {
    const items = accentOccurrences([once('a', '18:40'), once('b', '18:50'), once('next', '21:00')], NOW)

    expect(items.map((item) => item.appointment.id)).toEqual(['a', 'b'])
  })

  it('진행 중인 회차가 없으면 다음 회차 하나다', () => {
    const items = accentOccurrences([once('later', '22:00'), once('next', '21:00')], NOW)

    expect(items.map((item) => item.appointment.id)).toEqual(['next'])
  })
})
