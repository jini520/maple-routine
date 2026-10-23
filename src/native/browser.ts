import { Linking } from 'react-native'

import { getThemeAppearance } from '../theme/appearance-store'
import { getBrowserPort } from './ports'

/**
 * 앱 안에서 웹 문서를 여는 창. 앱이 여는 웹 주소는 모두 이것으로 연다.
 *
 * 앱 전체가 한 방식이어야 한다. 섞이면 같은 크기 같은 색의 링크가 어떤 것은 앱을 떠나고 어떤 것은
 * 안 떠나, 누르기 전에 어느 쪽인지 알 수 없다. 상단 막대는 누를 때의 테마 `bg` 로 칠한다.
 *
 * **넥슨 로그인 창은 이것이 아니다.** 그쪽은 `openAuthSessionAsync` 라 콜백 URL 이 그 세션에만
 * 돌아온다.
 *
 * @param url 열 주소
 * @example openInAppBrowser('https://openapi.nexon.com')
 */
export function openInAppBrowser(url: string): void {
  const { definition } = getThemeAppearance()
  // 창을 못 열면 시스템 브라우저로 넘긴다. 안드로이드에 Custom Tabs 를 받는 브라우저가 없으면 창이
  // 거절하고, 그대로 삼키면 눌러도 아무 일이 안 일어난다. 그것마저 못 열면 삼킨다. 거절이 흘러나가면
  // 누름 하나가 처리되지 않은 거부로 남는데, 링크를 못 연 것과 별개로 화면은 그대로 서 있어야 한다.
  //
  // 포트가 안 꽂힌 것은 그대로 던진다. 그것은 배선 사고이지 이 기기에서 못 연다가 아니다.
  void getBrowserPort()
    .open(url, { toolbarColor: definition.bg, controlsColor: definition.primaryInk })
    .catch(() => Linking.openURL(url))
    .catch(() => undefined)
}

/**
 * 로그인용 인증 창. 돌아온 콜백 주소를 돌려주고, 사용자가 닫았으면 `null`.
 *
 * 거절을 삼키지 않는다. 부르는 쪽이 실패와 취소를 갈라야 한다.
 *
 * @param url 인증 시작 주소
 * @param redirectUrl 넥슨에 등록한 돌아올 주소
 * @example const callbackUrl = await openAuthSession(started.authorizeUrl, REDIRECT_URI)
 */
export function openAuthSession(url: string, redirectUrl: string): Promise<string | null> {
  return getBrowserPort().openAuthSession(url, redirectUrl)
}
