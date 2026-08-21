// 끌기 핸들 — 「선택됨」 층 행의 왼쪽([[ADR-144]] 결정 5). **아래 층에는 없다**(그쪽 순서는
// 사용자 것이 아니라 레벨 내림차순이라 끌 대상이 아니다).
//
// **글리프는 가로 3줄(lucide `Menu`)이지만 여기서 메뉴를 뜻하지 않는다** — 뜻은 자리(행 왼쪽)와
// 접근성 이름(「순서 변경」)이 진다. 점 격자(`GripVertical` 류)보다 선이 굵고 가로로 길어 잡는
// 면적이 넓다.
//
// 끌기 제스처 자체는 여기 없다 — 그것은 **목록**의 일이고(자동 스크롤·자리 계산), 이 파일은 잡는
// 자리만 그린다. 아이콘에는 `testID` 가 안 통해 감싸는 `View` 가 그것을 갖는다(`lib/icons.ts`).
import { View } from 'react-native'

import { MenuIcon } from '../../../lib/icons'

export function DragHandle(): React.JSX.Element {
  return (
    <View testID="drag-handle" accessibilityLabel="순서 변경" className="shrink-0 px-1 py-2">
      <MenuIcon className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
    </View>
  )
}
