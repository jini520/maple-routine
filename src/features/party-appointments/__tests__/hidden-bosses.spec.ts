// 이 기기에 키가 없는 부계정 캐릭터의 보스를 파티 스케줄에서 숨기는 계산.
import { unmatchedNexonIdOf } from '../../../lib/crypto/nexon-id-hash'
import type { PartyAppointment, PartyAppointmentBoss } from '../../../types/party-appointment'
import { EMPTY_KEY_LOST_SCOPE } from '../../server-sync/keyless'
import { applyEdit, draftFromOccurrence } from '../edit'
import { hiddenBossesOf, hiddenOcidOf, visibleAppointments, withHiddenBosses } from '../hidden-bosses'
import { occurrencesInWeek } from '../occurrences'

const MAIN = 'ocid-main'
const KEY_LOST = 'ocid-sub'
const UNKNOWN = unmatchedNexonIdOf('a1b2')

const boss = (ocid: string, bossKey = 'limbo'): PartyAppointmentBoss => ({ bossKey, difficulty: 'hard', ocid })

const hidden = hiddenOcidOf({ mapleIds: new Set(['sub-maple']), ocids: new Map([[KEY_LOST, 'sub-maple']]) })

// 2026-10-08(목)이 든 리셋 주
const WEEK = '2026-10-08'
const NEXT_WEEK = '2026-10-15'

function weekly(bosses: PartyAppointmentBoss[], exceptions: PartyAppointment['exceptions'] = {}): PartyAppointment {
  return {
    id: 'w1',
    bosses,
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: 10,
    schedule: { type: 'weekly', weekday: 6, fromWeek: WEEK, untilWeek: null },
    exceptions,
  }
}

describe('hiddenOcidOf', () => {
  it('키가 있던 기기의 부계정 캐릭터와 이 기기가 모르는 `#` 캐릭터를 숨긴다', () => {
    expect(hidden(KEY_LOST)).toBe(true)
    expect(hidden(UNKNOWN)).toBe(true)
    expect(hidden(MAIN)).toBe(false)
  })

  it('키 없는 부계정이 없어도 `#` 캐릭터는 숨긴다', () => {
    const none = hiddenOcidOf(EMPTY_KEY_LOST_SCOPE)
    expect(none(UNKNOWN)).toBe(true)
    expect(none(MAIN)).toBe(false)
  })
})

describe('visibleAppointments', () => {
  it('섞인 스케줄은 키 없는 캐릭터의 보스만 빼고 회차를 남은 보스로 보인다', () => {
    const appointment = weekly([boss(MAIN), boss(KEY_LOST, 'lucid'), boss(UNKNOWN, 'will')])

    const [occurrence] = occurrencesInWeek(visibleAppointments([appointment], hidden), WEEK)

    expect(occurrence!.bosses).toEqual([boss(MAIN)])
  })

  it('보스가 모두 숨은 회차는 서지 않는다', () => {
    const appointment = weekly([boss(KEY_LOST), boss(UNKNOWN, 'will')])

    expect(occurrencesInWeek(visibleAppointments([appointment], hidden), WEEK)).toEqual([])
  })

  it('주별 예외도 그 주의 보스로 가른다', () => {
    // 이 주는 숨은 캐릭터만, 다음 주는 그대로 메인 캐릭터
    const appointment = weekly([boss(MAIN)], {
      [WEEK]: { dateKey: '2026-10-10', timeKst: '22:00', durationMinutes: 30, bosses: [boss(KEY_LOST)], leadMinutes: 10 },
    })
    const visible = visibleAppointments([appointment], hidden)

    expect(occurrencesInWeek(visible, WEEK)).toEqual([])
    expect(occurrencesInWeek(visible, NEXT_WEEK).map((one) => one.bosses)).toEqual([[boss(MAIN)]])
  })

  it('숨길 것이 없으면 받은 스케줄을 그대로 돌려준다', () => {
    const appointments = [weekly([boss(MAIN)])]

    // 같은 배열이면 화면이 다시 그리지 않는다.
    expect(visibleAppointments(appointments, hidden)).toBe(appointments)
  })
})

describe('hiddenBossesOf', () => {
  it('그 주 회차의 숨은 보스를 돌려준다. 이 주만 바꾼 주는 예외의 보스다', () => {
    const appointment = weekly([boss(MAIN), boss(KEY_LOST, 'lucid')], {
      [NEXT_WEEK]: {
        dateKey: '2026-10-17',
        timeKst: '21:00',
        durationMinutes: 30,
        bosses: [boss(MAIN), boss(UNKNOWN, 'will')],
        leadMinutes: 10,
      },
    })

    expect(hiddenBossesOf(appointment, WEEK, hidden)).toEqual([boss(KEY_LOST, 'lucid')])
    expect(hiddenBossesOf(appointment, NEXT_WEEK, hidden)).toEqual([boss(UNKNOWN, 'will')])
  })
})

describe('withHiddenBosses', () => {
  // 화면에 없는 보스를 저장이 빠뜨리면 서버와 키가 멀쩡한 다른 기기에서까지 그 보스가 지워진다.
  const raw = weekly([boss(MAIN), boss(KEY_LOST, 'lucid')])
  const [visible] = occurrencesInWeek(visibleAppointments([raw], hidden), WEEK)
  const edited = { ...draftFromOccurrence(visible!), bosses: [boss(MAIN, 'will')] }

  it('앞으로 모두 고쳐도 숨은 보스를 남긴다', () => {
    const [next] = applyEdit([raw], raw, WEEK, withHiddenBosses(edited, raw, WEEK, hidden), {
      thisWeekOnly: false,
      newId: 'new',
    })

    expect(next!.bosses).toEqual([boss(MAIN, 'will'), boss(KEY_LOST, 'lucid')])
  })

  it('이 주만 고치면 예외에 숨은 보스를 남기고 약속의 보스는 그대로 둔다', () => {
    const [next] = applyEdit([raw], raw, WEEK, withHiddenBosses(edited, raw, WEEK, hidden), {
      thisWeekOnly: true,
      newId: 'new',
    })

    expect(next!.exceptions[WEEK]!.bosses).toEqual([boss(MAIN, 'will'), boss(KEY_LOST, 'lucid')])
    expect(next!.bosses).toEqual(raw.bosses)
  })
})
