/**
 * 파티 스케줄 화면에서 마지막으로 고른 보기. 모르는 값은 목록으로 읽는다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export type PartyScheduleView = 'list' | 'board'

export async function getPartyScheduleView(): Promise<PartyScheduleView> {
  return (await preferences.get(STORAGE_KEYS.partyScheduleView)) === 'board' ? 'board' : 'list'
}

export async function setPartyScheduleView(view: PartyScheduleView): Promise<void> {
  await preferences.set(STORAGE_KEYS.partyScheduleView, view)
}
