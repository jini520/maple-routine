/**
 * 넥슨 Open ID 로그인 한 번. **끝까지 돌거나, 아무 일도 안 일어나거나다.**
 *
 * ```
 * 앱     서버에 시작을 요청한다. 서버가 짝을 만들어 authorizeUrl 과 redeemKey 를 준다
 * 앱     openAuthSessionAsync 로 그 주소를 연다
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
 * **`openAuthSessionAsync` 인 것이 결정이다.** iOS 에서는 ASWebAuthenticationSession 이라 콜백
 * URL 이 그 세션에만 돌아온다. 안드로이드는 스킴 인텐트로 돌아오고, 다음 스토어 빌드에서 App Link 로
 * 바꾼다(이슈 #635).
 *
 * **던지지 않는다.** 부르는 쪽이 화면이라, 실패를 예외로 내면 그 자리마다 try 가 선다.
 */
import { Platform } from 'react-native'
import { openAuthSessionAsync } from 'expo-web-browser'

import { redeemNexonSession, startNexonLogin } from '../../server/nexon-auth'
import { setNexonLogin } from '../../storage/api-key'
import type { Platform as NexonPlatform } from '../../types/auth'
import { pruneCoveredApiKeys } from './prune-covered-keys'

/** 넥슨에 등록한 값. 인증 세션이 이 주소로 돌아올 때만 콜백을 우리에게 준다. */
const REDIRECT_URI = 'com.mapleroutine.app://oauth/callback'

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

export async function signInWithNexon(): Promise<NexonSignInResult> {
  try {
    const started = await startNexonLogin(platformOf())

    const result = await openAuthSessionAsync(started.authorizeUrl, REDIRECT_URI)
    // 사용자가 창을 닫았다. `success` 가 아닌 것은 전부 여기다.
    if (result.type !== 'success') return { kind: 'cancelled' }

    // 서버가 짝을 못 집었거나 넥슨이 동의를 거절로 끝내면 receipt 없이 돌아온다.
    const receipt = new URL(result.url).searchParams.get('receipt')
    if (receipt === null || receipt === '') return { kind: 'failed' }

    const session = await redeemUntilSettled(started.redeemKey, receipt)
    if (session === null) return { kind: 'failed' }

    // 못 적으면 다시 켤 때 로그인 상태가 아니다. 성공이라고 말하면 안 된다.
    await setNexonLogin({ session })

    // 같은 계정의 키가 있으면 거둔다. **로그인은 이미 끝났으므로 실패해도 성공이다** - 못
    // 거두면 쓸모없는 키가 남을 뿐이고 다음 로그인이 다시 해 본다.
    await pruneCoveredApiKeys().catch(() => undefined)
    return { kind: 'signedIn' }
  } catch {
    return { kind: 'failed' }
  }
}
