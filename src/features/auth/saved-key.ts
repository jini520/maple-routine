import { getAuthConfig } from '../../storage/api-key'

/** 저장된 API 키. 온보딩에서 로그인 화면으로 돌아왔을 때 입력칸을 채운다. 없거나 못 읽으면 `null`. */
export async function loadSavedApiKey(): Promise<string | null> {
  return (await getAuthConfig().catch(() => null))?.apiKeys[0]?.value ?? null
}

/**
 * 넥슨 로그인이 붙어 있나. 없거나 못 읽으면 `false`.
 *
 * 더보기 탭이 로그인 버튼을 세울지 정할 때 쓴다. 못 읽었을 때 `true` 로 기울면 로그인할 길이
 * 사라지므로, 모를 때는 버튼이 서는 쪽으로 떨어뜨린다.
 */
export async function hasNexonLogin(): Promise<boolean> {
  return ((await getAuthConfig().catch(() => null))?.login ?? null) !== null
}
