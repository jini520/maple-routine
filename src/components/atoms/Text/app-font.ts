/**
 * 앱 전체가 쓰는 글꼴과 글자 상자의 기본값. `Text` 와 `TextInput` 이 같이 쓴다.
 *
 * 값을 여기 두는 이유는 `font-scaling.ts` 와 같다. 컴포넌트 파일에서 상수를 더 내보내면
 * `react-refresh` 규칙에 걸린다.
 */

import { Platform } from 'react-native'

/**
 * 두 플랫폼이 같은 글꼴을 본다. iOS 는 Pretendard 가변 파일 하나, 안드로이드는 정적 4굵기다.
 * 안드로이드에 가변 파일을 못 쓰는 것은 `expo-font` 플러그인이 `fontVariationSettings` 를
 * 안 내보내기 때문이다. 손으로 XML 을 고치면 `expo prebuild` 가 지운다.
 *
 * 값은 등록한 패밀리 이름이다. iOS 는 폰트 안의 Family 이름이고, 안드로이드는
 * `MainApplication.kt` 의 `addCustomFont` 에 준 문자열이다. 둘은 함께 바뀌어야 한다.
 */
export const APP_FONT_FAMILY = Platform.OS === 'ios' ? 'Pretendard Variable' : 'Pretendard'

/**
 * `includeFontPadding` 은 안드로이드 전용이고 기본이 `true` 다. 글꼴의 ascent/descent 만큼 여백을 더
 * 붙여서, 줄 높이를 명시해도 안드로이드만 커진다. 끄면 줄 높이가 상자를 그대로 정한다.
 */
export const BASE_TEXT_STYLE = { fontFamily: APP_FONT_FAMILY, includeFontPadding: false } as const
