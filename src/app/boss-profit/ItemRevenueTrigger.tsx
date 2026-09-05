/**
 * 아이템이 섞인 금액. **금액 자체가 상세를 여는 버튼**이다.
 *
 * 전에는 금액 아래 `아이템 +N억` 칩이 그 일을 했다. 칩을 걷고 금액으로 옮기면서(사용자 지시)
 * 눌린다는 것을 말할 것이 필요해졌다. 숫자만 남으면 그 자리가 버튼인지 아무도 모른다.
 *
 * **점선 밑줄 하나**가 그 일을 한다. 글자 폭도 행 높이도 안 바뀌어서 금액 열의 오른쪽 끝이 어느
 * 줄에서도 같은 자리에 선다. 이 화면은 숫자를 세로로 훑는 곳이라 그 정렬이 값을 한다(쉐브론을
 * 붙이면 아이템 있는 줄만 왼쪽으로 밀린다).
 *
 * 밑줄을 **글자 장식이 아니라 그린 선**으로 두는 것이 핵심이다. RN 의 `textDecorationStyle` 은
 * iOS 전용이라 안드로이드에서 점선이 조용히 실선이 된다. `View` 의 `borderStyle` 도 안드로이드가
 * 한 변만 굵을 때 실선으로 그릴 수 있는데, 그때도 **밑줄이라는 사실은 남는다**.
 *
 * 부르는 자리가 셋이다. 캐릭터 카드 머리 · 보스 행 · 월간 탭 주차 소계. 셋이 같은 칩을 쓰고
 * 있었으므로 같은 어포던스를 쓴다.
 *
 * @example
 * <ItemRevenueTrigger ref={itemChipRef} label={`${row.boss} 아이템 수익 확인`} isOpen={isItemPopoverOpen} onPress={toggleItemPopover}>
 *   {amount}
 * </ItemRevenueTrigger>
 */
import { Pressable, View } from 'react-native'

export interface ItemRevenueTriggerProps {
  /** `useAnchoredPopover` 의 콜백 ref. 이 상자를 재서 팝오버를 앉힌다. */
  ref: (node: View | null) => void
  /** 읽어 주는 이름. 숫자만으로는 무엇을 여는 버튼인지 안 들린다. */
  label: string
  isOpen: boolean
  onPress: () => void
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
  children,
}: ItemRevenueTriggerProps): React.JSX.Element {
  return (
    // 세로로 쌓되 폭은 금액이 정한다. 기본 `stretch` 라 밑줄이 그 폭에 맞는다.
    <Pressable
      ref={ref}
      testID="item-revenue-trigger"
      role="button"
      aria-label={label}
      aria-expanded={isOpen}
      onPress={onPress}
      className="shrink-0"
    >
      {children}
      <View testID="item-revenue-underline" className="mt-0.5 border-b border-dashed border-primary-ink" />
    </Pressable>
  )
}
