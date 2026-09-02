import { Appearance } from 'react-native'

import type { ColorSchemePort } from '../ports'

/**
 * `ColorSchemePort` 의 RN 구현(— 밖으로 나가는 시그니처는 Capacitor 구현과 한
 * 글자도 다르지 않다). 정책은(2026-07-14 시스템 다크 모드 연동) ·.
 *
 * **"OS가 지금 무엇인가"는 플랫폼마다 묻는 법이 다르다** — 웹뷰는 `matchMedia('(prefers-color-scheme:
 * dark)')`, RN 은 `Appearance` 다. 그 차이가 정확히 이 포트가 존재하는 이유이고, 그래서 이 파일에
 * 있는 것은 그 한 줄뿐이다.
 *
 * `Appearance.getColorScheme()` 은 **`null` 을 돌려줄 수 있다**(네이티브 Appearance 모듈이 없거나 OS가
 * 판정을 주지 않은 경우 — `Appearance.js:76-91`). 그때는 라이트로 읽는다: Capacitor 구현이
 * `matchMedia` 부재에 내린 것과 같은 판단이고, 모르는 것을 다크로 읽으면 **저장된 테마가 없는 첫
 * 실행이 통째로 다크로 열린다**. `=== 'dark'` 비교 하나가 `'light'`·`null`·`undefined` 셋을 함께
 * 라이트로 접는다.
 *
 * **구독 API 는 두지 않는다**(포트 주석의 판단 그대로). 이 값은 저장된 테마가 없을 때의 **1회성
 * 판정**에만 쓰이고 실행 중 OS 설정 변경은 따라가지 않는다 — `Appearance` 에
 * `addChangeListener` 가 있어도 부를 곳이 없으므로, 여기 넣으면 구현마다 죽은 코드가 된다.
 */
export const rnColorSchemePort: ColorSchemePort = {
  get: () => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'),
}
