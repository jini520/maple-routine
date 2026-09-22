import { worldKeyOfApiName } from '../../lib/world/worlds'
import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { fetchCharacterList } from '../../nexon/character'
import { recordCharacterAccounts } from '../../storage/character-accounts'
import type { MapleAccount } from '../../types'

/**
 * `character/list` 를 받고 캐릭터의 메이플 ID 소속을 함께 적는 통과 지점. 목록을 받는 자리는 전부 이것을 부른다.
 * 한 자리라도 빠지면 그 자리만 쓰는 사용자의 소속 기록이 비어 수수료 요율을 못 찾는다.
 */
export async function fetchAndRecordCharacterList(apiKey: string, now: Date = new Date()): Promise<MapleAccount[]> {
  const accounts = await fetchCharacterList(apiKey, worldKeyOfApiName)
  // 소속 기록이 실패해도 목록을 받은 자리는 그대로 간다.
  void recordCharacterAccounts(accounts, getCurrentKstDateKey(now)).catch(() => undefined)
  return accounts
}
