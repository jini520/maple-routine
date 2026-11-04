/**
 * 문의용 카카오톡 오픈채팅방 주소 둘과 여는 순서.
 */
import { Linking } from 'react-native'

import { openInAppBrowser } from '../../native/browser'

/** 방의 웹 주소. 카카오톡이 없는 기기가 보는 안내 페이지이고, 거기에 카카오톡 설치 버튼이 있다 */
export const OPEN_CHAT_WEB_URL = 'https://open.kakao.com/o/sbxo2RHi'

/**
 * 카카오톡의 그 방을 바로 여는 주소. 안내 페이지의 참여 버튼이 쓰는 주소를 옮겼다.
 *
 * `open.kakao.com` 은 앱이 받는 링크가 아니라서 웹 주소로 열면 브라우저를 한 번 거친다. 카카오 문서에 없는
 * 형식이라, 바뀌면 카카오톡은 열려도 방으로 가지 않고 앱은 그것을 실패로 알 수 없다.
 */
export const OPEN_CHAT_APP_URL = 'kakaoopen://join?l=sbxo2RHi&r=EW'

/** 카카오톡으로 방을 열고, 카카오톡이 없어 거절되면 안내 페이지를 인앱 브라우저로 여는 함수 */
export function openContactOpenChat(): void {
  void Linking.openURL(OPEN_CHAT_APP_URL).catch(() => openInAppBrowser(OPEN_CHAT_WEB_URL))
}
