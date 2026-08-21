// 요구 레벨에 못 미치는 항목의 배지 ([[ADR-162]] 결정 3).
//
// ## 왜 `Badge` atom 이 아닌가
//
// 그 atom 이 덮는 것은 `*-tint`/`*-ink` **쌍**을 쓰는 조합뿐이고, 토큰 쌍이 아닌 것
// (`bg-surface-2` 위의 `text-text-muted`)은 «호출부마다 예외» 를 막으려고 일부러 밖에 뒀다
// (`Badge.tsx` 머리말). 이 배지가 정확히 그 조합이라 **따로 선다.**
//
// ## 이 배지의 뜻
//
// **상태 배지를 대체한다** — 진행할 수 없는 항목의 «완료/n회/n층» 은 뜻이 없다(그 값은 게임이 준
// 스냅샷이지 이 캐릭터가 할 수 있다는 뜻이 아니다). 배지가 늘지 않고 **바뀌기만** 하므로 좁은
// 카드에서 줄바꿈이 생기지 않는다.
//
// **막는 배지가 아니다** — 카드는 그대로 눌리고 수동 추적에서도 고를 수 있다([[ADR-055]] 정정 2 가
// 폐기한 잠금은 되살아나지 않았다). 이 배지가 말하는 것은 «지금 이 캐릭터로는 못 한다» 하나다.
//
// 색이 «완료»(secondary) 나 강조색이 아니라 **눌린 회색**인 것도 그래서다 — 실패도 경고도 아니고,
// 그저 이 캐릭터의 차례가 아니라는 사실이다.
import { View } from 'react-native'

import { Text } from '../Text/Text'

export function BlockedBadge(): React.JSX.Element {
  return (
    <View className="shrink-0 rounded-full bg-surface-2 px-2 py-[3px]">
      <Text fixed className="text-[11px] font-semibold text-text-muted">
        진행 불가
      </Text>
    </View>
  )
}
