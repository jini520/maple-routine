/**
 * 끌기 핸들. `선택됨` 층 행의 왼쪽. **아래 층에는 없다**(그쪽 순서는
 * 사용자 것이 아니라 레벨 내림차순이라 끌 대상이 아니다).
 *
 * 글리프는 채운 점 2×3(lucide `GripVertical`)이다. lucide 의 점은 반지름 1 의 선이라, 안을 채우고 선 굵기
 * 1.5 를 더해 반지름 1.75 로 키운다. 채움 색은 테마 값을 프롭으로 넘긴다. lucide 가 `Svg` 에 `color` 를
 * 안 넘겨 `currentColor` 는 검정이 된다.
 *
 * 끌기 제스처 자체는 여기 없다. 그것은 **목록**의 일이고(자동 스크롤·자리 계산), 이 파일은 잡는
 * 자리만 그린다. 아이콘에는 `testID` 가 안 통해 감싸는 `View` 가 그것을 갖는다(`atoms/Icon/lucide.ts`).
 */
import { View } from 'react-native'

import { GripVerticalIcon } from '../../atoms'
import { useThemeAppearance } from '../../../theme/context'

export function DragHandle(): React.JSX.Element {
  const { definition } = useThemeAppearance()

  return (
    <View testID="drag-handle" accessibilityLabel="순서 변경" className="shrink-0 px-0.5 py-2">
      <GripVerticalIcon className="h-[18px] w-[18px] text-text-muted" fill={definition.textMuted} strokeWidth={1.5} aria-hidden />
    </View>
  )
}
