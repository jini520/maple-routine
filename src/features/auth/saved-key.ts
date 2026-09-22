import { getAuthConfig } from '../../storage/api-key'

/** 저장된 API 키. 온보딩에서 로그인 화면으로 돌아왔을 때 입력칸을 채운다. 없거나 못 읽으면 `null`. */
export async function loadSavedApiKey(): Promise<string | null> {
  return (await getAuthConfig().catch(() => null))?.apiKey ?? null
}
