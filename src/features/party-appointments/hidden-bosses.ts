/**
 * 이 기기에 키가 없는 부계정 캐릭터의 보스를 파티 스케줄에서 숨기는 계산. 숨긴 보스는 화면 · 위젯 · `등록됨` · 알림에 들지 않고,
 * 보스가 모두 숨은 회차는 서지 않는다. 기록은 그대로 두고, 이 기기에서 고쳐 저장해도 숨은 보스를 남긴다.
 *
 * @see docs/features/party-appointments.md `키가 없는 부계정 캐릭터`
 */
import { isUnmatchedNexonId } from '../../lib/crypto/nexon-id-hash'
import type { PartyAppointment, PartyAppointmentBoss } from '../../types/party-appointment'
import type { KeyLostScope } from '../server-sync/keyless'
import type { AppointmentDraft } from './draft'

/** 숨길 캐릭터인가 */
export type HiddenOcid = (ocid: string) => boolean

/**
 * 키가 있던 기기의 부계정 캐릭터와, 이 기기가 몰라 `#` 로 적은 캐릭터. `#` 캐릭터는 이름을 그릴 수도 넥슨을 부를 수도 없다.
 */
export function hiddenOcidOf(scope: KeyLostScope): HiddenOcid {
  return (ocid) => isUnmatchedNexonId(ocid) || scope.ocids.has(ocid)
}

function visibleBosses(bosses: PartyAppointmentBoss[], hidden: HiddenOcid): PartyAppointmentBoss[] {
  return bosses.some((boss) => hidden(boss.ocid)) ? bosses.filter((boss) => !hidden(boss.ocid)) : bosses
}

/**
 * 숨은 보스를 뺀 스케줄. 보스가 모두 숨은 스케줄도 빈 보스로 남기고, 회차를 펼칠 때 빈 회차를 뺀다. 주별 예외에 보이는 보스가 남을 수
 * 있기 때문이다. 숨길 것이 없으면 받은 배열을 그대로 돌려준다.
 */
export function visibleAppointments(appointments: PartyAppointment[], hidden: HiddenOcid): PartyAppointment[] {
  let changed = false
  const next = appointments.map((appointment) => {
    const bosses = visibleBosses(appointment.bosses, hidden)
    let exceptions = appointment.exceptions
    for (const [week, exception] of Object.entries(appointment.exceptions)) {
      const kept = visibleBosses(exception.bosses, hidden)
      if (kept !== exception.bosses) exceptions = { ...exceptions, [week]: { ...exception, bosses: kept } }
    }
    if (bosses === appointment.bosses && exceptions === appointment.exceptions) return appointment
    changed = true
    return { ...appointment, bosses, exceptions }
  })
  return changed ? next : appointments
}

/**
 * 그 주 회차의 숨은 보스. 이 주만 바꾼 주는 예외의 보스다.
 *
 * @param appointment 기기에 저장된 그대로의 스케줄
 * @param weekStart 회차가 든 리셋 주
 */
export function hiddenBossesOf(
  appointment: PartyAppointment,
  weekStart: string,
  hidden: HiddenOcid,
): PartyAppointmentBoss[] {
  const bosses = appointment.exceptions[weekStart]?.bosses ?? appointment.bosses
  return bosses.filter((boss) => hidden(boss.ocid))
}

/**
 * 이 기기에서 고친 값에 그 주의 숨은 보스를 뒤에 되붙인 값. 숨은 보스는 다른 캐릭터라 뒤에 붙여도 캐릭터 묶음 순서가 깨지지 않는다.
 *
 * @param appointment 기기에 저장된 그대로의 스케줄
 * @param weekStart 고친 회차가 든 리셋 주
 */
export function withHiddenBosses(
  draft: AppointmentDraft,
  appointment: PartyAppointment,
  weekStart: string,
  hidden: HiddenOcid,
): AppointmentDraft {
  const kept = hiddenBossesOf(appointment, weekStart, hidden)
  return kept.length === 0 ? draft : { ...draft, bosses: [...draft.bosses, ...kept] }
}
