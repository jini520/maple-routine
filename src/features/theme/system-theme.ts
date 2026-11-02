/**
 * 저장된 테마가 없을 때 OS 의 밝기 설정으로 고르는 기본 테마.
 *
 * 테마 스토어와 부팅 스플래시가 쓴다. 스플래시는 테마를 복원하기 전에 뜨므로 스토어를 거치지 않고 이것으로
 * 색을 고른다. 스토어와 다른 파일에 둔 것은 셸 테스트가 스토어를 통째로 목으로 바꾸기 때문이다.
 *
 * OS 다크모드 설정 변경을 앱 실행 중 실시간으로 반영하지는 않는다. OS 가 지금 무엇인가 는 플랫폼마다 묻는 법이
 * 달라 포트가 답한다.
 */
import { DEFAULT_DARK_THEME, DEFAULT_THEME } from '../../lib/theme/theme-registry'
import { getColorSchemePort } from '../../native/ports'
import type { ThemeName } from '../../types'

export function resolveSystemTheme(): ThemeName {
  return getColorSchemePort().get() === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_THEME
}
