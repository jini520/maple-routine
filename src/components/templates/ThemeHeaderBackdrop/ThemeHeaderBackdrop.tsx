import { useThemeStore } from '../../../features/theme/store'
import { getThemeDefinition } from '@core/lib/theme-registry'

/**
 * 페이지 상단 sticky/fixed 헤더가 덮는 자리에 **테마 배경 이미지 조각**을 그린다
 * ([[ADR-088]] 결정 5-1).
 *
 * 헤더는 불투명해야 한다 — 반투명하게 열면 배경만이 아니라 **그 밑으로 스크롤된 카드까지**
 * 비친다(사용자 반려). 그래서 헤더를 여는 대신, 헤더가 자기 자리에 해당하는 그림을 직접 그려
 * 백드롭과 이어 붙인다. 정렬은 조각을 **뷰포트 크기**로 그리고 래퍼가 잘라내는 방식으로 보장한다
 * (`cover` 는 그리는 상자 기준이라 헤더 상자에 주면 배율이 어긋난다). 실제 배색은 `index.css` 의
 * `.theme-header-backdrop` 이 `.theme-backdrop` 과 **같은 선언을 공유**해 그린다.
 *
 * 헤더 안에서 **다른 형제보다 먼저** 놓아야 한다(`z-index: -1` 이라 순서는 그림에 영향을 주지
 * 않지만, 읽는 사람에게 이게 배경임을 알리는 자리다).
 */
export function ThemeHeaderBackdrop(): React.JSX.Element | null {
  const theme = useThemeStore((state) => state.theme)

  if (getThemeDefinition(theme).background === undefined) {
    return null
  }

  return <div className="theme-header-backdrop" data-testid="theme-header-backdrop" aria-hidden="true" />
}
