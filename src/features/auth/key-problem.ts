/**
 * 넥슨에서 무효가 된 부계정 키의 처리. 키를 지우지 않고 무효 표시를 붙이고, 그 키의 넥슨 계정에 속한 추적 캐릭터를 뺀다.
 *
 * 부계정은 기기마다 따로 관리해서, 키를 지우면 계정 관리에서 그 계정이 사라진다. 남겨 두면 사용자가 어느 계정의 키가 문제인지 보고
 * 그 계정에서 키를 바꾼다. 메인 키는 남는 수단이 없어 이 처리를 타지 않고 지운다.
 *
 * 모달 본문의 가는 곳과 확인 뒤의 이동이 같은 판정(`planInvalidSubKey`)에서 나온다. 둘이 갈리면 사용자가 읽은 곳과 다른 곳으로 간다.
 *
 * @see docs/features/auth.md 저장된 수단으로 조회할 수 없게 되면
 */
import { getAuthConfig, markApiKeyInvalid } from '../../storage/api-key'
import { getNexonAccountIdsOfOcids } from '../../storage/character-accounts'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { untrackCharacters } from '../character-selection/untrack'

export interface InvalidSubKeyPlan {
  apiKey: string
  /** 그 키의 넥슨 계정에 속해 추적에서 뺄 캐릭터 */
  untrack: string[]
  /** 빼고 남는 추적 캐릭터 */
  remaining: string[]
}

/** 무효 키 모달의 `확인` 뒤 가는 곳. 계정 관리 목록 · 캐릭터 설정 · 로그인 화면이다. */
export type InvalidKeyDestination = 'accounts' | 'characterSetup' | 'signIn'

/**
 * 무효가 된 키가 지금 로그인의 부계정 키면 그 키 때문에 뺄 추적 캐릭터를 가른다. 부계정 키가 아니거나 어느 키인지 모르면 `null`.
 *
 * 계정을 모르는 캐릭터는 메인 계정의 것으로 부르므로 빼지 않는다.
 */
export async function planInvalidSubKey(apiKey: string | null): Promise<InvalidSubKeyPlan | null> {
  if (apiKey === null) return null
  const config = await getAuthConfig()
  const login = config?.login
  const key = config?.apiKeys.find((one) => one.value === apiKey)
  if (login == null || key === undefined || key.loginId !== login.id) return null

  const tracked = (await getTrackedCharacterOcids()) ?? []
  const owners = await getNexonAccountIdsOfOcids(tracked)
  const untrack = tracked.filter((ocid) => owners.get(ocid) === key.id)
  return { apiKey, untrack, remaining: tracked.filter((ocid) => !untrack.includes(ocid)) }
}

export function destinationOf(plan: InvalidSubKeyPlan | null): InvalidKeyDestination {
  if (plan === null) return 'signIn'
  return plan.remaining.length > 0 ? 'accounts' : 'characterSetup'
}

/** 키에 무효 표시와 뺄 캐릭터를 먼저 적고 그 캐릭터를 뺀다. 빼고 나서 적다가 실패하면 키를 바꿀 때 되돌릴 목록을 잃는다. */
export async function retireInvalidSubKey(plan: InvalidSubKeyPlan): Promise<void> {
  await markApiKeyInvalid(plan.apiKey, plan.untrack)
  await untrackCharacters(new Set(plan.untrack))
}
