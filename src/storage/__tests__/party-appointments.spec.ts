import { installFakePreferences } from './fake-preferences'
import { getPartyAppointments } from '../party-appointments'
import type { PartyAppointment } from '../../types/party-appointment'

const LIMBO: PartyAppointment = {
  id: 'a1',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  members: [{ type: 'text', name: '친구1' }, { type: 'character', ocid: 'ocid-2' }],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-24', untilWeek: null },
  exceptions: {
    '2026-10-01': {
      type: 'override',
      dateKey: '2026-10-01',
      timeKst: '22:00',
      durationMinutes: 60,
      bosses: [{ bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-1' }],
      leadMinutes: null,
    },
  },
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

it('깨진 JSON 이면 빈 목록이다', async () => {
  await prefs.set('partyAppointments', '{not json')

  expect(await getPartyAppointments()).toEqual([])
})

it('모양이 틀린 항목은 그 항목만 버린다', async () => {
  const broken = { ...LIMBO, id: 'a2', timeKst: 2100 }
  const noSchedule = { ...LIMBO, id: 'a3', schedule: { type: 'monthly' } }
  const noBosses = { ...LIMBO, id: 'a4', bosses: [] }
  const brokenBoss = { ...LIMBO, id: 'a5', bosses: [{ bossKey: 'limbo', difficulty: 'hard' }] }
  const noDuration = { ...LIMBO, id: 'a6', durationMinutes: 0 }
  const oldShape = { ...LIMBO, id: 'a7', bosses: undefined, bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }
  // 걷어 낸 옛 예외(건너뛰기 · 날짜만 옮기기)는 모양이 틀린 것으로 본다.
  const memoNotText = { ...LIMBO, id: 'a9', memo: 42 }
  const moveWithoutDuration = {
    ...LIMBO,
    id: 'a8',
    exceptions: { '2026-10-01': { type: 'skip' } },
  }
  await prefs.set(
    'partyAppointments',
    JSON.stringify([LIMBO, broken, noSchedule, noBosses, brokenBoss, noDuration, oldShape, moveWithoutDuration, memoNotText]),
  )

  expect(await getPartyAppointments()).toEqual([LIMBO])
})

it('메모가 있는 항목은 메모째 읽는다', async () => {
  const withMemo = { ...LIMBO, memo: '2번 방\n세렌 확인' }
  await prefs.set('partyAppointments', JSON.stringify([withMemo]))

  expect(await getPartyAppointments()).toEqual([withMemo])
})
