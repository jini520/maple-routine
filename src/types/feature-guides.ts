// 기능 사용법 안내([[ADR-125]]). **원천은 기능 카탈로그 한 벌**이고 개발 노트는 거기로 링크만
// 건다(결정 1 정정, 2026-08-10) — 같은 설명을 버전 축과 기능 축에 두 벌 두면 반드시 갈라진다.
//
// 노트 항목은 이 안내를 `ReleaseNoteItem.guideId` 문자열로 가리킨다. 본문이 아니라 id 인 이유는
// 배포 스크립트가 `release-notes.ts` 를 Node 에서 직접 import 하기 때문이다(`release-notes.ts` 주석).

/**
 * 안내가 걸리는 앱의 영역. **하단 탭바와 같은 축**이라 사용자가 이미 아는 구획이고,
 * 그래서 안내를 찾을 때 새로 배울 것이 없다.
 *
 * `공통` 은 어느 탭에도 속하지 않는 앱 전반의 동작(화면 전환·제스처 같은 것)이다 — 탭 이름에
 * 억지로 밀어 넣으면 그 탭을 열어 본 사람이 엉뚱한 것을 만난다.
 */
export type FeatureGuideGroup = 'content' | 'boss' | 'profit' | 'settings' | 'common'

/** 안내에 실리는 이미지. `alt` 를 `src` 와 한 덩이로 묶어 **빠뜨릴 수 없게** 한다([[ADR-125]] 결정 6). */
export interface FeatureGuideImage {
  /** `src/assets/guide/` 에서 import 한 번들 자산 URL */
  src: string
  /** 안내 화면에서 이미지는 장식이 아니라 정보를 나른다 — 비워 둘 수 없다 */
  alt: string
}

/**
 * 안내 본문의 한 덩이. **이미지만·문단만·둘 다** 를 모두 허용한다 — 사용법은 "그림 한 장에 설명
 * 한 줄"로 떨어지지 않고, 맥락 문단이 먼저 오거나 그림이 잇따르는 것이 자연스러운 경우가 있다.
 * 둘 다 없는 블록은 그릴 것이 없으므로 데이터 테스트가 막는다.
 */
export interface FeatureGuideBlock {
  image?: FeatureGuideImage
  text?: string
}

export interface FeatureGuide {
  /** 라우트의 `:guideId` — 노트 항목의 `guideId` 가 가리키는 값이기도 하다 */
  id: string
  /** 목록 행에 서는 이름이자 상세 화면의 머리말 */
  title: string
  group: FeatureGuideGroup
  blocks: FeatureGuideBlock[]
}
