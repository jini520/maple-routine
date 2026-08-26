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
import { Text, TextInput } from '../../atoms/Text/Text'
import { MAX_MESO, parseMesoText } from './meso-pad'

export function MesoAmountField(props: {
  meso: number
  onChange: (next: number) => void
  /** 테스트와 스크린리더가 이 칸을 집는 이름 — 부르는 자리마다 다르다(가격 · 금액). */
  resetLabel: string
  amountTestID: string
  /** 숫자 옆에 붙는 단위. 기본은 메소다. */
  unit?: string
  /**
   * 억/만 보조 줄과 빠른 칩을 그릴지 — **메소일 때만 뜻이 있다.**
   *
   * 메포·캐시는 자릿수가 작아 `+100만 ~ +100억` 칩이 쓸모없고(1만원짜리 캐시 지출에 «+100억» 이
   * 떠 있으면 안 된다), 억/만 환산도 그 단위에서는 틀린 말이다. **그쪽 칩 값은 아직 안 정했으므로**
   * ([[ADR-166]] 결정 8 열린 질문) 잘못된 칩을 세우는 대신 **안 세운다.**
   */
  mesoHelpers?: boolean
  /**
   * 칸에 **직접 칠 수 있는가** — OS 숫자 키보드가 뜬다([[ADR-170]] 정정 4).
   *
   * 기본은 **아니다**(읽기만 하는 글자). 앱 키패드가 값을 넣는 화면(`DropPricePad`)이 그쪽이고,
   * 그 화면은 키보드를 한 번도 안 부르는 것이 [[ADR-124]] 결정 5 의 이득이다.
   *
   * 켜는 자리는 **가계부의 지출·수입 시트** 둘이다 — 사용처 칸 때문에 어차피 키보드가 뜨므로
   * 안 불러서 아끼는 것이 없다.
   */
  editable?: boolean
  /**
   * 단위를 고르는 것 — **금액에 속하는 축**이라 여기 산다([[ADR-170]] 정정 6).
   *
   * 억/만 보조 줄과 **같은 줄**에 왼쪽으로 놓인다(그 줄은 11px 글자 하나라 거의 비어 있었다).
   * 지출 시트의 「기타」가 넘기는 통화 칩 셋이 유일한 호출부이고, **안 넘기면 그 줄은 전과
   * 한 픽셀도 안 다르다** — 드롭 판매가는 통화가 하나뿐이라 안 넘긴다.
   */
  unitPicker?: React.ReactNode
}): React.JSX.Element {
  const mesoHelpers = props.mesoHelpers ?? true
  const amountClass = `text-[32px] font-bold leading-none tracking-[-.03em] ${
    props.meso === 0 ? 'text-text-disabled' : 'text-text'
  }`
  return (
    <View testID={`${props.amountTestID}-field`}>
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
        {props.editable === true ? (
          /*
           * **0 일 때는 비운다** — 「0」 을 값으로 두면 그 뒤에 친 숫자가 그 0 에 붙어 자릿수가
           * 하나 는다(`0` + `1200` → `01200`). 자리표시자가 같은 자리에 같은 「0」 을 그리므로
           * 보이는 것은 전과 같다.
           *
           * 값이 콤마째 돌아오므로 다음 타건도 콤마째 들어온다 — 걷는 일은 `parseMesoText` 가 한다.
           */
          <TextInput
            testID={props.amountTestID}
            aria-label="금액"
            value={props.meso === 0 ? '' : props.meso.toLocaleString()}
            onChangeText={(text) => props.onChange(parseMesoText(props.meso, text))}
            keyboardType="number-pad"
            placeholder="0"
            // `flex-1 text-right` 로 **오른쪽 끝을 글자판과 같은 자리에** 둔다 — RN 의 `TextInput`
            // 은 내용에 맞춰 줄지 않아, 안 주면 폭이 제멋대로가 되고 단위(「메소」)가 밀린다.
            className={`flex-1 text-right ${amountClass}`}
            style={TABULAR_NUMS}
          />
        ) : (
          <Text testID={props.amountTestID} className={amountClass} style={TABULAR_NUMS}>
            {props.meso.toLocaleString()}
          </Text>
        )}
        <Text className="text-sm font-semibold text-text-muted">{props.unit ?? '메소'}</Text>
      </View>

      {/* 항상 자리를 지킨다 — 0 에서 사라지면 첫 타건에 아래가 통째로 밀린다. 단위 고르개가
          있으면 그 줄을 **나눠 쓴다**(왼쪽 고르개 · 오른쪽 억/만) — 높이는 칩에 맞춰 커진다. */}
      {(mesoHelpers || props.unitPicker !== undefined) && (
        <View
          className={`mt-1.5 flex-row items-center gap-2 ${
            props.unitPicker === undefined ? 'min-h-4' : 'min-h-7'
          }`}
        >
          {props.unitPicker}
          <Text className="ml-auto text-right text-[11px] text-text-muted" style={TABULAR_NUMS}>
            {mesoHelpers && props.meso > 0 ? formatMesoUnits(props.meso) : ''}
          </Text>
        </View>
      )}

      {/* 다섯 개가 390px 한 줄에 들어가도록 여백·글자를 한 단계 줄였다. `flex-wrap` 은 안전장치다 —
          더 좁은 기기에서는 넘치는 대신 줄을 바꾼다. 값은 `lib/meso-quick-adds` 가 든다 —
          아이템 분배 계산기도 같은 눈금을 쓴다([[ADR-168]] 결정 9). */}
      <View className="mt-2 flex-row flex-wrap justify-end gap-1.5">
        {mesoHelpers &&
          MESO_QUICK_ADDS.map((quick) => (
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
