/**
 * 페이지 헤더의 제목 덩어리. 제목 줄과 그 아래 갱신 시각 줄이 한 벌이다.
 *
 * 줄이 `items-center` 라 가장 높은 자식이 높이를 정하는데, 함께 서는 것이 화면마다 달라 제목이
 * 최대 4px 씩 어긋난다. `min-h-8` 로 바닥만 정한다.
 *
 * 고정 높이로 바꾸지 말 것. 지금 36px 인 두 줄의 ← 가 잘리고, 앞으로 더 큰 것이 들어올 때마다
 * 이 값이 그것을 조용히 깎는다.
 *
 * 갱신 시각 줄을 여기서 그리는 것은 **자리를 화면이 고르면 화면마다 다른 자리를 고르기**
 * 때문이다. 실제로 그랬다. 값이 없는 화면도 그 줄을 빈 채로 그려 높이가 같아진다.
 *
 * 줄의 나머지(`justify-between` · `gap-2`)는 화면마다 달라서 `className` 으로 받는다. 그것은
 * 제목 줄의 몫이라 덩어리가 아니라 안쪽 줄에 붙는다. 헤더 셸을 안 쓰는 화면(설정 · 빈 상태
 * 가지)도 이 덩어리만 따로 쓴다.
 */
import { View } from 'react-native'

import { DataFreshness } from '../../molecules/DataFreshness/DataFreshness'

/** 줄의 바닥(px). `min-h-8`. 테스트가 클래스가 아니라 이 값으로 단언한다. */
export const PAGE_HEADER_TITLE_ROW_MIN_H = 32

export interface PageHeaderTitleRowProps {
  children: React.ReactNode
  /** 화면마다 다른 몫. `justify-between` · `gap-2` 등. 바닥(최소 높이)은 여기서 못 바꾼다. */
  className?: string
  /**
   * 제목 아래 줄에 적을 데이터 갱신 시각(ISO 8601). 안 주면 글자만 비고 자리는 그대로다.
   * 없는 시각을 지어 적지 말 것 - 그 줄은 실시간 조회를 받은 화면만 채운다.
   */
  fetchedAt?: string | null
}

export function PageHeaderTitleRow({
  children,
  className,
  fetchedAt,
}: PageHeaderTitleRowProps): React.JSX.Element {
  return (
    // 덩어리에 `gap` 이 없다. `min-h-8` 이 제목 글자 아래에 이미 여백을 남겨서, 간격을 더하면
    // 갱신 시각이 제목에 딸린 글씨로 안 읽힌다.
    <View testID="page-header-title-block">
      <View
        testID="page-header-title-row"
        className={`min-h-8 flex-row items-center${className === undefined ? '' : ` ${className}`}`}
      >
        {children}
      </View>

      <DataFreshness fetchedAt={fetchedAt ?? null} />
    </View>
  )
}
