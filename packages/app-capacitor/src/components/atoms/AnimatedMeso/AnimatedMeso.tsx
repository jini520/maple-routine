import { useCountUp } from '@core/lib/use-count-up'

/**
 * 값이 바뀌면 목표까지 굴러가는 메소 숫자 ([[ADR-087]] 결정 6).
 *
 * **숫자만 낸다 — 단위("메소")도 감싸는 요소도 호출부의 것이다.** 자리마다 단위 마크업이 다르고
 * (헤드라인은 별도 span, 나머지는 평문), 금액 span 이 배지의 absolute 기준이 되는 자리도 있다
 * (`CharacterAccordion`). 여기서 요소를 하나 더 만들면 그 구조를 건드리게 되고, 숫자와 단위 사이의
 * **실제 공백 문자**(마진이 아니라 — [[ADR-046]] 트레이드오프)도 호출부에 그대로 남아야 한다.
 * Fragment 라 DOM 이 늘지 않으므로 `textContent` 규약이 그대로 유지된다.
 *
 * **컴포넌트로 쪼갠 이유는 렌더 격리다.** 훅을 화면·아코디언에서 직접 부르면 애니메이션 프레임마다
 * 그 무거운 트리 전체가 다시 그려진다. 잎으로 내려두면 바뀌는 것은 이 텍스트 노드뿐이다.
 */
export function AnimatedMeso(props: { identity: string; value: number }): React.JSX.Element {
  const displayed = useCountUp(props.identity, props.value)
  return <>{displayed.toLocaleString()}</>
}
