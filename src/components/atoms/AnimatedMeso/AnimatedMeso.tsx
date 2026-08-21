import { useCountUp } from '@core/lib/use-count-up'

/**
 * 값이 바뀌면 목표까지 굴러가는 메소 숫자 ([[ADR-087]] 결정 6).
 *
 * **숫자만 낸다 — 단위("메소")도 감싸는 요소도 호출부의 것이다.** 자리마다 단위 마크업이 다르고
 * (헤드라인은 별도 요소, 나머지는 평문), 금액이 배지의 위치 기준이 되는 자리도 있다
 * (`CharacterAccordion`). 여기서 요소를 하나 더 만들면 그 구조를 건드리게 되고, 숫자와 단위 사이의
 * **실제 공백 문자**(마진이 아니라 — [[ADR-046]] 트레이드오프)도 호출부에 그대로 남아야 한다.
 * Fragment 라 트리가 늘지 않으므로 그 규약이 그대로 유지된다 — RN 에서도 같다. 호출부의 `<Text>`
 * 안에서 이 문자열이 형제 텍스트와 나란히 한 줄로 흐른다.
 *
 * **컴포넌트로 쪼갠 이유는 렌더 격리다.** 훅을 화면·아코디언에서 직접 부르면 애니메이션 프레임마다
 * 그 무거운 트리 전체가 다시 그려진다. 잎으로 내려두면 바뀌는 것은 이 텍스트 노드뿐이다.
 *
 * ## 모션이 여기 살아 있는 이유 (step 3 계획과 다른 점)
 *
 * 이 phase 의 지시는 *"`AnimatedMeso` 는 CSS 전환에 의존하니 골격만"* 이었으나 **전제가 틀렸다** —
 * 카운트업은 CSS 가 아니라 `@core/lib/use-count-up` 의 순수 JS 훅이다(`requestAnimationFrame` +
 * `performance.now`, 둘 다 RN 에 있다). step 7 이 다루는 것은 `index.css` 의 `@keyframes` 8종이고
 * 카운트업은 그 목록에 없다. 그래서 흉내가 아니라 **웹과 같은 구현이 그대로 돈다** — 코드도 웹의
 * 세 줄과 한 글자도 다르지 않다.
 *
 * 남은 확인거리 하나: `toLocaleString()` 의 천 단위 구분 기호는 Hermes 의 Intl 에 달려 있다. jest(Node)
 * 에서는 `1,284,500,000` 이 나오는 것을 테스트가 지키지만, 실기기에서도 같은지는 눈으로 봐야 한다.
 */
export function AnimatedMeso(props: { identity: string; value: number }): React.JSX.Element {
  const displayed = useCountUp(props.identity, props.value)
  return <>{displayed.toLocaleString()}</>
}
