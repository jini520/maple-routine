/**
 * 금액 칸 — 자릿수 전체가 **주 표기**이고 억/만은 보조 줄이다([[ADR-124]] 결정 5).
 *
 * 억/만으로 접어 보여줬더니 한 자를 칠 때마다 `3억` → `32억` → `3억 2,000만` 처럼 단위가
 * 갈아엎여 **지금 무엇을 치고 있는지 안 읽혔다.** 원시 표기는 왼쪽으로 자라기만 하므로 흔들림이
 * 없고, 앱의 다른 금액 표기와도 같다([[ADR-046]]). 억/만 환산은 자릿수를 눈으로 세지 않게 해 주는
 * 값이라 **작게 아래에** 남긴다.
 *
 * `DropPricePad` 에서 꺼냈다 — 사유는 `MesoKeypad` 파일 머리와 같다.
 */
import { Pressable, View } from 'react-native'

import { formatMesoUnits } from '../../../lib/drop-price'
import { RotateCcwIcon } from '../../../lib/icons'
import { MESO_QUICK_ADDS } from '../../../lib/meso-quick-adds'
import { TABULAR_NUMS } from '../../../lib/text-styles'
import { Text } from '../../atoms/Text/Text'
import { MAX_MESO } from './meso-pad'

export function MesoAmountField(props: {
  meso: number
  onChange: (next: number) => void
  /** 테스트와 스크린리더가 이 칸을 집는 이름 — 부르는 자리마다 다르다(가격 · 금액). */
  resetLabel: string
  amountTestID: string
}): React.JSX.Element {
  return (
    <View>
      {/* 초기화는 **금액 왼쪽**이다(2026-08-10 사용자 요청). 키패드 자리를 안 뺏고(⌫ 는 한 자씩
          지우는 별개 동작이라 남는다), 고칠 대상인 숫자 바로 옆이라 겨냥이 자명하다. 값이 0 이면
          지울 것이 없으므로 **자리만 지킨다** — 없애면 금액이 좌우로 흔들린다. */}
      <View className="mt-5 flex-row items-center justify-end gap-1.5 border-b border-border pb-1.5">
        <Pressable
          role="button"
          onPress={() => props.onChange(0)}
          aria-label={props.resetLabel}
          // 웹 `invisible` 의 짝 — RN 에 `visibility` 가 없어 투명도로 대신하고, 투명한 버튼이
          // 눌리지 않도록 터치를 함께 끈다.
          pointerEvents={props.meso === 0 ? 'none' : 'auto'}
          className={`mr-auto h-7 flex-row items-center gap-1 rounded-full border border-border px-2.5 active:bg-surface-2${
            props.meso === 0 ? ' opacity-0' : ''
          }`}
        >
          <RotateCcwIcon className="h-3 w-3 text-text-muted" strokeWidth={2.5} aria-hidden />
          <Text className="text-[11px] font-semibold text-text-muted">초기화</Text>
        </Pressable>
        <Text
          testID={props.amountTestID}
          className={`text-[32px] font-bold leading-none tracking-[-.03em] ${
            props.meso === 0 ? 'text-text-disabled' : 'text-text'
          }`}
          style={TABULAR_NUMS}
        >
          {props.meso.toLocaleString()}
        </Text>
        <Text className="text-sm font-semibold text-text-muted">메소</Text>
      </View>

      {/* 항상 자리를 지킨다 — 0 에서 사라지면 첫 타건에 아래가 통째로 밀린다. */}
      <Text className="mt-1.5 min-h-4 text-right text-[11px] text-text-muted" style={TABULAR_NUMS}>
        {props.meso > 0 ? formatMesoUnits(props.meso) : ''}
      </Text>

      {/* 다섯 개가 390px 한 줄에 들어가도록 여백·글자를 한 단계 줄였다. `flex-wrap` 은 안전장치다 —
          더 좁은 기기에서는 넘치는 대신 줄을 바꾼다. 값은 `lib/meso-quick-adds` 가 든다 —
          아이템 분배 계산기도 같은 눈금을 쓴다([[ADR-168]] 결정 9). */}
      <View className="mt-2 flex-row flex-wrap justify-end gap-1.5">
        {MESO_QUICK_ADDS.map((quick) => (
          <Pressable
            key={quick.label}
            role="button"
            onPress={() => props.onChange(Math.min(MAX_MESO, props.meso + quick.value))}
            className="h-7 justify-center rounded-full border border-border px-2.5 active:bg-surface-2"
          >
            <Text className="text-[11px] font-semibold text-text-muted" style={TABULAR_NUMS}>
              {quick.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
