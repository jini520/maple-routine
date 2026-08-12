import { parseHex } from '@core/lib/color'

/**
 * 테마 토큰(16진수) 하나에 알파를 얹어 `rgba()` 문자열을 만든다.
 *
 * **웹의 `bg-surface/60` 같은 투명도 접미사의 짝이다.** NativeWind(v3 엔진)는 `var()` 로 들어온 색에
 * 투명도 접미사를 만들지 못해 그 클래스가 **조용히 사라진다**(step 3 이 남긴 함정 둘 중 하나) —
 * 색이 흐릿해지는 게 아니라 배경 자체가 없어지므로 눈치채기 어렵다. 그래서 그런 자리는 클래스가
 * 아니라 값으로 만든다.
 *
 * 호출부가 둘이라 여기 둔다([[ADR-094]] 결정 1) — `PartySizeModal`(닫기 버튼 배경)과
 * `PageHeader`(경계 페이드의 알파 램프). 두 벌로 두면 한쪽만 고쳐지는 종류의 코드다.
 */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex)
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
}
