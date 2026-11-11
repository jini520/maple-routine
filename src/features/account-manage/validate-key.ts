/**
 * 계정 관리에서 키를 넣기 전의 검증. 차례대로 보고 하나라도 걸리면 저장하지 않는다.
 *
 * 1. `character/list` 를 한 번 부른다. 무효 키면 막는다. 무효 키가 아닌 실패는 키 탓이 아니라 실패로 넘긴다.
 * 2. 20건을 동시에 보내 429 가 오면 개발 단계 키라 막는다.
 * 3. 메이플 ID 가 하나도 없으면 막는다. 같은 계정인지 가를 수 없다.
 * 4. 메이플 ID 가 다른 등록된 계정과 하나라도 겹치면 막는다. 메이플 ID 는 넥슨 계정 하나에만 속해서 겹치면 같은 계정이다.
 * 5. 변경 · 입력이면 그 계정의 메이플 ID 와 하나라도 겹쳐야 받는다. 겹치지 않으면 다른 넥슨 계정의 키다.
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { apiKeyCredential } from '../../lib/nexon-credential'
import { isInvalidApiKeyError } from '../../nexon/errors'
import { probeApiKeyStage, type ApiKeyStageVerdict } from '../../nexon/key-stage'
import type { MapleAccount } from '../../types'
import { toAuthError } from '../auth/format'
import type { AuthError } from '../auth/state'
import { fetchUnsavedCharacterList } from '../mvp-grade/character-list'

export type KeyRejection = 'invalid' | 'developmentStage' | 'noMapleId' | 'alreadyRegistered' | 'otherAccount'

export type KeyCheck =
  | { outcome: 'ok'; accounts: MapleAccount[]; mapleIdHashes: string[] }
  | { outcome: 'rejected'; reason: KeyRejection }
  | { outcome: 'failed'; error: AuthError }

export interface KeyCheckContext {
  /** 다른 등록된 계정들의 메이플 ID 해시. 바꾸려는 계정은 뺀다 */
  taken: readonly string[]
  /** 변경 · 입력이면 그 계정의 메이플 ID 해시. 추가면 `null` */
  target: readonly string[] | null
}

/** 이 검증이 밖에 맡기는 일. 테스트가 갈아 끼운다. */
export interface CheckApiKeyDeps {
  fetchList: (apiKey: string) => Promise<MapleAccount[]>
  probeStage: (apiKey: string) => Promise<ApiKeyStageVerdict>
}

const DEFAULT_DEPS: CheckApiKeyDeps = {
  // 소속은 적지 않는다. 계정 id 를 정한 뒤 부르는 쪽이 적는다. 먼저 적으면 막힌 키의 캐릭터가 계정 칸이 빈 채로 남는다.
  fetchList: (apiKey) => fetchUnsavedCharacterList(apiKeyCredential(apiKey)),
  probeStage: (apiKey) => probeApiKeyStage(apiKeyCredential(apiKey)),
}

export async function checkApiKey(
  apiKey: string,
  context: KeyCheckContext,
  deps: CheckApiKeyDeps = DEFAULT_DEPS,
): Promise<KeyCheck> {
  let accounts: MapleAccount[]
  try {
    accounts = await deps.fetchList(apiKey)
  } catch (error) {
    if (isInvalidApiKeyError(error)) return { outcome: 'rejected', reason: 'invalid' }
    return { outcome: 'failed', error: toAuthError(error) }
  }

  // 검증이 성공한 뒤에만 잰다. 키 오타마다 판정 건수를 태우면 개발 단계 키의 하루 예산이 녹는다.
  if ((await deps.probeStage(apiKey)) === 'developmentStage') return { outcome: 'rejected', reason: 'developmentStage' }

  const mapleIdHashes = accounts.map((account) => nexonIdHashHex(account.accountId))
  if (mapleIdHashes.length === 0) return { outcome: 'rejected', reason: 'noMapleId' }

  const taken = new Set(context.taken)
  if (mapleIdHashes.some((hash) => taken.has(hash))) return { outcome: 'rejected', reason: 'alreadyRegistered' }

  if (context.target !== null) {
    const target = new Set(context.target)
    if (!mapleIdHashes.some((hash) => target.has(hash))) return { outcome: 'rejected', reason: 'otherAccount' }
  }

  return { outcome: 'ok', accounts, mapleIdHashes }
}
