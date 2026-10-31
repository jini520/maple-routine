/**
 * 파티 약속 목록을 드는 쿼리. 화면은 `usePartyAppointments` 로 보고, 바꿀 때는 `savePartyAppointments` 로 저장소와 캐시를
 * 함께 바꾼다. 기기에만 있는 값이라 다시 읽을 계기가 없고 저장이 캐시를 덮는다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { getPartyAppointments, setPartyAppointments } from '../../storage/party-appointments'
import type { PartyAppointment } from '../../types/party-appointment'
import { requestNotificationReconcile } from '../local-notifications/run'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

export const partyAppointmentsOptions = queryOptions<PartyAppointment[]>({
  queryKey: queryKeys.partyAppointments(),
  queryFn: getPartyAppointments,
  staleTime: Number.POSITIVE_INFINITY,
})

const EMPTY: PartyAppointment[] = []

export interface PartyAppointments {
  appointments: PartyAppointment[]
  /** 저장소를 한 번이라도 읽었나. 읽기 전의 빈 목록을 `약속 없음` 으로 그리지 않게. */
  loaded: boolean
}

export function usePartyAppointments(): PartyAppointments {
  const { data } = useQuery(partyAppointmentsOptions)
  return { appointments: data ?? EMPTY, loaded: data !== undefined }
}

/** 아직 안 읽었으면 읽는다. 알림을 눌러 들어온 화면이 그 회차를 찾을 때 쓴다. */
export function loadPartyAppointments(): Promise<PartyAppointment[]> {
  return queryClient.ensureQueryData(partyAppointmentsOptions)
}

export async function savePartyAppointments(next: PartyAppointment[]): Promise<void> {
  // 저장이 먼저다. 저장이 실패했는데 캐시만 바뀌면 다시 켰을 때 약속이 사라진다.
  await setPartyAppointments(next)
  queryClient.setQueryData(queryKeys.partyAppointments(), next)
  // 재조정은 저장소를 읽으니 저장 뒤에 부른다.
  void requestNotificationReconcile()
}
