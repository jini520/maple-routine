/**
 * 계정 칸이 생기기 전의 행을 메인 넥슨 계정으로 채우는 부팅 단계. 앱을 켤 때 한 번 돌고, 강화 수집기가 조회 기록을 읽기 전에 기다린다.
 *
 * 수집기가 먼저 읽으면 옛 조회 기록이 안 보여 이미 받은 날짜를 모두 다시 받는다.
 */
import { mainNexonAccountIdOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import { fillLegacyNexonAccountIds } from '../../storage/nexon-account-ids'

let filled: Promise<void> | null = null

/**
 * 메인 계정이 없으면(로그인 전) 할 일이 없다. 실패하면 다음 호출이 다시 돈다.
 *
 * @example await fillLegacyAccountIds()
 */
export function fillLegacyAccountIds(): Promise<void> {
  filled ??= (async () => {
    const mainAccountId = mainNexonAccountIdOf(await getAuthConfig())
    if (mainAccountId === null) {
      filled = null
      return
    }
    await fillLegacyNexonAccountIds(mainAccountId)
  })().catch(() => {
    filled = null
  })
  return filled
}

/** 테스트가 한 번 돈 상태를 지운다. */
export function __resetLegacyAccountIdsForTest(): void {
  filled = null
}
