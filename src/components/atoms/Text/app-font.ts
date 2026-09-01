// 앱 전체가 쓰는 글꼴과 글자 상자의 기본값([[ADR-196]]). `Text` 와 `TextInput` 이 같이 쓴다.
//
// 값을 여기 두는 이유는 `font-scaling.ts` 와 같다. 컴포넌트 파일에서 상수를 더 내보내면
// `react-refresh` 규칙에 걸린다.

import { Platform } from 'react-native'

/**
 * 두 플랫폼이 같은 글꼴을 봐야 같은 코드가 같은 크기로 그려진다. 가변 폰트 하나를 쓰는데 **가리키는
 * 이름이 다르다.** iOS 는 폰트 안의 Family 이름이고, 안드로이드는 `res/font/xml_pretendard.xml` 패밀리의
 * 리소스 이름이다([[ADR-196]] 결정 2).
 */
export const APP_FONT_FAMILY = Platform.OS === 'ios' ? 'Pretendard Variable' : 'Pretendard'

/**
 * `includeFontPadding` 은 안드로이드 전용이고 기본이 `true` 다. 글꼴의 ascent/descent 만큼 여백을 더
 * 붙여서, 줄 높이를 명시해도 안드로이드만 커진다. 끄면 줄 높이가 상자를 그대로 정한다([[ADR-196]]).
 */
export const BASE_TEXT_STYLE = { fontFamily: APP_FONT_FAMILY, includeFontPadding: false } as const
