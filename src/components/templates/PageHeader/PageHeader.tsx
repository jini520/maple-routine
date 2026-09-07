/**
 * 화면 상단 헤더 셸. 스케줄러 계열 화면이 글자까지 같은 마크업을 복붙하던 자리를 하나로 모은 것.
 *
 * 상단 안전영역을 먹는 쪽이 이 헤더다. `ScreenScroll` 은 헤더가 있으면 그 위쪽을 안 건드린다.
 * 값은 `insets.top` 이 아니라 `useTopSafeAreaPx()` 로 받는다. 안드로이드 하한이 그 안에 있어야
 * 헤더 여백과 `safe-area-fade.ts` 의 페이드 길이가 같은 값을 본다.
 *
 * 경계 페이드와 상수 여백은 두지 않는다. 헤더가 함께 스크롤돼 덮어 줄 경계가 없다.
 */
import { View } from 'react-native'

import { useTopSafeAreaPx } from '../../../lib/safe-area'

export interface PageHeaderProps {
  /** 헤더 내용. 안에서 `gap-4` 로 세로 간격이 잡힌다. */
  children: React.ReactNode
  /**
   * 헤더 바로 아래 띠(`top-full`)에 겹쳐 그릴 것. 당겨서 새로고침 인디케이터가 이 자리를 쓴다.
   * `children` 에 섞으면 `gap-4` 흐름 자식이 되어 위치가 달라진다.
   */
  below?: React.ReactNode
  /**
   * 갱신 시각 줄을 화면이 **자기 자리에** 그리는가. 안 적으면 거짓.
   *
   * 거짓이면 이 셸이 그 줄 높이(16)만큼을 바닥에 비워 둔다. 그래야 탭을 오갈 때 제목이 안 뛴다.
   * 그 줄을 가진 화면은 제목 바로 밑에 그리므로 여기서 또 비우면 32 가 된다.
   */
  ownsFreshnessLine?: boolean
}

/**
 * `DataFreshness` 한 줄의 높이. `text-11` 의 줄 높이와 **같은 값이어야 한다**.
 *
 * 클래스 문자열에는 보간을 못 하므로(NativeWind 는 빌드 때 읽는다) 같은 수를 두 곳에 적는다.
 * 갈리면 갱신 시각이 있는 헤더와 없는 헤더의 높이가 어긋난다.
 */
const FRESHNESS_LINE_HEIGHT_CLASS = 'h-4'

export function PageHeader(props: PageHeaderProps): React.JSX.Element {
  const topSafeAreaPx = useTopSafeAreaPx()

  return (
    <View testID="page-header" className="z-10 px-4 pb-2" style={{ paddingTop: topSafeAreaPx }}>

      <View className="gap-4">{props.children}</View>

      {/* 갱신 시각 줄이 없는 화면의 몫. 바깥 상자에 `gap` 이 없어 위 블록에 딱 붙는다. */}
      {props.ownsFreshnessLine === true ? null : (
        <View testID="page-header-freshness-reserve" className={FRESHNESS_LINE_HEIGHT_CLASS} />
      )}

      {props.below}
    </View>
  )
}
