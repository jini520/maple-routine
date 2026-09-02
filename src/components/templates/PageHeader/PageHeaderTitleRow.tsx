/**
 * 페이지 헤더의 제목 줄. 세로 위치를 화면마다 같게 맞추는 프리미티브.
 *
 * 줄이 `items-center` 라 가장 높은 자식이 높이를 정하는데, 함께 서는 것이 화면마다 달라 제목이
 * 최대 4px 씩 어긋났다. `min-h-8` 로 바닥만 정한다.
 *
 * **고정 높이로 바꾸지 말 것.** 지금 36px 인 두 줄의 ← 가 잘리고, 앞으로 더 큰 것이 들어올 때마다
 * 이 값이 그것을 조용히 깎는다.
 *
 * 줄의 나머지(`justify-between` · `gap-2`)는 화면마다 달라서 `className` 으로 받는다. 헤더 셸을
 * 안 쓰는 화면(설정 · 빈 상태 가지)도 이 줄만 따로 쓴다.
 */
import { View } from 'react-native'

/** 줄의 바닥(px). `min-h-8`. 테스트가 클래스가 아니라 이 값으로 단언한다. */
export const PAGE_HEADER_TITLE_ROW_MIN_H = 32

export interface PageHeaderTitleRowProps {
  children: React.ReactNode
  /** 화면마다 다른 몫. `justify-between` · `gap-2` 등. 바닥(최소 높이)은 여기서 못 바꾼다. */
  className?: string
}

export function PageHeaderTitleRow({
  children,
  className,
}: PageHeaderTitleRowProps): React.JSX.Element {
  return (
    <View
      testID="page-header-title-row"
      className={`min-h-8 flex-row items-center${className === undefined ? '' : ` ${className}`}`}
    >
      {children}
    </View>
  )
}
