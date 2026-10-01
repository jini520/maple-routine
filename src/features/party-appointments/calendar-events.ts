import { DIFFICULTY_NAME } from '../../constants/domain/boss-difficulty'
import { bossAliasOf } from '../../lib/boss/bosses'
import type { BossDifficulty } from '../../types'
import type { PartyAppointmentOccurrence } from '../../types/party-appointment'

/** 블록 안 캐릭터 한 묶음. 그 캐릭터가 도는 보스를 도는 차례대로 든다 */
export interface AppointmentEventGroup {
  ocid: string
  characterName: string
  bosses: { name: string; difficultyLabel: string }[]
}

/** 간트 블록 하나가 글자로 그리는 것 */
export interface AppointmentEventData {
  id: string
  appointmentId: string
  timeKst: string
  /** 보스가 둘 이상. 블록 색이 캐릭터 색이 아니라 묶음 색이다 */
  bundle: boolean
  /** 캐릭터가 처음 나온 차례 */
  groups: AppointmentEventGroup[]
  members: string[]
  hasAlarm: boolean
  repeats: boolean
}

export interface AppointmentCalendarEvent extends AppointmentEventData {
  /** 첫 보스 이름 */
  title: string
  start: Date
  end: Date
}

function difficultyLabelOf(key: string): string {
  return DIFFICULTY_NAME[key as BossDifficulty] ?? key
}

function groupsOf(
  occurrence: PartyAppointmentOccurrence,
  names: ReadonlyMap<string, string>,
): AppointmentEventGroup[] {
  const groups = new Map<string, AppointmentEventGroup>()
  for (const boss of occurrence.bosses) {
    let group = groups.get(boss.ocid)
    if (group === undefined) {
      group = { ocid: boss.ocid, characterName: names.get(boss.ocid) ?? '', bosses: [] }
      groups.set(boss.ocid, group)
    }
    group.bosses.push({
      name: bossAliasOf(boss.bossKey, boss.bossKey),
      difficultyLabel: difficultyLabelOf(boss.difficulty),
    })
  }
  return [...groups.values()]
}

/**
 * 한 주의 회차를 캘린더 이벤트로. 블록은 시작부터 종료까지다.
 *
 * @param names 추적 중인 캐릭터의 `ocid → 이름`. 못 찾는 내 캐릭터 파티원은 뺀다.
 */
export function toCalendarEvents(
  occurrences: readonly PartyAppointmentOccurrence[],
  names: ReadonlyMap<string, string>,
): AppointmentCalendarEvent[] {
  return occurrences.map((occurrence) => {
    const { appointment, dateKey, timeKst, startsAt, endsAt } = occurrence
    const first = occurrence.bosses[0]
    return {
      id: `${appointment.id}:${dateKey}`,
      appointmentId: appointment.id,
      title: first === undefined ? '' : bossAliasOf(first.bossKey, first.bossKey),
      start: startsAt,
      end: endsAt,
      timeKst,
      bundle: occurrence.bosses.length > 1,
      groups: groupsOf(occurrence, names),
      members: appointment.members.flatMap((member) => {
        if (member.type === 'text') return [member.name]
        const name = names.get(member.ocid)
        return name === undefined ? [] : [name]
      }),
      hasAlarm: occurrence.leadMinutes !== null,
      repeats: appointment.schedule.type === 'weekly',
    }
  })
}

/**
 * 자정을 넘는 블록을 calendar-kit 이 날짜마다 자른 조각 중 다음 날 조각인지. 다음 날 조각은 그 날 0분에서
 * 시작하고, 약속이 0시에 시작한 첫 조각과는 시작 시각으로 가른다.
 *
 * @param startMinutes 조각이 그 날 몇 분에서 시작하는지(`PackedEvent._internal.startMinutes`)
 */
export function isNextDayPiece(startMinutes: number | undefined, timeKst: string): boolean {
  return startMinutes === 0 && timeKst !== '00:00'
}
