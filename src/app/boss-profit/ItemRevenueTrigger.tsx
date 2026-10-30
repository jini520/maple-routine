/**
 * 아이템이 섞인 금액. **금액 자체가 상세를 여는 버튼**이다.
 *
 * 숫자만 남으면 그 자리가 버튼인지 아무도 모른다. 금액 **왼쪽**의 작은 아래 화살표가 누르면 열린다는 것을 말한다.
 * 날짜 알약과 같은 신호다. 오른쪽에 두지 않는 것은 금액 열의 오른쪽 끝이 어느 줄에서도 같은 자리에 서야 해서다.
 * 이 화면은 숫자를 세로로 훑는 곳이라 그 정렬이 값을 한다. 밑줄 같은 글자 꾸밈은 쓰지 않는다.
 *
 * 부르는 자리가 셋이다. 캐릭터 카드 머리 · 보스 행 · 월간 탭 주차 소계.
 *
 * @example
 * <ItemRevenueTrigger ref={itemChipRef} label={`${row.bossName} 아이템 수익 확인`} isOpen={isItemPopoverOpen} onPress={toggleItemPopover}>
 *   {amount}
 * </ItemRevenueTrigger>
 */
import { Pressable, View } from 'react-native'

import { ChevronDownIcon } from '../../components/atoms'

export interface ItemRevenueTriggerProps {
  /** `useAnchoredPopover` 의 콜백 ref. 이 상자를 재서 팝오버를 앉힌다. */
  ref: (node: View | null) => void
  /** 읽어 주는 이름. 숫자만으로는 무엇을 여는 버튼인지 안 들린다. */
  label: string
  isOpen: boolean
  onPress: () => void
  /** 화살표 색. 안 주면 `primary-ink`. 금액이 오로라 글자일 때 그 첫 색을 받는다. */
  markColor?: string
  /** 금액 `Text`. 색은 부르는 쪽이 정한다(아이템이 섞이면 `primary-ink`). */
  children: React.ReactNode
}

export function ItemRevenueTrigger({
  // 구조 분해가 필수다. `props.ref` 로 읽으면 `react-hooks/refs` 가 그 접근을 렌더 중 ref
  // 접근으로 본다(`useAnchoredPopover` 를 부르는 자리들이 훅을 구조 분해하는 것과 같은 이유).
  ref,
  label,
  isOpen,
  onPress,
  markColor,
  children,
}: ItemRevenueTriggerProps): React.JSX.Element {
  return (
    <Pressable
      ref={ref}
      testID="item-revenue-trigger"
      role="button"
      aria-label={label}
      aria-expanded={isOpen}
      onPress={onPress}
      className="shrink-0 flex-row items-center gap-1"
    >
      <View testID="item-revenue-mark">
        {markColor === undefined ? (
          <ChevronDownIcon className="h-2.5 w-2.5 text-primary-ink" strokeWidth={2.5} aria-hidden />
        ) : (
          <ChevronDownIcon className="h-2.5 w-2.5" color={markColor} strokeWidth={2.5} aria-hidden />
        )}
      </View>
      {children}
    </Pressable>
  )
}
