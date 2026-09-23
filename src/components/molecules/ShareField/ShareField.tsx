/**
 * 분배 비율 고르개. 슬라이더가 내 비율이고 스테퍼가 비율 합이다.
 *
 * 파티원별 칸을 안 세운다. 내 몫이 `내 비율 ÷ 합` 이라 남들이 서로 어떻게 나누는지는 그 값에 안
 * 들어가고, 칸을 인원만큼 세우면 쓰지도 않는 수를 입력하게 된다.
 *
 * 손잡이를 끌거나 칸을 눌러 옮긴다. 한 칸 옮길 때마다 햅틱이 난다. 끌기는 가로로 움직일 때만
 * 잡는다. 세로 끌기는 감싼 판이 가져가야 그 판을 내릴 수 있다.
 */
import { useState } from 'react'
import { Pressable, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { selectionFeedback } from '../../../native/haptics'
import { formatSharePercent } from '../../../lib/boss/party-shares'
import { MinusIcon, PlusIcon, Text } from '../../atoms'
import { MAX_SHARES_TOTAL, shareAt, withSharesTotal, type Shares } from './share-geometry'

/** 손잡이 지름. 합이 9 여도 칸(약 26px)보다 작아 이웃 눈금을 안 덮는다. */
const GRIP = 18

/** 스테퍼 버튼의 시각 크기와 권장 타깃(44px)의 차이를 사방으로 나눈 몫. */
const STEP_HIT_SLOP = { top: 8, bottom: 8, left: 10, right: 10 }

/** 합을 올리고 내리는 단추. 가로로 서면 테두리를 둘러 눌리는 자리를 말한다. */
function stepClass(stacked: boolean, atEnd: boolean): string {
  const base = stacked
    ? 'h-[26px] w-[26px] items-center justify-center rounded-full border border-border'
    : 'h-4 w-7 items-center justify-center'
  return atEnd ? `${base} opacity-40` : base
}

export function ShareField(props: {
  /** aria 접두. 한 화면에 결정석과 아이템이 나란히 서서 어느 쪽인지 말해야 한다. */
  label: string
  value: Shares
  /**
   * 합을 어디에 두나. 기본은 트랙 오른쪽에 세로로 선다.
   *
   * `'stacked'` 는 트랙 아래 가운데다. 좁은 카드 둘이 나란히 서는 자리에서는 옆에 두면 트랙이
   * 30px 밖에 안 남는다.
   *
   * `'wide'` 는 카드가 판 폭을 다 쓰는 자리(파티 모달)다. 트랙이 넓어 합이 그 옆에 서고 카드가 한 줄 낮아진다.
   */
  layout?: 'row' | 'stacked' | 'wide'
  onChange: (next: Shares) => void
}): React.JSX.Element {
  const wide = props.layout === 'wide'
  // 머리 줄과 트랙 높이는 `wide` 도 `stacked` 와 같다. 갈리는 것은 합이 어디 서느냐뿐이다.
  const stacked = props.layout === 'stacked' || wide
  // 가로로 서는 두 벌은 `−` 가 왼쪽이다(사용자 지정). 세로로 서는 `row` 만 `＋` 가 위다.
  const minusFirst = stacked
  const [width, setWidth] = useState(0)
  /**
   * 끌기 중인가. 콜백은 렌더마다 새 제스처로 갈아 끼워지므로, 잡은 직후 다시 렌더되기 전에 온
   * 이벤트는 `false` 를 보고 건너뛴다(한 프레임 이내).
   */
  const [grabbed, setGrabbed] = useState(false)
  const { myShare, sharesTotal } = props.value

  /** 바뀌었을 때만 알리고 햅틱을 낸다. 같은 칸에 머무는 끌기는 조용하다. */
  function commit(next: Shares): void {
    if (next.myShare === myShare && next.sharesTotal === sharesTotal) return
    selectionFeedback()
    props.onChange(next)
  }

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((event) => {
      setGrabbed(true)
      commit({ myShare: shareAt(event.x, width, sharesTotal), sharesTotal })
    })
    .onUpdate((event) => {
      if (grabbed) commit({ myShare: shareAt(event.x, width, sharesTotal), sharesTotal })
    })
    .onFinalize(() => setGrabbed(false))
    .withTestId('share-field-pan')

  function adjust(event: AccessibilityActionEvent): void {
    const next = myShare + (event.nativeEvent.actionName === 'increment' ? 1 : -1)
    if (next < 0 || next > sharesTotal) return
    commit({ myShare: next, sharesTotal })
  }

  // 눈금이 합보다 하나 많다. **0 이 값이기 때문**이다 - 결정석은 다 넘기고 아이템만 갖는
  // 약속이 있다.
  const cells = Array.from({ length: sharesTotal + 1 }, (_, index) => index)

  /** 합. 넓은 자리에서는 트랙 오른쪽에, 좁은 카드에서는 트랙 아래 가운데에 선다. */
  const total = (
    <View
      className={
        wide
          ? 'flex-row items-center gap-2.5'
          : stacked
            ? 'flex-row items-center justify-center gap-2.5'
            : 'w-7 items-center'
      }
    >
      <Pressable
        role="button"
        aria-label={`${props.label} 비율 합 ${minusFirst ? '감소' : '증가'}`}
        onPress={() => commit(withSharesTotal(props.value, sharesTotal + (minusFirst ? -1 : 1)))}
        disabled={minusFirst ? sharesTotal <= 2 : sharesTotal >= MAX_SHARES_TOTAL}
        hitSlop={STEP_HIT_SLOP}
        className={stepClass(stacked, minusFirst ? sharesTotal <= 2 : sharesTotal >= MAX_SHARES_TOTAL)}
      >
        {minusFirst ? (
          <MinusIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2.5} aria-hidden />
        ) : (
          <PlusIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2.5} aria-hidden />
        )}
      </Pressable>
      <Text
        testID={`share-field-total-${props.label}`}
        className={`${stacked ? 'min-w-3 text-center text-13' : 'py-0.5 text-15'} font-bold text-text`}
        style={TABULAR_NUMS}
      >
        {sharesTotal}
      </Text>
      <Pressable
        role="button"
        aria-label={`${props.label} 비율 합 ${minusFirst ? '증가' : '감소'}`}
        onPress={() => commit(withSharesTotal(props.value, sharesTotal + (minusFirst ? 1 : -1)))}
        disabled={minusFirst ? sharesTotal >= MAX_SHARES_TOTAL : sharesTotal <= 2}
        hitSlop={STEP_HIT_SLOP}
        className={stepClass(stacked, minusFirst ? sharesTotal >= MAX_SHARES_TOTAL : sharesTotal <= 2)}
      >
        {minusFirst ? (
          <PlusIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2.5} aria-hidden />
        ) : (
          <MinusIcon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2.5} aria-hidden />
        )}
      </Pressable>
    </View>
  )

  return (
    <View className={stacked ? 'gap-4' : 'gap-2'}>
      <View
        className={
          stacked
            ? 'flex-row items-baseline justify-between gap-1.5'
            : 'flex-row items-center justify-between gap-2.5'
        }
      >
        <Text
          className={
            stacked
              ? 'text-11 font-semibold tracking-[.04em] text-text-muted'
              : 'text-xs font-bold tracking-[.06em] text-text-muted'
          }
        >
          {props.label}
        </Text>
        {/* 내 몫을 백분율로. `나 : 나머지` 로 적으면 2:1 과 4:2 가 다른 값처럼 보이는데
            둘은 같은 약속이다. */}
        <Text
          testID={`share-field-ratio-${props.label}`}
          className={stacked ? 'text-base font-bold tracking-[-.02em] text-text' : 'text-sm font-bold text-text'}
          style={TABULAR_NUMS}
        >
          {formatSharePercent(myShare, sharesTotal)}
        </Text>
      </View>

      {/* 막대와 합이 **한 줄**이다. 합을 아래 줄로 내리면 고르개 하나가 두 줄을 먹는데,
          결정석과 드롭이 나란히 서는 자리라 그 두 줄이 네 줄이 된다. */}
      <View className={wide || !stacked ? 'flex-row items-center gap-2.5' : 'gap-6'}>
        <GestureDetector gesture={pan}>
          <View
            testID="share-field-track"
            accessible
            role="slider"
            aria-label={`${props.label} 내 비율`}
            accessibilityValue={{ min: 0, max: sharesTotal, now: myShare, text: `${myShare}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={adjust}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            // **상자 높이가 곧 누를 자리다.** 막대는 6px 만 그리지만 탭과 끌기를 받는 것은 이
            // 상자다. 세로로 선 카드는 위아래가 라벨과 단추라 손가락이 빗나가므로 권장
            // 타깃(44)까지 올린다. 가로로 설 때는 트랙이 길어 36 으로 닿는다.
            className={stacked ? 'h-11 flex-1 justify-center' : 'h-9 flex-1 justify-center'}
          >
            {/* **채운 길이가 곧 내 몫**이다. 칸에 수를 적지 않는다 - 비율은 2~9 라 셀 일이 없고,
                세어야 하는 것은 몇 칸인가가 아니라 얼마나 차지하는가다. */}
            <View className="h-1.5 flex-row overflow-hidden rounded-full bg-track">
              <View className="h-full rounded-full bg-primary" style={{ width: `${(myShare / sharesTotal) * 100}%` }} />
            </View>

            {/* 눈금. 채운 끝이 어디에 섰는지 읽게 한다. */}
            {cells.slice(1, -1).map((cell) => (
              <View
                key={cell}
                pointerEvents="none"
                className="absolute h-1.5 w-0.5 bg-surface"
                style={{ left: `${(cell / sharesTotal) * 100}%`, marginLeft: -1 }}
              />
            ))}

            {/* 채운 끝의 손잡이. 막대 전체가 끌리므로 이것은 잡는 자리를 알리는 표식이다. */}
            <View
              pointerEvents="none"
              className="absolute rounded-full bg-on-primary shadow-md"
              style={{
                width: GRIP,
                height: GRIP,
                left: `${(myShare / sharesTotal) * 100}%`,
                marginLeft: -GRIP / 2,
              }}
            />

            {/* 눈금을 눌러 옮기는 자리. 투명이라 막대 그림을 안 가린다. */}
            <View className="absolute inset-0 flex-row items-center">
              {cells.map((cell) => (
                <Pressable
                  key={cell}
                  role="button"
                  aria-label={`${props.label} 비율 ${cell}`}
                  onPress={() => commit({ myShare: cell, sharesTotal })}
                  // 끝 둘은 반 칸이다. 눈금이 칸 가운데가 아니라 칸 경계에 서 있어서, 온 칸을
                  // 주면 0 과 합이 이웃보다 두 배 넓은 자리를 먹는다.
                  style={{ flex: cell === 0 || cell === sharesTotal ? 0.5 : 1 }}
                  className="h-full"
                />
              ))}
            </View>
          </View>
        </GestureDetector>

        {total}
      </View>
    </View>
  )
}
