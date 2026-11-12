import { queryOptions } from '@tanstack/react-query'

import type { NexonCredential } from '../../types/auth'
import { worldKeyOfApiName } from '../../lib/world/worlds'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { fetchCharacterList } from '../../nexon/character'
import { recordCharacterAccounts } from '../../storage/character-accounts'
import type { MapleAccount } from '../../types'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'

/**
 * `character/list` 를 받고 캐릭터의 메이플 ID 소속을 함께 적는 통과 지점. 목록을 받는 자리는 전부 이것을 부른다.
 * 한 자리라도 빠지면 그 자리만 쓰는 사용자의 소속 기록이 비어 수수료 요율을 못 찾는다.
 *
 * 매번 넥슨을 부른다. 로그인 · 키 검증처럼 **지금** 답이 필요한 자리가 쓴다. 화면이 그리는 목록은 아래 `fetchCharacterListCached` 다.
 */
export async function fetchAndRecordCharacterList(credential: NexonCredential, now: Date = new Date()): Promise<MapleAccount[]> {
  const accounts = await fetchCharacterList(credential, worldKeyOfApiName)
  recordCharacterList(accounts, credential.accountId, now)
  return accounts
}

/**
 * 넥슨 계정 id 가 정해지기 전에 받는 목록. 소속을 적지 않는다. 로그인 · 키 입력이 쓰고, id 를 정한 뒤 `recordCharacterList`
 * 로 적는다.
 *
 * 먼저 적으면 막힌 키의 캐릭터가 계정 칸이 빈 채로 남고, 로그인이 옛 계정 id 를 찾기 전에 그 칸을 덮는다.
 */
export function fetchUnsavedCharacterList(credential: NexonCredential): Promise<MapleAccount[]> {
  return fetchCharacterList(credential, worldKeyOfApiName)
}

/** 받은 목록의 메이플 ID 소속을 적는 함수. 실패해도 목록을 받은 자리는 그대로 간다. */
export function recordCharacterList(accounts: readonly MapleAccount[], accountId: string | null, now: Date = new Date()): void {
  void recordCharacterAccounts([...accounts], getCurrentKstDateKey(now), accountId).catch(() => undefined)
}

/**
 * 같은 응답을 나눠 쓰는 시간. 캐릭터 관리가 계정 목록과 후보 목록을 잇달아 묻고, MVP 등급 설정과 회차가 그 뒤를 잇는다.
 * `character/basic` 의 5분과 같은 값이라 한 화면 안의 조회가 한 번으로 접힌다.
 */
export const CHARACTER_LIST_TTL_MS = 5 * 60 * 1000

/** 자격의 열쇠. 키는 그 값, 로그인은 계정 id 다. 자격이 바뀌면 다른 목록이라 열쇠도 다르다. */
function credentialKeyOf(credential: NexonCredential): string {
  return credential.type === 'key' ? `key:${credential.value}` : `login:${credential.accountId ?? ''}`
}

export interface FetchCharacterListOptions {
  /** 참이면 5분 안이어도 다시 받는다. 다시 시도 단추가 준다. */
  force?: boolean
}

/**
 * 5분 안의 호출은 같은 응답을 쓴다. 전에는 캐릭터 관리에 들어갈 때마다 계정 목록과 후보 목록이 각자 불러 두 번 나갔다
 * (#812 E). 실패는 그대로 던진다. 부르는 쪽이 종류를 가른다.
 */
export async function fetchCharacterListCached(
  credential: NexonCredential,
  options?: FetchCharacterListOptions,
): Promise<MapleAccount[]> {
  const listOptions = queryOptions<MapleAccount[]>({
    queryKey: queryKeys.characterList(credentialKeyOf(credential)),
    queryFn: () => fetchAndRecordCharacterList(credential),
    staleTime: options?.force === true ? 0 : CHARACTER_LIST_TTL_MS,
    // 가계부 · 통계 · today 가 메이플 ID 의 대표 캐릭터를 넥슨을 부르지 않고 고르려고 기기에 저장한다.
    meta: { persist: true, source: 'nexon' },
  })
  return queryClient.fetchQuery(listOptions)
}

/**
 * 방금 받은 목록을 그 자격의 캐시에 넣는 함수. 로그인을 갈아끼우면 새 로그인이 앞 로그인의 계정 id 를 이어받아 캐시 열쇠가
 * 같다. 안 넣으면 앞 로그인의 목록이 5분 동안 화면에 선다.
 */
export function primeCharacterList(credential: NexonCredential, accounts: MapleAccount[]): void {
  queryClient.setQueryData(queryKeys.characterList(credentialKeyOf(credential)), accounts)
}

/** 마지막으로 받아 둔 목록. 넥슨을 부르지 않는다. 받은 적이 없으면 `undefined` 다. */
export function readCachedCharacterList(credential: NexonCredential): MapleAccount[] | undefined {
  return queryClient.getQueryData<MapleAccount[]>(queryKeys.characterList(credentialKeyOf(credential)))
}
