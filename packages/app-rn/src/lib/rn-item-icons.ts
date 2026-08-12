/**
 * `@core/lib/item-icons` 의 RN 대체 — `core-shims.js` 가 번들러 수준에서 이 파일로 갈아끼운다.
 *
 * **시그니처는 한 글자도 다르지 않다**([[ADR-127]] 원칙 1). 두 export 모두 항상 `null` 이다.
 *
 * ## 여기서는 조회 규칙째 옮길 필요가 없다
 *
 * `rn-boss-icons.ts` 는 크롭 두 표를 살려야 했지만(그건 에셋이 아니라 JSON 값이다), 이 모듈은
 * **전체가 "이름 → 파일명 → URL" 한 사슬**이고 그 끝이 에셋이다. 파일명을 알아내도 줄 URL 이 없으니
 * 중간 단계(`boss-ring-boxes.json` + `item-icons.json` 병합, `'기타'` → 리밋 링 특수 매핑 —
 * [[ADR-011]] 결정 6 · [[ADR-041]])를 여기서 복제하면 **아무 데도 쓰이지 않는 표를 두 벌 유지**하는
 * 것이 된다. 그래서 옮기지 않는다 — 에셋 레이어가 오면 원본의 사슬을 그대로 쓰면 된다.
 *
 * `null` 은 원본이 정의해 둔 정상 경로다 — *"매핑/파일이 없으면 `null`(호출부에서 플레이스홀더
 * 폴백)"*. 그래서 `ValuableDropBadge` 는 아이콘 자리에 회색 원을 그리고, 스택 규칙(겹침 −6 ·
 * 앞선 것이 위)은 그대로 확인된다. 채우는 데 필요한 것은 `rn-boss-icons.ts` 파일 머리에 있다.
 */

/** 항상 `null` — RN 번들에 아이템 아이콘이 아직 없다(파일 머리). */
export function getItemIconUrl(name: string, slot?: string): string | null {
  void name
  void slot
  return null
}

/** 항상 `null` — 같은 이유다. */
export function getItemIconUrlByFile(fileName: string): string | null {
  void fileName
  return null
}
