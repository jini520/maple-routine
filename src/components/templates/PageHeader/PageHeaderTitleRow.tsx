// 페이지 헤더의 **제목 줄** —.
//
// ## 왜 줄에 프리미티브가 필요한가
//
// 셸(`PageHeader`)은 모든 화면이 같은데도 **제목의 세로 위치가 화면마다 달랐다**(사용자 관측
// 2026-08-17 — *"탭을 이동할 때마다 title 행 위치가 좀 달라"*). 원인은 여백이 아니라 줄 높이다:
// 줄이 `items-center` 라 **가장 높은 자식이 높이를 정하고** 제목(줄높이 28)은 그 안에서 세로
// 중앙에 앉는데, 함께 서는 것이 화면마다 달랐다.
//
// ```
//   없음(제목만)              28  →  제목 +0
//   ← (p-1 + 아이콘 20)       28  →  제목 +0
//   글자 링크(text-sm)        20  →  제목 +0
//   새로고침(p-2 + 아이콘 16) 32  →  제목 +2      ← 컨텐츠·보스 스케줄러
//   ← (h-9 w-9)               36  →  제목 +4      ← 히스토리·가격 기록
// ```
//
// ## `최소`다 — 고정이 아니다 (사용자 지시)
//
// 바닥만 정하고 **위는 막지 않는다.** 고정 높이(`h-8`)로 두면 지금 36인 두 줄의 ← 가 잘리고,
// 앞으로 줄에 더 큰 것이 들어올 때마다 이 값이 그것을 조용히 깎는다. 그래서 `min-h-8` 이고,
// 36 짜리 두 자리는 **여전히 36 이다**(정정 1 이 그 잔여를 기록한다 — 아이콘 버튼 크기가 셋으로
// 갈려 있는 것은 이 값보다 넓은 문제다).
//
// 32 를 고른 근거는 **지금 되풀이되는 가장 큰 과녁** 이다 — 새로고침 버튼(`p-2` + 아이콘 16). 그래서
// 스케줄러 두 화면은 한 픽셀도 안 움직이고 나머지가 그 선으로 내려온다.
//
// ## 줄의 나머지는 호출부가 정한다
//
// `justify-between`(오른쪽에 링크가 있는 화면)이나 `gap-2`(← 옆에 제목이 붙는 화면)는 화면마다
// 다르다. 그것까지 여기서 정하면 호출부가 줄을 다시 손으로 그리게 되므로, 바닥만 정하고 나머지는
// `className` 으로 받는다.
//
// ## `PageHeader` 를 안 쓰는 화면도 이 줄을 쓴다
//
// 설정(헤더 없이 `ScreenScroll` 이 상자를 내린다)과 스케줄러·수익의 **빈 상태 가지**(헤더 셸 대신
// `flex-1 p-4`)도 같은 제목 줄을 손으로 그린다. 그쪽을 빼면 같은 어긋남이 그대로 남으므로 함께
// 쓴다 — 이 프리미티브가 셸이 아니라 **줄**인 이유다.
import { View } from 'react-native'

/** 줄의 바닥(px) — `min-h-8`. 테스트가 클래스가 아니라 이 값으로 단언한다. */
export const PAGE_HEADER_TITLE_ROW_MIN_H = 32

export interface PageHeaderTitleRowProps {
  children: React.ReactNode
  /** 화면마다 다른 몫 — `justify-between` · `gap-2` 등. 바닥(최소 높이)은 여기서 못 바꾼다. */
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
