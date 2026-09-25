/**
 * 우리 서버의 넥슨 로그인 창구. `notices.ts`·`settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **토큰은 서버가 든다.** 교환이 `client_secret` 을 요구하고 네이티브 앱용 대안인 PKCE 가
 * 규격에 없어, 앱 번들에 넣으면 그대로 뜯긴다. 앱이 받는 것은 서버가 발급한 세션 하나다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 한쪽만 바꾸면 타입 검사가 못 잡으므로
 * 필드를 더할 때 양쪽을 함께 볼 것.
 */
import type { Platform } from '../types/auth'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 조회(8초)보다 길다.
 *
 * 교환은 우리 서버가 넥슨을 한 번 더 부르는 자리라 왕복이 둘이다. 그리고 사용자가 로그인
 * 화면 앞에서 결과를 기다리고 있어, 일찍 끊으면 다 해 놓고 실패로 보인다.
 */
const TIMEOUT_MS = 15_000

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`넥슨 로그인 요청이 실패했습니다 (status: ${res.status})`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** 서버가 만든 짝. `verifier` 는 앱이 들고 있다가 교환 때 돌려준다. */
export interface NexonLoginStart {
  authorizeUrl: string
  state: string
  verifier: string
}

/**
 * 로그인을 시작한다. **플랫폼을 알린다.**
 *
 * 넥슨 애플리케이션이 iOS 와 안드로이드로 따로 등록돼 `client_id` 와 secret 이 쌍으로 갈린다.
 * 서버가 그 값으로 authorize 주소를 만들고, 교환 때도 **짝에 적어 둔 같은 쌍**을 쓴다.
 */
export async function startNexonLogin(platform: Platform): Promise<NexonLoginStart> {
  return postJson<NexonLoginStart>('/auth/nexon/start', { platform })
}

/**
 * 받은 `code` 를 세션으로 바꾼다. **검증값이 맞을 때만 서버가 교환한다.**
 *
 * 검증값은 콜백 URL 에 안 실리고 앱과 서버 사이 https 로만 오간다. 안드로이드에서 콜백을
 * 가로챈 앱은 `code` 와 `state` 만 갖고 이 값이 없다.
 */
export async function exchangeNexonCode(params: {
  code: string
  state: string
  verifier: string
}): Promise<string> {
  const { session } = await postJson<{ session: string }>('/auth/nexon/session', params)
  return session
}

/**
 * 연결을 해제한다. **서버의 토큰도 함께 사라진다.**
 *
 * 실패해도 던지지 않는다. 기기에서 세션을 지우는 일이 더 중요하고, 서버 쪽은 갱신 토큰 수명이
 * 지나면 어차피 정리된다.
 */
export async function revokeNexonSession(session: string): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(`${BASE_URL}/auth/nexon/session`, {
      method: 'DELETE',
      headers: { 'x-nexon-session': session },
      signal: controller.signal,
    })
  } catch {
    // 기기에서 지우는 것이 본론이다.
  } finally {
    clearTimeout(timer)
  }
}
