import { getBrowserPort } from './ports'

/**
 * 앱 안에서 웹 문서를 여는 창. 로그인 화면의 바깥 링크 셋이 부른다.
 *
 * 시스템 브라우저(`Linking.openURL`)와 갈리는 자리다. 한 화면에 두 방식이 섞이면 같은 크기 같은
 * 색의 링크가 하나는 앱을 떠나고 둘은 안 떠나, 누르기 전에 어느 쪽인지 알 수 없다.
 *
 * **넥슨 로그인 창은 이것이 아니다.** 그쪽은 `openAuthSessionAsync` 라 콜백 URL 이 그 세션에만
 * 돌아온다.
 *
 * @param url 열 주소
 * @example openInAppBrowser('https://openapi.nexon.com')
 */
export function openInAppBrowser(url: string): void {
  // 기다리지 않고 삼킨다. 못 여는 기기에서 거절이 흘러나가면 누름 하나가 처리되지 않은 거부로
  // 남는데, 링크를 못 연 것과 별개로 화면은 그대로 서 있어야 한다.
  //
  // 포트가 안 꽂힌 것은 그대로 던진다. 그것은 배선 사고이지 이 기기에서 못 연다가 아니다.
  void getBrowserPort()
    .open(url)
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
