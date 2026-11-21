import { bossDifficultyIdOf } from '../../lib/boss/bosses'
import { installFakePreferences } from './fake-preferences'
import {
  getPartyAppointments,
  movePartyAppointmentsToOcid,
  setPartyAppointments,
  storedPartyAppointmentOf,
  type StoredPartyAppointment,
} from '../party-appointments'
import { STORAGE_KEYS } from '../keys'
import type { PartyAppointment } from '../../types/party-appointment'

const LIMBO: PartyAppointment = {
  id: '3f2b6c1e-8d4a-4c2f-9b1e-5a7d0c9e2f41',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-09-24', untilWeek: null },
  exceptions: {
    '2026-10-01': {
      dateKey: '2026-10-01',
      timeKst: '22:00',
      durationMinutes: 60,
      bosses: [{ bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-1' }],
      leadMinutes: null,
    },
  },
}

/** `LIMBO` 를 저장한 모양. */
const STORED_LIMBO: StoredPartyAppointment = {
  id: LIMBO.id,
  bosses: [{ bossDifficultyId: bossDifficultyIdOf('limbo', 'hard')!, ocid: 'ocid-1' }],
  time: '21:00',
  durationMinutes: 30,
  alarmMinutesBefore: 10,
  schedule: { type: 'weekly', weekday: 4, fromWeekCode: 'W202639', untilWeekCode: null },
  exceptions: {
    W202640: {
      date: '2026-10-01',
      time: '22:00',
      durationMinutes: 60,
      bosses: [{ bossDifficultyId: bossDifficultyIdOf('bardrix', 'hard')!, ocid: 'ocid-1' }],
      alarmMinutesBefore: null,
    },
  },
}

let prefs = installFakePreferences()

beforeEach(() => {
  prefs = installFakePreferences()
})

// 저장은 서버 `party_appointments` 와 같은 칸 이름이고 화면은 지금 칸 이름 · 목요일 날짜 · 보스 key 를 든다.
it('서버 칸 이름 · 주차 값 · 난이도 줄 id 로 적고 화면이 드는 모양으로 되읽는다', async () => {
  await setPartyAppointments([LIMBO])

  expect(JSON.parse((await prefs.get(STORAGE_KEYS.partyAppointments))!)).toEqual([STORED_LIMBO])
  expect(await getPartyAppointments()).toEqual([LIMBO])
})

// 게임 데이터에서 빠진 보스는 key 로 되돌릴 수 없다. 남은 보스가 없으면 그 약속을 그릴 수 없고, 보스가 다 빠진 예외는 그 주를
// 약속의 보스로 돌린다.
it('게임 데이터에 없는 난이도 줄 id 의 판은 건너뛰고, 판이 다 빠진 예외는 빼며 판이 다 빠진 약속은 버린다', async () => {
  const unknown = { bossDifficultyId: '없는-id', ocid: 'ocid-1' }
  await prefs.set(
    STORAGE_KEYS.partyAppointments,
    JSON.stringify([
      {
        ...STORED_LIMBO,
        bosses: [...STORED_LIMBO.bosses, unknown],
        exceptions: { ...STORED_LIMBO.exceptions, W202641: { ...STORED_LIMBO.exceptions.W202640, bosses: [unknown] } },
      },
      { ...STORED_LIMBO, id: '1d6c9a44-3b2f-4e8a-9c71-0f5e2d8b6a13', bosses: [unknown] },
    ]),
  )

  expect(await getPartyAppointments()).toEqual([LIMBO])
})

it('게임 데이터에 없는 보스나 목요일이 아닌 주를 적으려 하면 던진다', () => {
  expect(() => storedPartyAppointmentOf({ ...LIMBO, bosses: [{ bossKey: '없는보스', difficulty: 'hard', ocid: 'ocid-1' }] })).toThrow()
  expect(() => storedPartyAppointmentOf({ ...LIMBO, schedule: { ...LIMBO.schedule, fromWeek: '2026-09-23' } as PartyAppointment['schedule'] })).toThrow()
})

it('깨진 JSON 이면 빈 목록이다', async () => {
  await prefs.set('partyAppointments', '{not json')

  expect(await getPartyAppointments()).toEqual([])
})

it('모양이 틀린 항목은 그 항목만 버린다', async () => {
  const broken = { ...STORED_LIMBO, id: 'a2', time: 2100 }
  const noSchedule = { ...STORED_LIMBO, id: 'a3', schedule: { type: 'monthly' } }
  const noBosses = { ...STORED_LIMBO, id: 'a4', bosses: [] }
  const brokenBoss = { ...STORED_LIMBO, id: 'a5', bosses: [{ bossDifficultyId: 'x' }] }
  const noDuration = { ...STORED_LIMBO, id: 'a6', durationMinutes: 0 }
  const memoNotText = { ...STORED_LIMBO, id: 'a9', memo: 42 }
  const exceptionWithoutDuration = { ...STORED_LIMBO, id: 'a8', exceptions: { W202640: { date: '2026-10-01' } } }
  await prefs.set(
    'partyAppointments',
    JSON.stringify([STORED_LIMBO, broken, noSchedule, noBosses, brokenBoss, noDuration, exceptionWithoutDuration, memoNotText]),
  )

  expect(await getPartyAppointments()).toEqual([LIMBO])
})

it('메모가 있는 항목은 메모째 읽는다', async () => {
  await prefs.set('partyAppointments', JSON.stringify([{ ...STORED_LIMBO, memo: '2번 방\n세렌 확인' }]))

  expect(await getPartyAppointments()).toEqual([{ ...LIMBO, memo: '2번 방\n세렌 확인' }])
})

// 약속 id 는 uuid 다. 옛 설치본의 `시각 + 난수` id 는 Preferences 에 있어 SQLite 이관이 안 닿으므로 읽을 때 바꾼다.
describe('옛 약속 id', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it('uuid 가 아닌 id 는 uuid 로 바꿔 다시 저장하고, 다른 칸은 그대로다', async () => {
    await prefs.set(STORAGE_KEYS.partyAppointments, JSON.stringify([{ ...STORED_LIMBO, id: 'mg1abc-x1y2z3' }]))

    const [read] = await getPartyAppointments()

    expect(read?.id).toMatch(UUID)
    expect({ ...read, id: LIMBO.id }).toEqual(LIMBO)
    expect(JSON.parse((await prefs.get(STORAGE_KEYS.partyAppointments)) ?? '[]')).toEqual([{ ...STORED_LIMBO, id: read?.id }])
    expect((await getPartyAppointments())[0]?.id).toBe(read?.id)
  })

  it('uuid 약속만 있으면 다시 쓰지 않는다', async () => {
    await prefs.set(STORAGE_KEYS.partyAppointments, JSON.stringify([STORED_LIMBO]))
    prefs.set.mockClear()

    await getPartyAppointments()

    expect(prefs.set).not.toHaveBeenCalled()
  })
})

// 리프한 캐릭터의 약속은 새 캐릭터의 약속으로 이어진다. 이 주만 바꾼 회차의 보스 판도 같은 캐릭터다.
describe('월드 리프 옮기기', () => {
  it('보스 판과 이 주만 바꾼 회차의 옛 ocid 를 새 ocid 로 바꾸고, 바꾼 것이 있으면 참이다', async () => {
    await setPartyAppointments([LIMBO])

    await expect(movePartyAppointmentsToOcid('ocid-1', 'ocid-9')).resolves.toBe(true)

    const [moved] = await getPartyAppointments()
    expect(moved!.bosses).toEqual([{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-9' }])
    expect(moved!.exceptions['2026-10-01']!.bosses).toEqual([{ bossKey: 'bardrix', difficulty: 'hard', ocid: 'ocid-9' }])
  })

  it('옛 ocid 가 없으면 저장하지 않고 거짓이다', async () => {
    await setPartyAppointments([LIMBO])
    const before = await prefs.get(STORAGE_KEYS.partyAppointments)

    await expect(movePartyAppointmentsToOcid('ocid-7', 'ocid-9')).resolves.toBe(false)
    expect(await prefs.get(STORAGE_KEYS.partyAppointments)).toBe(before)
  })
})
