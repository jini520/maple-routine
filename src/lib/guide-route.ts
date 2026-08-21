// 기능 안내로 가는 경로를 만드는 자리([[ADR-125]] 결정 7).
//
// **왜 화면이 아니라 여기 있나** — 개발 노트 목록이 상세 화면 모듈에서 이 상수를 import 하면
// 그 모듈이 끌고 오는 **안내 카탈로그 전체(글 + 이미지 URL)** 가 목록의 import 그래프에 딸려
// 들어온다. 결정 2 가 "목록 화면은 `guideId` 문자열만 보므로 안내 모듈을 안 건드린다"고 적어 둔
// 이점이 그 자리에서 사라진다. 이 파일은 아무것도 import 하지 않는다.

/** 안내 안의 어느 마디로 떨어질지 — 경로가 아니라 **쿼리**다. */
export const GUIDE_SECTION_PARAM = 's'

/**
 * 안내 상세로 가는 경로. `parentPath` 가 둘인 이유는 상세가 **두 부모 아래 각각 라우팅**되기
 * 때문이다(결정 3 정정) — 기능 설명에서 열면 그 아래로, 개발 노트에서 열면 그 아래로 간다.
 *
 * 마디는 **경로 세그먼트가 아니라 쿼리**다. 세그먼트로 만들면 `resolveStackDirection` 이 스택
 * 한 단이 더 쌓인 것으로 읽어, 목차를 누를 때마다 화면이 밀려 들어온다.
 */
export function buildGuidePath(parentPath: string, guideId: string, sectionId?: string): string {
  const base = `${parentPath}/${guideId}`
  return sectionId === undefined ? base : `${base}?${GUIDE_SECTION_PARAM}=${sectionId}`
}
