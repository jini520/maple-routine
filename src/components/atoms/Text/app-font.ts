/**
 * 앱 전체가 쓰는 글꼴과 글자 상자의 기본값. `Text` 와 `TextInput` 이 같이 쓴다.
 *
 * 값을 여기 두는 이유는 `font-scaling.ts` 와 같다. 컴포넌트 파일에서 상수를 더 내보내면
 * `react-refresh` 규칙에 걸린다.
 */

import { Platform } from 'react-native'

/**
 * **플랫폼마다 글꼴이 다르다.** iOS 는 Pretendard 가변 폰트, 안드로이드는 Noto Sans KR 이다.
 *
 * 원래 둘 다 Pretendard 였는데 안드로이드에서 **한글 라벨의 뒷 음절이 사라졌다**(`주간` 이 `주` 로).
 * 잰 폭보다 넓게 그려 마지막 음절이 다음 줄로 넘어가고, 한 줄 높이 상자가 그 줄을 가린다. 넣는
 * 방식(빌드 시점 패밀리 · 파일 직접 지목 · `useFonts` 런타임)을 셋 다 시험했지만 Pretendard 면
 * 전부 잘렸고, 같은 방식으로 넣은 Noto Sans KR 은 안 잘렸다.
 *
 * 값은 등록한 패밀리 이름이다. iOS 는 폰트 안의 Family 이름이고, 안드로이드는
 * `MainApplication.kt` 의 `addCustomFont` 에 준 문자열이다. 둘은 함께 바뀌어야 한다.
 */
export const APP_FONT_FAMILY = Platform.OS === 'ios' ? 'Pretendard Variable' : 'Noto Sans KR'

/**
 * `includeFontPadding` 은 안드로이드 전용이고 기본이 `true` 다. 글꼴의 ascent/descent 만큼 여백을 더
 * 붙여서, 줄 높이를 명시해도 안드로이드만 커진다. 끄면 줄 높이가 상자를 그대로 정한다.
 */
export const BASE_TEXT_STYLE = { fontFamily: APP_FONT_FAMILY, includeFontPadding: false } as const
