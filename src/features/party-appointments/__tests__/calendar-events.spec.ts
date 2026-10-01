import { isNextDayPiece, toCalendarEvents } from '../calendar-events'
import { occurrencesInWeek } from '../occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'

const LIMBO: PartyAppointment = {
  id: 'a1',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  members: [{ type: 'text', name: '친구1' }, { type: 'character', ocid: 'ocid-2' }],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'weekly', weekday: 2, fromWeek: '2026-09-17', untilWeek: null },
  exceptions: {},
}

const BUNDLE: PartyAppointment = {
  ...LIMBO,
  id: 'b1',
  bosses: [
    { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' },
    { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' },
    { bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-1' },
  ],
  leadMinutes: null,
  schedule: { type: 'once', dateKey: '2026-09-29' },
}

const NAMES = new Map([
  ['ocid-1', '낟낟'],
  ['ocid-2', '뭉치'],
])

const WEEK = '2026-09-24'

it('회차 하나가 시작부터 종료까지의 이벤트 하나가 된다', () => {
  const [event] = toCalendarEvents(occurrencesInWeek([LIMBO], WEEK), NAMES)

  expect(event.start.toISOString()).toBe('2026-09-29T12:00:00.000Z')
  expect(event.end.toISOString()).toBe('2026-09-29T12:30:00.000Z')
})

it('보스 하나짜리는 캐릭터 한 묶음에 보스 한 줄이다', () => {
  const [event] = toCalendarEvents(occurrencesInWeek([LIMBO], WEEK), NAMES)

  expect(event).toMatchObject({
    id: 'a1:2026-09-29',
    title: '림보',
    bundle: false,
    groups: [{ ocid: 'ocid-1', characterName: '낟낟', bosses: [{ name: '림보', difficultyLabel: '하드' }] }],
    members: ['친구1', '뭉치'],
    timeKst: '21:00',
    hasAlarm: true,
    repeats: true,
  })
})

it('묶음은 캐릭터가 처음 나온 차례로 묶고 묶음 안은 도는 차례다', () => {
  const [event] = toCalendarEvents(occurrencesInWeek([BUNDLE], WEEK), NAMES)

  expect(event.bundle).toBe(true)
  expect(event.groups).toEqual([
    {
      ocid: 'ocid-1',
      characterName: '낟낟',
      bosses: [
        { name: '림보', difficultyLabel: '하드' },
        { name: '발드릭스', difficultyLabel: '하드' },
      ],
    },
    { ocid: 'ocid-2', characterName: '뭉치', bosses: [{ name: '유피테르', difficultyLabel: '노멀' }] },
  ])
  expect(event.hasAlarm).toBe(false)
  expect(event.repeats).toBe(false)
})

it('추적을 풀어 이름을 못 찾는 내 캐릭터 파티원은 뺀다', () => {
  const [event] = toCalendarEvents(occurrencesInWeek([LIMBO], WEEK), new Map([['ocid-1', '낟낟']]))

  expect(event.members).toEqual(['친구1'])
})

describe('isNextDayPiece', () => {
  it('0분에서 시작하는 조각은 약속이 0시에 시작하지 않으면 다음 날 조각이다', () => {
    expect(isNextDayPiece(0, '23:30')).toBe(true)
  })

  it('약속 자체가 0시에 시작하면 첫 조각이다', () => {
    expect(isNextDayPiece(0, '00:00')).toBe(false)
  })

  it('0분이 아닌 조각은 첫 조각이다', () => {
    expect(isNextDayPiece(23 * 60 + 30, '23:30')).toBe(false)
  })

  it('조각의 시작 분을 모르면 첫 조각으로 본다', () => {
    expect(isNextDayPiece(undefined, '23:30')).toBe(false)
  })
})
