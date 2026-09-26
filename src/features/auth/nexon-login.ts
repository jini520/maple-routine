/**
 * 넥슨 Open ID 로그인 한 번. **끝까지 돌거나, 아무 일도 안 일어나거나다.**
 *
 * ```
 * 앱     서버에 시작을 요청한다. 서버가 state 와 검증값을 만들어 짝지어 두고 앱에 준다
 * 앱     openAuthSessionAsync 로 그 주소를 연다
 * 넥슨   로그인 · 동의
 * 넥슨   com.mapleroutine.app://oauth/callback?code=&state=   인증 세션이 앱에 돌려준다
 * 앱     state 가 받은 값과 같은지 확인하고 code · state · 검증값을 서버에 넘긴다
 * 서버   검증값이 맞을 때만 교환해 보관하고 세션을 응답으로 준다
 * ```
 *
 * **`openAuthSessionAsync` 인 것이 결정이다.** iOS 에서는 ASWebAuthenticationSession 이라 콜백
 * URL 이 그 세션에만 돌아온다. `Linking.openURL` 로 Safari 를 열면 같은 스킴을 등록한 다른 앱이
 * 콜백을 받을 수 있다. 앱 안 웹뷰로도 안 연다. 주소창이 안 보이면 사용자가 자격 증명을 어디에
 * 넣는지 확인할 방법이 없다.
 *
 * **던지지 않는다.** 부르는 쪽이 화면이라, 실패를 예외로 내면 그 자리마다 try 가 선다.
 */
import { Platform } from 'react-native'
import { openAuthSessionAsync } from 'expo-web-browser'

import { exchangeNexonCode, startNexonLogin } from '../../server/nexon-auth'
import { setNexonLogin } from '../../storage/api-key'
import type { Platform as NexonPlatform } from '../../types/auth'
import { pruneCoveredApiKeys } from './prune-covered-keys'

/** 넥슨에 등록한 값. 인증 세션이 이 주소로 돌아올 때만 콜백을 우리에게 준다. */
const REDIRECT_URI = 'com.mapleroutine.app://oauth/callback'

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

export async function signInWithNexon(): Promise<NexonSignInResult> {
  try {
    const started = await startNexonLogin(platformOf())

    const result = await openAuthSessionAsync(started.authorizeUrl, REDIRECT_URI)
    // 사용자가 창을 닫았다. `success` 가 아닌 것은 전부 여기다.
    if (result.type !== 'success') return { kind: 'cancelled' }

    const params = new URL(result.url).searchParams
    // 넥슨이 동의를 거절로 끝냈다. code 가 올 자리에 error 가 온다.
    if (params.get('error') !== null) return { kind: 'failed' }

    const code = params.get('code')
    // **콜백이 우리가 시작한 그 요청의 답인지 가리는 유일한 방법이다**(넥슨 보안 가이드라인의
    // CSRF 대응). 다르면 code 를 서버에 넘기지 않는다.
    if (code === null || params.get('state') !== started.state) return { kind: 'failed' }

    const tokens = await exchangeNexonCode({
      code,
      state: started.state,
      verifier: started.verifier,
    })

    // 못 적으면 다시 켤 때 로그인 상태가 아니다. 성공이라고 말하면 안 된다.
    await setNexonLogin(tokens)

    // 같은 계정의 키가 있으면 거둔다. **로그인은 이미 끝났으므로 실패해도 성공이다** - 못
    // 거두면 쓸모없는 키가 남을 뿐이고 다음 로그인이 다시 해 본다.
    await pruneCoveredApiKeys().catch(() => undefined)
    return { kind: 'signedIn' }
  } catch {
    return { kind: 'failed' }
  }
}
