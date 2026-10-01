import { notificationText } from '../notification-text'
import { occurrencesInWeek } from '../occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'

const LIMBO = { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }
const BARDRIX = { bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-1' }
const JUPITER = { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' }

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [LIMBO],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: 10,
    schedule: { type: 'once', dateKey: '2026-10-01' },
    exceptions: {},
    ...overrides,
  }
}

/** 2026-10-01(목) 하루짜리 약속의 그 회차 */
function only(one: PartyAppointment) {
  return occurrencesInWeek([one], '2026-10-01')[0]!
}

const NAMES = new Map([
  ['ocid-1', '낟낟'],
  ['ocid-2', '낟넘'],
])

it('보스 하나 · 캐릭터 하나', () => {
  expect(notificationText(only(appointment({})), NAMES)).toEqual({
    title: '낟낟 파티 보스 스케줄이 곧 시작해요',
    body: '21:00 낟낟 하드 림보 파티 10분 전이에요',
  })
})

it('보스가 여럿이면 첫 보스를 적고 나머지를 외 n마리로 접는다', () => {
  const text = notificationText(only(appointment({ bosses: [LIMBO, BARDRIX] })), NAMES)

  expect(text.body).toBe('21:00 낟낟 하드 림보 외 1마리 파티 10분 전이에요')
  expect(text.title).toBe('낟낟 파티 보스 스케줄이 곧 시작해요')
})

it('캐릭터가 여럿이면 제목은 첫 캐릭터 외 n캐릭터다', () => {
  const text = notificationText(only(appointment({ bosses: [LIMBO, JUPITER, BARDRIX] })), NAMES)

  expect(text.title).toBe('낟낟 외 1캐릭터 파티 보스 스케줄이 곧 시작해요')
  expect(text.body).toBe('21:00 낟낟 하드 림보 외 2마리 파티 10분 전이에요')
})

it('정각이면 파티가 지금 시작해요', () => {
  const text = notificationText(only(appointment({ leadMinutes: 0, bosses: [LIMBO, BARDRIX, JUPITER] })), NAMES)

  expect(text.body).toBe('21:00 낟낟 하드 림보 외 2마리 파티가 지금 시작해요')
})

it('60 의 배수는 시간으로 적는다', () => {
  expect(notificationText(only(appointment({ leadMinutes: 75 })), NAMES).body).toBe(
    '21:00 낟낟 하드 림보 파티 1시간 15분 전이에요',
  )
})
