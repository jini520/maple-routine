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
  // 소속 기록이 실패해도 목록을 받은 자리는 그대로 간다.
  void recordCharacterAccounts(accounts, getCurrentKstDateKey(now), credential.accountId).catch(() => undefined)
  return accounts
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
    meta: { source: 'nexon' },
  })
  return queryClient.fetchQuery(listOptions)
}
