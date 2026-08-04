// 3단계 리팩터링(ADR-094)의 안전장치 — 렌더 결과 DOM 을 고정한다.
//
// 왜 필요한가: 이 저장소의 취약점은 로직이 아니라 **DOM·CSS 의 부모-자식 관계**에 있다
// (BossProfitScreen 기준 레이아웃 실측 7곳 · isolate/sticky/z-* 참조 65개, 그 값들은
// ADR-080~085 에서 실기기로 여러 번 틀린 끝에 얻었다). 그런데 jsdom 은 레이아웃을 계산하지
// 않아서 — getBoundingClientRect 가 전부 0 — 기존 테스트 291케이스가 **바로 그것만 못 잡는다.**
//
// DOM 중첩·클래스·순서가 같으면 스태킹 컨텍스트도 sticky 흡착도 측정값도 바뀔 수 없다.
// 그래서 리팩터링 전에 이 스냅샷을 떠 두고, 이후 커밋마다 대조한다. 스냅샷이 바뀌면
// 그 커밋은 순수 리팩터링이 아니다(ADR-094 결정 4).

/**
 * React `useId()` 산출값을 자리표시자로 바꾼다.
 *
 * useId 는 렌더 트리에서의 위치로 값을 만들기 때문에, 컴포넌트를 파일만 옮겨도(= DOM 은 그대로)
 * 값이 흔들릴 수 있다. 그 흔들림은 **우리가 지키려는 성질과 무관**하므로 대조 대상에서 뺀다.
 * 실제로 MapleSweepSpinner 가 clipPath·gradient id 에 useId 를 쓴다.
 */
function normalizeReactIds(html: string): string {
  return html.replace(/_r_[0-9a-z]+_/g, '_rID_').replace(/:r[0-9a-z]+:/g, ':rID:')
}

/**
 * 한 줄로 뭉친 innerHTML 을 태그 단위로 끊는다 — 스냅샷 diff 에서 **어느 요소가 달라졌는지**
 * 바로 보이게 하려는 것이고, 대조 자체에는 영향이 없다.
 */
function breakTags(html: string): string {
  return html.replace(/></g, '>\n<')
}

/**
 * 리팩터링 전후를 대조할 정규화된 DOM 문자열.
 *
 * `innerHTML` 을 쓰는 이유 — 클래스·속성·중첩·형제 순서가 **전부** 들어오기 때문이다.
 * 텍스트만 보는 단언(getByRole 등)은 이 셋 중 아무것도 지키지 못한다.
 */
export function domSnapshot(container: HTMLElement): string {
  return breakTags(normalizeReactIds(container.innerHTML))
}
