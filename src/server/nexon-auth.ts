/**
 * 우리 서버의 넥슨 로그인 창구. `notices.ts`·`settlement.ts` 와 같은 자리, 같은 규칙이다.
 *
 * **토큰은 서버가 든다.** 교환이 `client_secret` 을 요구하고 넥슨 보안 가이드라인이 액세스 토큰을
 * 서버에서만 관리하라고 적는다. 앱이 받는 것은 서버가 발급한 세션 하나다.
 *
 * ```
 * 앱     POST /auth/nexon/login { platform }        → { authorizeUrl, redeemKey }
 * 앱     브라우저로 authorizeUrl 을 연다
 * 넥슨   서버의 콜백으로 code 를 보낸다
 * 서버   교환해 세션을 봉해 두고 앱에 com.mapleroutine.app://oauth/callback?receipt= 로 돌려보낸다
 * 앱     POST /auth/nexon/session { redeemKey, receipt } → { status: 'ok', session } | { status: 'pending' } | 404
 * ```
 *
 * 열쇠가 둘인 이유가 요점이다. `redeemKey` 는 시작한 앱만 들고 `receipt` 는 돌아오는 길에만 실려서,
 * 한쪽만 가진 공격자는 세션을 못 받는다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 한쪽만 바꾸면 타입 검사가 못 잡으므로
 * 필드를 더할 때 양쪽을 함께 볼 것.
 */
import type { Platform } from '../types/auth'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 조회(8초)보다 길다.
 *
 * 사용자가 로그인 화면 앞에서 결과를 기다리고 있어, 일찍 끊으면 다 해 놓고 실패로 보인다.
 */
const TIMEOUT_MS = 15_000

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** 서버가 만든 짝. `redeemKey` 는 앱이 들고 있다가 세션을 받을 때 돌려준다. 콜백 URL 에는 안 실린다. */
export interface NexonLoginStart {
  authorizeUrl: string
  redeemKey: string
}

/**
 * 로그인을 시작한다. **플랫폼을 알린다.**
 *
 * 넥슨 애플리케이션이 iOS 와 안드로이드로 따로 등록돼 `client_id` 와 secret 이 쌍으로 갈린다.
 * 서버가 그 값으로 authorize 주소를 만들고, 교환 때도 **짝에 적어 둔 같은 쌍**을 쓴다.
 */
export async function startNexonLogin(platform: Platform): Promise<NexonLoginStart> {
  const res = await postJson('/auth/nexon/login', { platform })
  if (!res.ok) throw new Error(`넥슨 로그인 시작이 실패했습니다 (status: ${res.status})`)
  const body = (await res.json()) as Partial<NexonLoginStart>
  if (typeof body.authorizeUrl !== 'string' || typeof body.redeemKey !== 'string') {
    throw new Error('넥슨 로그인 시작 응답이 계약과 다릅니다')
  }
  return { authorizeUrl: body.authorizeUrl, redeemKey: body.redeemKey }
}

/**
 * 세션을 받은 결과.
 *
 * `pending` 은 콜백이 아직 넥슨과 왕복하는 중이라 잠시 뒤 다시 묻는다. `gone` 은 만료 · 실패 · 취소 ·
 * 이미 가져감이라 다시 로그인하는 수밖에 없다.
 */
export type RedeemOutcome = { status: 'ok'; session: string } | { status: 'pending' } | { status: 'gone' }

/** 열쇠 둘로 세션을 받는다. 서버는 `gone` 만 404 로 내고 나머지는 본문의 status 로 가른다. */
export async function redeemNexonSession(params: {
  redeemKey: string
  receipt: string
}): Promise<RedeemOutcome> {
  const res = await postJson('/auth/nexon/session', params)
  if (res.status === 404) return { status: 'gone' }
  if (!res.ok) throw new Error(`넥슨 세션 받기가 실패했습니다 (status: ${res.status})`)
  const body = (await res.json()) as { status?: unknown; session?: unknown }
  if (body.status === 'ok' && typeof body.session === 'string' && body.session !== '') {
    return { status: 'ok', session: body.session }
  }
  if (body.status === 'pending') return { status: 'pending' }
  return { status: 'gone' }
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
      headers: { Authorization: `Bearer ${session}` },
      signal: controller.signal,
    })
  } catch {
    // 기기에서 지우는 것이 본론이다.
  } finally {
    clearTimeout(timer)
  }
}
