import { bossPickerSections, isPicked, scheduledBossKeys, togglePick } from '../boss-picker'
import { partySizeKey } from '../../boss-scheduler/store'
import type {
  PartyAppointment,
  PartyAppointmentBoss,
  PartyAppointmentException,
  PartyAppointmentSchedule,
} from '../../../types/party-appointment'

const OCID = 'ocid-1'
const NO_SHARE = { crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null }

describe('bossPickerSections', () => {
  const registered = [
    { bossKey: 'black_mage', difficulty: 'hard' },
    { bossKey: 'limbo', difficulty: 'hard' },
    { bossKey: 'bardrix', difficulty: 'normal' },
    { bossKey: 'jupiter', difficulty: 'normal' },
  ]

  it('파티 인원이 둘 이상이거나 분배 비율이 있는 등록 보스는 파티, 나머지 등록 보스는 스케줄러다', () => {
    const sections = bossPickerSections({
      ocid: OCID,
      registered,
      partySizes: { [partySizeKey(OCID, 'limbo', 'hard')]: 3, [partySizeKey(OCID, 'jupiter', 'normal')]: 1 },
      partyShares: {
        [partySizeKey(OCID, 'bardrix', 'normal')]: { ...NO_SHARE, crystalMyShare: 1, crystalSharesTotal: 4 },
      },
    })

    expect(sections.party).toEqual([
      { bossKey: 'limbo', difficulty: 'hard' },
      { bossKey: 'bardrix', difficulty: 'normal' },
    ])
    expect(sections.scheduler).toEqual([
      { bossKey: 'black_mage', difficulty: 'hard' },
      { bossKey: 'jupiter', difficulty: 'normal' },
    ])
  })

  it('모든 보스는 등록 보스면 등록 난이도, 아니면 가장 높은 난이도로 선다', () => {
    const sections = bossPickerSections({ ocid: OCID, registered, partySizes: {}, partyShares: {} })

    expect(sections.all).toContainEqual({ bossKey: 'limbo', difficulty: 'hard' })
    expect(sections.all).toContainEqual({ bossKey: 'bardrix', difficulty: 'normal' })
    // 카링은 이지 · 노멀 · 하드 · 익스트림이고 등록되지 않았다.
    expect(sections.all).toContainEqual({ bossKey: 'kaling', difficulty: 'extreme' })
  })

  it('모든 보스에 같은 보스가 두 번 서지 않는다', () => {
    const sections = bossPickerSections({ ocid: OCID, registered, partySizes: {}, partyShares: {} })
    const keys = sections.all.map((tile) => tile.bossKey)

    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('togglePick', () => {
  const limbo = { bossKey: 'limbo', difficulty: 'hard' }

  it('안 고른 보스를 누르면 그 캐릭터로 뒤에 붙는다', () => {
    expect(togglePick([], OCID, limbo)).toEqual([{ ...limbo, ocid: OCID }])
  })

  it('같은 캐릭터로 고른 보스를 다시 누르면 빠진다', () => {
    const picked = [{ ...limbo, ocid: OCID }]

    expect(togglePick(picked, OCID, limbo)).toEqual([])
  })

  it('같은 보스도 다른 캐릭터로는 따로 고른다', () => {
    const picked = [{ ...limbo, ocid: 'ocid-2' }]

    expect(togglePick(picked, OCID, limbo)).toEqual([
      { ...limbo, ocid: 'ocid-2' },
      { ...limbo, ocid: OCID },
    ])
    expect(isPicked(picked, OCID, 'limbo')).toBe(false)
    expect(isPicked(picked, 'ocid-2', 'limbo')).toBe(true)
  })
})

describe('scheduledBossKeys', () => {
  function boss(bossKey: string, ocid = OCID): PartyAppointmentBoss {
    return { bossKey, difficulty: 'hard', ocid }
  }

  function appointment(
    id: string,
    schedule: PartyAppointmentSchedule,
    bosses: PartyAppointmentBoss[],
    exceptions: Record<string, PartyAppointmentException> = {},
  ): PartyAppointment {
    return { id, bosses, members: [], timeKst: '21:00', durationMinutes: 60, leadMinutes: null, schedule, exceptions }
  }

  function keys(set: Set<string>): string[] {
    return [...set].sort()
  }

  // 리셋 주는 목요일에 시작한다. 2026-11-12(목) ~ 11-18(수)가 한 주다.
  it('주간 보스는 새 스케줄 날짜가 든 리셋 주의 회차만 센다', () => {
    const appointments = [appointment('a', { type: 'once', dateKey: '2026-11-18' }, [boss('limbo')])]

    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-12' }))).toEqual(['limbo'])
    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-19' }))).toEqual([])
  })

  // 월간 보스는 한 달에 한 번 잡는다(사용자 결정). 같은 달이면 다른 주에 넣은 것도 이미 넣은 것이다.
  it('월간 보스는 같은 달이면 다른 주의 회차도 센다', () => {
    const appointments = [appointment('a', { type: 'once', dateKey: '2026-11-02' }, [boss('black_mage'), boss('limbo')])]

    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-26' }))).toEqual(['black_mage'])
  })

  // 10-30(금)과 11-02(월)은 같은 리셋 주(10-29 ~ 11-04)지만 달이 다르다.
  it('월간 보스는 같은 주여도 달이 다르면 세지 않는다', () => {
    const appointments = [appointment('a', { type: 'once', dateKey: '2026-10-30' }, [boss('black_mage'), boss('limbo')])]

    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-02' }))).toEqual(['limbo'])
  })

  it('반복 스케줄은 그 주의 예외를 따르고, 끝난 반복은 세지 않는다', () => {
    const appointments = [
      appointment(
        'a',
        { type: 'weekly', weekday: 6, fromWeek: '2026-11-05', untilWeek: '2026-11-19' },
        [boss('limbo')],
        {
          '2026-11-12': {
            type: 'override',
            dateKey: '2026-11-14',
            timeKst: '21:00',
            durationMinutes: 60,
            bosses: [boss('will')],
            leadMinutes: null,
          },
        },
      ),
    ]

    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-05' }))).toEqual(['limbo'])
    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-13' }))).toEqual(['will'])
    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-21' }))).toEqual([])
  })

  // 수정할 때 자기 보스를 세면 원래 들어 있던 보스가 모두 등록됨이 된다.
  it('다른 캐릭터의 보스와 고치는 스케줄 자신은 세지 않는다', () => {
    const appointments = [
      appointment('a', { type: 'once', dateKey: '2026-11-14' }, [boss('limbo')]),
      appointment('b', { type: 'once', dateKey: '2026-11-15' }, [boss('will', 'ocid-2')]),
    ]

    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-14' }))).toEqual(['limbo'])
    expect(keys(scheduledBossKeys({ appointments, ocid: OCID, dateKey: '2026-11-14', excludeId: 'a' }))).toEqual([])
  })
})
