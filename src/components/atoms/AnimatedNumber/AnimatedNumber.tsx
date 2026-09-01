/**
 * 값이 바뀌면 목표까지 굴러가는 숫자([[ADR-087]] 결정 6 · 정정 3).
 *
 * **이 컴포넌트의 존재 이유는 서식이 아니라 렌더 경계다.** `useCountUp` 은 350ms 동안 매 프레임
 * `setState` 를 부른다(약 21회). 그 상태가 어느 컴포넌트에 사느냐가 **매 프레임 다시 그리는 범위**를
 * 정한다. 훅을 화면이나 카드에서 직접 부르면 그 트리 전체가 프레임마다 다시 그려지고, 카운트업이
 * 동시에 여럿 돌면 화면이 버벅인다(실측 — 보스 수익에서 최소 일곱이 함께 돈다).
 *
 * 그래서 굴러가는 상태를 **이 잎 하나에 가둔다.** 얇다고 지우면 안 되는 이유가 그것이다.
 */
import { useCountUp } from '../../../hooks/useCountUp'

export interface AnimatedNumberProps {
  /**
   * 숫자를 구분하는 키. 같으면 이어서 굴리고, 바뀌면 그 키로 마지막에 그렸던 값에서 다시 굴린다
   * ([[ADR-087]] 결정 8 · 정정 1).
   */
  identity: string
  /** 목표 값. */
  value: number
}

/**
 * 굴러가는 숫자 하나. **글자만 낸다** — 상자도 단위도 없으므로 `Text` 안에서 쓴다.
 *
 * 단위와 그 앞 공백은 호출부가 붙인다. 이 컴포넌트는 도메인을 모른다.
 *
 * @example
 * <Text style={TABULAR_NUMS}>
 *   <AnimatedNumber identity={`total|${tab}`} value={totalMeso} />
 *   {' 메소'}
 * </Text>
 */
export function AnimatedNumber(props: AnimatedNumberProps): React.JSX.Element {
  const displayed = useCountUp(props.identity, props.value)
  return <>{displayed.toLocaleString()}</>
}
