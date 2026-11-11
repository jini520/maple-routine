/**
 * 서버가 계정을 어디까지 아는지. Preferences 의 JSON 한 칸이다.
 *
 * 깨진 값은 빈 값으로 읽는다. 처음부터 다시 알리고 등록해도 서버가 더하기만 하고 이미 있는 등록은 그대로라 줄이 늘지 않는다.
 */
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export interface ServerAccountsState {
  /** 넥슨 계정 id 마다 서버가 마지막으로 돌려준 메이플 ID 해시 */
  reported: Record<string, string[]>
  /** 등록한 부계정 키. `로그인 계정 id:키 해시` 다. 로그인이 바뀌면 같은 키도 그 로그인에 다시 등록한다 */
  registered: string[]
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((one) => typeof one === 'string')
}

export async function getServerAccounts(): Promise<ServerAccountsState> {
  const empty: ServerAccountsState = { reported: {}, registered: [] }
  const raw = await preferences.get(STORAGE_KEYS.serverAccounts)
  if (raw === null) return empty
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const reported: Record<string, string[]> = {}
    if (typeof parsed.reported === 'object' && parsed.reported !== null) {
      for (const [account, ids] of Object.entries(parsed.reported)) if (isStringArray(ids)) reported[account] = ids
    }
    return { reported, registered: isStringArray(parsed.registered) ? parsed.registered : [] }
  } catch {
    return empty
  }
}

export async function setServerAccounts(state: ServerAccountsState): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverAccounts, JSON.stringify(state))
}
