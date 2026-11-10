import { mainApiKeyOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'

/**
 * 저장된 메인 키. 온보딩에서 로그인 화면으로 돌아왔을 때 입력칸을 채운다. 없거나 못 읽으면 `null`.
 *
 * 부계정 키는 채우지 않는다. 로그아웃 뒤 로그인 화면에 앞 로그인의 부계정 키가 채워지면 사용자가 넣지 않은 계정으로 들어간다.
 */
export async function loadSavedApiKey(): Promise<string | null> {
  return mainApiKeyOf(await getAuthConfig().catch(() => null))?.value ?? null
}

/**
 * 넥슨 로그인이 붙어 있나. 없거나 못 읽으면 `false`.
 *
 * today 머리가 `넥슨 ID 연동하기` 를 세울지 정할 때 쓴다. 못 읽었을 때 `true` 로 기울면 로그인할 길이
 * 사라지므로, 모를 때는 버튼이 서는 쪽으로 떨어뜨린다.
 */
export async function hasNexonLogin(): Promise<boolean> {
  return ((await getAuthConfig().catch(() => null))?.login ?? null) !== null
}
