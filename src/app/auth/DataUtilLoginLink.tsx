/**
 * 넥슨 버튼 아래의 `게임 데이터 활용 로그인이란?` 링크. 로그인 화면과 연동 시트가 함께 쓴다.
 *
 * @see docs/features/auth.md 넥슨 로그인
 */
import { Pressable } from 'react-native'

import { ExternalLinkIcon, Text } from '../../components/atoms'
import { openInAppBrowser } from '../../native/browser'

/**
 * 넥슨이 `게임 데이터 활용 로그인` 을 설명하는 곳. 그 다섯 문장을 앱이 싣지 않고 여기로 보낸다.
 * 넥슨이 문구를 고치면 앱을 안 고쳐도 따라간다.
 */
const DATA_UTIL_LOGIN_URL = 'https://openapi.nexon.com/ko/data-util/introduction/'

export function DataUtilLoginLink(): React.JSX.Element {
  return (
    // 글자 폭만큼만 차지한다. 줄 전체로 늘리면 옆 빈 자리를 눌러도 반응해 어디까지가 링크인지 알 수 없다.
    <Pressable
      role="link"
      onPress={() => openInAppBrowser(DATA_UTIL_LOGIN_URL)}
      className="flex-row items-center gap-1 self-center px-3 py-0.5"
    >
      <Text className="text-xs font-semibold text-primary-ink">게임 데이터 활용 로그인이란?</Text>
      <ExternalLinkIcon className="h-3.5 w-3.5 text-primary-ink" aria-hidden />
    </Pressable>
  )
}
