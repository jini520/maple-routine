// 기능 사용법 안내([[ADR-125]]). **원천은 기능 카탈로그 한 벌**이고 개발 노트는 거기로 링크만
// 건다(결정 1 정정, 2026-08-10) — 같은 설명을 버전 축과 기능 축에 두 벌 두면 반드시 갈라진다.
//
// 노트 항목은 이 안내를 `ReleaseNoteItem.guideId`(+ `guideSectionId`) 문자열로 가리킨다. 본문이
// 아니라 id 인 이유는 배포 스크립트가 `release-notes.ts` 를 Node 에서 직접 import 하기 때문이다.

/**
 * 안내가 걸리는 앱의 영역(사용자 지정, 2026-08-10). 앞 넷은 **하단 탭바와 같은 축**이라 사용자가
 * 이미 아는 구획이고, 그래서 안내를 찾을 때 새로 배울 것이 없다.
 *
 * `utility` 는 어느 탭에도 속하지 않는 도구 자리다 — **지금은 비어 있고**, 비어 있는 그룹은
 * 화면에서 탭째 감춘다(빈 탭을 열면 아무것도 없는 화면을 만난다).
 */
export type FeatureGuideGroup = 'content' | 'boss' | 'profit' | 'utility' | 'settings'

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

/**
 * 안내의 한 마디. **목차의 한 줄이자 개발 노트가 가리키는 착지점**이다([[ADR-125]] 결정 7).
 *
 * 노트 항목은 안내 페이지가 아니라 **여기**로 온다 — 릴리스에서 바뀐 것은 보통 기능 전체가
 * 아니라 그중 한 마디이고, 페이지 맨 위에 떨어뜨리면 읽는 사람이 그 마디를 다시 찾아야 한다.
 */
export interface FeatureGuideSection {
  /** 안내 안에서 유일해야 한다 — `?s=` 로 이 값을 받아 그 자리로 스크롤한다 */
  id: string
  /** 목차 줄이자 본문 소제목 */
  title: string
  blocks: FeatureGuideBlock[]
}

export interface FeatureGuide {
  /** 라우트의 `:guideId` — 노트 항목의 `guideId` 가 가리키는 값이기도 하다 */
  id: string
  /** 목록 행에 서는 이름이자 상세 화면의 머리말 */
  title: string
  /**
   * 이 안내가 서는 그룹들. **배열인 이유는 「캐릭터 관리」 때문이다** — 컨텐츠와 보스가 같은
   * 피커를 쓰므로 양쪽 탭에 같은 글이 서야 한다(사본을 두면 갈라진다). 대부분은 하나다.
   */
  groups: FeatureGuideGroup[]
  sections: FeatureGuideSection[]
}
