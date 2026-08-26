/**
 * 빠른 금액 칩 — **키보드 위**에만 뜬다([[ADR-173]] 결정 4).
 *
 * 폼에서 내보낸 이유는 [[ADR-170]] 정정 6 이 «저장과 이웃한다» 로 겪은 그것이다. 자리를 옮겨
 * 봐야 폼 안에 있는 한 무언가와 이웃하므로, **폼의 일부가 아니라 입력 도구**로 다시 놓는다 —
 * 금액 칸에 커서가 있을 때만 나타나고, 손가락이 키보드에 있는 동안 바로 위에 있다.
 *
 * **시트의 마지막 자식**이다([[ADR-173]] 결정 4 정정). 라이브러리의 `footerComponent` 를 쓰려
 * 했는데 그 슬롯은 `position: absolute` 라 `enableDynamicSizing` 인 이 시트에서는 콘텐츠 위로
 * 겹치거나 자리를 못 잡는다(실기에서 «칩이 사라졌다» 로 났다). 시트가 키보드 위로 올라가므로
 * ([[ADR-170]] 정정 5) 마지막 자식이면 그대로 **키보드 바로 위**다 — 보정할 기하가 없다.
 *
 * 좌우로 번지고(`-mx-4`) 표면색이 갈리는 것이 «폼의 한 줄이 아니다» 를 말한다.
 *
 * OS 숫자 키보드에는 `00` 이 없어 억 단위를 치려면 0 을 여덟 번 눌러야 한다([[ADR-124]] 결정 5 가
 * 걱정한 «0 을 세게 된다» 가 그것이다) — 이 줄이 그 자리를 막는다.
 *
 * 값은 `lib/meso-quick-adds` 가 든다 — 아이템 분배 계산기도 같은 눈금을 쓴다([[ADR-168]] 결정 9).
 */
import { Pressable, View } from 'react-native'

import { Text } from '../../components/atoms/Text/Text'
import { MAX_MESO } from '../../components/molecules/MesoPad/meso-pad'
import { MESO_QUICK_ADDS } from '../../lib/meso-quick-adds'
import { TABULAR_NUMS } from '../../lib/text-styles'

export function QuickAddBar(props: {
  value: number
  onChange: (next: number) => void
}): React.JSX.Element {
  return (
    <View
      testID="quick-add-bar"
      // 시트 본문과 **다른 띠**로 보여야 한다 — 폼의 한 줄이 아니라 키보드에 붙은 도구다.
      className="-mx-4 mt-1 flex-row justify-center gap-1.5 border-t border-border bg-surface-2 px-3 py-2.5"
    >
      {MESO_QUICK_ADDS.map((quick) => (
        <Pressable
          key={quick.label}
          role="button"
          aria-label={quick.label}
          // **상한은 여기서 지킨다** — 더하는 자리가 하나뿐이라 부르는 쪽마다 되풀이할 이유가
          // 없다. 규칙은 `applyMesoKey` 와 같다(넘기면 안 먹는다).
          onPress={() => props.onChange(Math.min(MAX_MESO, props.value + quick.value))}
          className="h-7 justify-center rounded-full border border-border bg-surface px-2.5 active:bg-surface-2"
        >
          <Text className="text-[11px] font-semibold text-text-muted" style={TABULAR_NUMS}>
            {quick.label}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}
