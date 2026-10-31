import { occurrencesInWeek } from '../occurrences'
import { occurrenceKeyOf, weekTimeline } from '../timeline'
import type { PartyAppointment } from '../../../types/party-appointment'

const LIMBO = { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }

function once(id: string, dateKey: string, timeKst: string, durationMinutes: number): PartyAppointment {
  return {
    id,
    bosses: [LIMBO],
    members: [],
    timeKst,
    durationMinutes,
    leadMinutes: null,
    schedule: { type: 'once', dateKey },
    exceptions: {},
  }
}

// 2026-10-22 는 목요일이고 그 리셋 주의 시작이다. 지금은 토요일 10/24 18:40(KST).
const WEEK = '2026-10-22'
const NOW = new Date('2026-10-24T18:40:00+09:00').getTime()

function timelineOf(appointments: PartyAppointment[], accentKeys: ReadonlySet<string> = new Set()) {
  return weekTimeline(occurrencesInWeek(appointments, WEEK), WEEK, NOW, accentKeys)
}

describe('weekTimeline', () => {
  it('회차가 없어도 목요일부터 수요일까지 일곱 줄이다', () => {
    expect(timelineOf([]).map((day) => day.dateKey)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ])
  })

  it('막대 자리는 그 날 0시부터 24시까지의 비율이다', () => {
    const [, , saturday] = timelineOf([once('a', '2026-10-24', '21:00', 90)])

    expect(saturday!.segments).toEqual([expect.objectContaining({ from: 21 / 24, to: 22.5 / 24 })])
  })

  it('자정을 넘는 회차는 24시에서 자르고 남은 부분을 다음 날 줄 맨 앞에 잇는다', () => {
    const days = timelineOf([once('a', '2026-10-24', '23:30', 40)])

    expect(days[2]!.segments).toEqual([expect.objectContaining({ from: 23.5 / 24, to: 1 })])
    expect(days[3]!.segments).toEqual([expect.objectContaining({ from: 0, to: 10 / 60 / 24 })])
  })

  it('수요일에서 자정을 넘는 부분은 다음 주 몫이라 그리지 않는다', () => {
    const days = timelineOf([once('a', '2026-10-28', '23:30', 40)])

    expect(days.flatMap((day) => day.segments)).toHaveLength(1)
  })

  it('칠할 회차만 주황 톤이고, 끝난 회차는 끝난 톤이다', () => {
    const ended = once('e', '2026-10-22', '21:00', 50)
    const next = once('n', '2026-10-24', '21:00', 90)
    const later = once('l', '2026-10-24', '23:30', 40)
    const [occurrence] = occurrencesInWeek([next], WEEK)

    const tones = timelineOf([ended, next, later], new Set([occurrenceKeyOf(occurrence!)]))
      .flatMap((day) => day.segments)
      .map((segment) => `${segment.key}:${segment.tone}`)

    expect(tones).toEqual(['e:2026-10-22:ended', 'n:2026-10-24:accent', 'l:2026-10-24:normal', 'l:2026-10-24:normal'])
  })

  it('겹친 회차는 칠할 열쇠에 든 만큼 모두 주황 톤이다', () => {
    const first = once('a', '2026-10-24', '18:00', 90)
    const second = once('b', '2026-10-24', '18:30', 90)
    const keys = occurrencesInWeek([first, second], WEEK).map(occurrenceKeyOf)

    const tones = timelineOf([first, second], new Set(keys))
      .flatMap((day) => day.segments)
      .map((segment) => segment.tone)

    expect(tones).toEqual(['accent', 'accent'])
  })

  it('지금 선은 오늘 줄에만 있다', () => {
    const nowAt = timelineOf([]).map((day) => day.nowAt)

    expect(nowAt).toEqual([null, null, (18 + 40 / 60) / 24, null, null, null, null])
  })

  it('지난 주나 다음 주를 보면 지금 선이 없다', () => {
    const days = weekTimeline([], '2026-10-29', NOW, new Set())

    expect(days.every((day) => day.nowAt === null)).toBe(true)
  })
})
