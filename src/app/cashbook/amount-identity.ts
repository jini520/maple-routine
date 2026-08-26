/**
 * 큰 숫자의 **이름표**([[ADR-087]] 정정 1 의 «정체») — 한 방향으로만 발급한다.
 *
 * ## 왜 되풀이되면 안 되나
 *
 * 카운트업의 기억(`lib/use-count-up` 의 `lastDisplayedByIdentity`)은 **모듈 수준**이라 컴포넌트가
 * 언마운트돼도 남는다([[ADR-087]] 결정 8 — 마운트를 값 변경과 같이 다루려고 그렇게 만들었다).
 * 그래서 이름표를 마운트마다 0 부터 세면 그 문자열이 되풀이되고, **다음에 시트를 열었을 때 지난번
 * 값에서 굴러 내려온다** — 실기에서 «탭을 옮길 때마다 가격이 하락하는 애니메이션» 으로 났다
 * (사용자 지적 2026-08-26).
 *
 * ## 왜 컴포넌트 파일 밖인가
 *
 * 컴포넌트 파일이 값을 export 하면 fast refresh 가 깨진다(`Button/variants.ts` ·
 * `AccountSelect/place-dropdown.ts` 와 같은 판단). 무엇보다 **이 계약은 화면 없이 검사해야 한다** —
 * 「한 번도 안 쓴 문자열인가」 는 렌더 트리로는 못 본다.
 */
let sequence = 0

export function nextAmountIdentity(): string {
  sequence += 1
  return `spend-amount-${sequence}`
}
