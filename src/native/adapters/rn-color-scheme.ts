import { Appearance } from 'react-native'

import type { ColorSchemePort } from '../ports'

/**
 * `ColorSchemePort` 의 RN 구현.
 *
 * OS 가 지금 무엇인가 는 플랫폼마다 묻는 법이 달라서 이 포트가 있다. RN 은 `Appearance` 다.
 *
 * `Appearance.getColorScheme()` 은 `null` 을 돌려줄 수 있다(네이티브 Appearance 모듈이 없거나
 * OS 가 판정을 주지 않은 경우). 그때는 라이트로 읽는다. 모르는 것을 다크로 읽으면 저장된 테마가
 * 없는 첫 실행이 통째로 다크로 열린다. `=== 'dark'` 비교 하나가 `'light'`·`null`·`undefined`
 * 셋을 함께 라이트로 접는다.
 *
 * 구독 API 는 두지 않는다. 이 값은 저장된 테마가 없을 때의 1회성 판정에만 쓰이고 실행 중 OS
 * 설정 변경은 따라가지 않는다. 넣으면 구현마다 죽은 코드가 된다.
 */
export const rnColorSchemePort: ColorSchemePort = {
  get: () => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'),
}
