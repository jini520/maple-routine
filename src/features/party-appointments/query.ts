/**
 * 파티 약속 목록을 드는 쿼리. 화면은 `usePartyAppointments` 로 보고, 바꿀 때는 `savePartyAppointments` 로 저장소와 캐시를
 * 함께 바꾼다. 다른 기기에서 고친 약속은 동기화가 받아 저장소에 넣은 뒤 이 쿼리를 무효로 한다.
 *
 * 화면이 보는 목록은 이 기기에 키가 없는 부계정 캐릭터의 보스를 뺀 것이고, 저장은 기기에 저장된 그대로의 목록(`stored`)으로 한다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPartyAppointments, setPartyAppointments } from '../../storage/party-appointments'
import type { PartyAppointment } from '../../types/party-appointment'
import { requestNotificationReconcile } from '../local-notifications/run'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { EMPTY_KEY_LOST_SCOPE, loadKeyLostScope } from '../server-sync/keyless'
import { hiddenOcidOf, visibleAppointments, type HiddenOcid } from './hidden-bosses'

export const partyAppointmentsOptions = queryOptions<PartyAppointment[]>({
  queryKey: queryKeys.partyAppointments(),
  queryFn: getPartyAppointments,
  staleTime: Number.POSITIVE_INFINITY,
})

/** 키를 등록 · 변경 · 삭제하거나 무효 표시가 붙으면(`auth_methods`), 캐릭터의 계정을 새로 보면 다시 읽는다. */
export const keyLostScopeOptions = queryOptions({
  queryKey: queryKeys.keyLostScope(),
  queryFn: loadKeyLostScope,
  staleTime: Number.POSITIVE_INFINITY,
  meta: { tables: ['auth_methods'], dependsOn: ['schedule-round', 'tracked-ocids'] },
})

const EMPTY: PartyAppointment[] = []

export interface PartyAppointments {
  /** 화면이 보는 목록. 숨은 보스를 뺐다 */
  appointments: PartyAppointment[]
  /** 기기에 저장된 그대로의 목록. 저장은 이것으로 한다 */
  stored: PartyAppointment[]
  /** 숨길 캐릭터인가 */
  hidden: HiddenOcid
  /** 저장소를 한 번이라도 읽었나. 읽기 전의 빈 목록을 `약속 없음` 으로 그리지 않게. */
  loaded: boolean
}

export function usePartyAppointments(): PartyAppointments {
  const { data } = useQuery(partyAppointmentsOptions)
  const { data: scope } = useQuery(keyLostScopeOptions)
  const hidden = useMemo(() => hiddenOcidOf(scope ?? EMPTY_KEY_LOST_SCOPE), [scope])
  const stored = data ?? EMPTY
  const appointments = useMemo(() => visibleAppointments(stored, hidden), [stored, hidden])
  return { appointments, stored, hidden, loaded: data !== undefined }
}

/** 아직 안 읽었으면 읽은 화면용 목록. 알림을 눌러 들어온 화면이 그 회차를 찾을 때 쓴다. 숨은 회차는 찾지 못한다. */
export async function loadPartyAppointments(): Promise<PartyAppointment[]> {
  const [appointments, scope] = await Promise.all([
    queryClient.ensureQueryData(partyAppointmentsOptions),
    queryClient.ensureQueryData(keyLostScopeOptions).catch(() => EMPTY_KEY_LOST_SCOPE),
  ])
  return visibleAppointments(appointments, hiddenOcidOf(scope))
}

export async function savePartyAppointments(next: PartyAppointment[]): Promise<void> {
  // 저장이 먼저다. 저장이 실패했는데 캐시만 바뀌면 다시 켰을 때 약속이 사라진다.
  await setPartyAppointments(next)
  queryClient.setQueryData(queryKeys.partyAppointments(), next)
  // 재조정은 저장소를 읽으니 저장 뒤에 부른다.
  void requestNotificationReconcile()
}
