/**
 * 새로 넣는 API 키가 이을 옛 넥슨 계정 id. 키를 다시 받아도 같은 계정이면 기록이 이어져야 한다.
 */
import { findNexonAccountIdOfMapleIds } from '../../storage/character-accounts'
import { getAuthConfig } from '../../storage/api-key'
import type { MapleAccount } from '../../types'

/**
 * 그 키의 메이플 ID 가 속했던 계정이 지금 다른 수단으로 살아 있으면 잇지 않는다. 같은 계정 id 를 두 수단이 가지면 안 된다.
 *
 * @param accounts 새 키로 받은 `character/list`
 * @returns 이을 계정 id. 처음 보는 계정이면 `null` 이고 새 id 를 받는다
 */
export async function reusableNexonAccountId(accounts: readonly MapleAccount[]): Promise<string | null> {
  const found = await findNexonAccountIdOfMapleIds(accounts.map((account) => account.accountId)).catch(() => null)
  if (found === null) return null
  const config = await getAuthConfig().catch(() => null)
  const live = [config?.login?.id, ...(config?.apiKeys ?? []).map((key) => key.id)]
  return live.includes(found) ? null : found
}
