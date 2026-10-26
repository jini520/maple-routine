import { installFakePreferences } from './fake-preferences'
import { getPartyAppointments } from '../party-appointments'
import { STORAGE_KEYS } from '../keys'
import type { PartyAppointment } from '../../types/party-appointment'

const LIMBO: PartyAppointment = {
  id: '3f2b6c1e-8d4a-4c2f-9b1e-5a7d0c9e2f41',
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

// 약속 id 는 uuid 다. 옛 설치본의 `시각 + 난수` id 는 Preferences 에 있어 SQLite 이관이 안 닿으므로 읽을 때 바꾼다.
describe('옛 약속 id', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('uuid 가 아닌 id 는 uuid 로 바꿔 다시 저장하고, 다른 칸은 그대로다', async () => {
    await prefs.set(STORAGE_KEYS.partyAppointments, JSON.stringify([{ ...LIMBO, id: 'mg1abc-x1y2z3' }]))

    const [read] = await getPartyAppointments()

    expect(read?.id).toMatch(UUID)
    expect({ ...read, id: LIMBO.id }).toEqual(LIMBO)
    expect(JSON.parse((await prefs.get(STORAGE_KEYS.partyAppointments)) ?? '[]')).toEqual([read])
    expect((await getPartyAppointments())[0]?.id).toBe(read?.id)
  })

  it('uuid 약속만 있으면 다시 쓰지 않는다', async () => {
    const raw = JSON.stringify([LIMBO])
    await prefs.set(STORAGE_KEYS.partyAppointments, raw)
    prefs.set.mockClear()

    await getPartyAppointments()

    expect(prefs.set).not.toHaveBeenCalled()
  })
})
