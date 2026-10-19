/**
 * 인증 수단 하나가 준 `character/list` 응답의 모양.
 */
import type { MapleAccount } from '../types/character'
import type { NexonCredential } from '../types/auth'

/** 한 수단이 준 응답 한 벌. */
export interface CredentialAccounts {
  credential: NexonCredential
  accounts: readonly MapleAccount[]
}
