/**
 * 넥슨 Open ID 로그인 한 번. **끝까지 돌거나, 아무 일도 안 일어나거나다.**
 *
 * ```
 * 앱     서버에 시작을 요청한다. 서버가 짝을 만들어 authorizeUrl 과 redeemKey 를 준다
 * 앱     인증 창(`openAuthSession`)으로 그 주소를 연다
 * 넥슨   로그인 · 동의
 * 넥슨   서버의 콜백으로 code 와 state 를 보낸다
 * 서버   짝을 집어 교환하고 세션을 봉해 둔 뒤 com.mapleroutine.app://oauth/callback?receipt= 로 돌려보낸다
 * 앱     redeemKey 와 receipt 를 서버에 넘겨 세션을 받는다. 콜백이 아직 도는 중이면 잠시 뒤 다시 묻는다
 * ```
 *
 * **열쇠가 둘이다.** `redeemKey` 는 시작한 앱만 들고 `receipt` 는 돌아오는 길에만 실린다. 돌아오는
 * 길을 가로챈 앱은 `redeemKey` 가 없고, 시작을 흉내 낸 앱은 `receipt` 가 없다. `state` 대조는 콜백을
 * 받는 서버가 한다.
 *
 * **인증 창은 `openAuthSessionAsync` 로 정했다.** iOS 에서는 ASWebAuthenticationSession 이라 콜백
 * URL 이 그 세션에만 돌아오기 때문이다. 안드로이드는 스킴 인텐트로 돌아온다. 이 호출은 브라우저
 * 어댑터(`native/adapters/rn-browser.ts`)가 한다.
 *
 * **던지지 않는다.** 부르는 쪽이 화면이라, 실패를 예외로 내면 그 자리마다 try 가 선다.
 */
import { Platform } from 'react-native'

import { openAuthSession } from '../../native/browser'
import { redeemNexonSession, startNexonLogin } from '../../server/nexon-auth'
import type { Platform as NexonPlatform } from '../../types/auth'
import { forgetTrackedSelection } from '../character-selection/forget'
import { saveNexonLogin } from './prune-covered-keys'

/** 넥슨에 등록한 값. 인증 세션이 이 주소로 돌아올 때만 콜백을 우리에게 준다. */
const REDIRECT_URI = 'com.mapleroutine.app://oauth/callback'

/** 넥슨 동의 화면에서 `취소` 를 누르면 넥슨이 보내는 `error_name`. 서버가 돌아오는 주소에 그대로 싣는다. */
const CONSENT_CANCELLED = 'user_cancel_consent'

/** 콜백이 넥슨과 왕복하는 동안 되묻는 간격과 횟수. 서버가 봉한 세션을 60초 안에 꺼내 가야 한다. */
export const REDEEM_RETRY_MS = 1_000
export const REDEEM_MAX_TRIES = 30

/**
 * 로그인 한 번의 끝.
 *
 * **취소가 실패와 갈린다.** 사용자가 창을 닫은 것은 아무 일도 안 일어난 것이라, 안내를 띄우면
 * 자기가 닫아 놓고 무엇이 잘못됐나 찾게 된다.
 */
export type NexonSignInResult =
  | { kind: 'signedIn' }
  | { kind: 'cancelled' }
  | { kind: 'failed' }

function platformOf(): NexonPlatform {
  return Platform.OS === 'android' ? 'android' : 'ios'
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 세션이 나오거나 끝났다고 할 때까지 되묻는다. 끝까지 pending 이면 실패다. */
async function redeemUntilSettled(redeemKey: string, receipt: string): Promise<string | null> {
  for (let tries = 0; tries < REDEEM_MAX_TRIES; tries += 1) {
    const outcome = await redeemNexonSession({ redeemKey, receipt })
    if (outcome.status === 'ok') return outcome.session
    if (outcome.status === 'gone') return null
    await sleep(REDEEM_RETRY_MS)
  }
  return null
}

export interface NexonSignInOptions {
  /**
   * 참이면 로그인 화면에서 하는 새 로그인이다. 세션을 받은 뒤, 저장하기 전에 앞 로그인의 추적 목록을 비운다. today 의
   * `넥슨 ID 연동하기` 는 키로 쓰던 사람이 로그인을 붙이는 것이라 비우지 않는다.
   */
  fresh?: boolean
}

export async function signInWithNexon(options?: NexonSignInOptions): Promise<NexonSignInResult> {
  try {
    const started = await startNexonLogin(platformOf())

    const callbackUrl = await openAuthSession(started.authorizeUrl, REDIRECT_URI)
    // 사용자가 창을 닫았다.
    if (callbackUrl === null) return { kind: 'cancelled' }

    // 동의 화면에서 취소한 것도 창을 닫은 것과 같이 스스로 그만둔 것이다.
    const params = new URL(callbackUrl).searchParams
    if (params.get('error_name') === CONSENT_CANCELLED) return { kind: 'cancelled' }

    // 서버가 짝을 못 집었거나 교환이 실패하면 receipt 없이 돌아온다.
    const receipt = params.get('receipt')
    if (receipt === null || receipt === '') return { kind: 'failed' }

    const session = await redeemUntilSettled(started.redeemKey, receipt)
    if (session === null) return { kind: 'failed' }

    // 로그인 만료는 로그아웃을 거치지 않는다. 그래서 로그아웃이 아니라 여기서 비워야 다른 넥슨 ID 로 들어올 때 앞 목록이
    // 남지 않는다.
    if (options?.fresh === true) await forgetTrackedSelection()

    // 메이플 ID 가 같은 키를 저장하기 전에 서버에서 잇고, 로그인이 그 키의 계정 id 를 이어받아 저장된다. 못 적으면 다시
    // 켤 때 로그인 상태가 아니다. 성공이라고 말하면 안 된다.
    await saveNexonLogin(session)
    return { kind: 'signedIn' }
  } catch {
    return { kind: 'failed' }
  }
}
