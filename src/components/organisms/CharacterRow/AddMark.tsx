// 후보 행 오른쪽의 `＋`. **버튼이 아니라 이 카드는 누르면 추가된다 는 표시**다(
// 결정 3). 실제 탭 영역은 행 전체이므로 여기에 `Pressable` 을 두면 같은 동작을 하는 히트 영역이
// 겹쳐 둘이 된다.
//
// **대표 색을 쓰지 않는다.** 색을 얹으면 화면에서 가장 눈에 띄는 것이 **추가** 아이콘 여러 개가 되고,
// 정작 한 번만 고르는 대표 별(결정 4)과 색이 겹친다.
//
// 아이콘에는 `testID` 가 안 통한다(lucide 가 `data-testid` 로 바꿔 넘긴다. `atoms/Icon/lucide.ts`). 감싸는
// `View` 가 그것을 갖는다.
import { View } from 'react-native'

import { PlusIcon } from '../../atoms'

export function AddMark(): React.JSX.Element {
  return (
    <View testID="add-mark" className="shrink-0 px-1">
      <PlusIcon className="h-5 w-5 text-text-muted" strokeWidth={2} aria-hidden />
    </View>
  )
}
