/**
 * 일러스트 카드(`.media-scope`) 안 이름 텍스트의 그림자 ([[ADR-018]], [[ADR-020]]).
 *
 * **테마 토큰을 쓰지 않는다.** 이 그림자는 색을 입히는 장식이 아니라, 무슨 그림이 깔리든 글자가
 * 읽히게 하는 **가독성 스크림**이다. 일러스트는 보스마다 밝기가 제각각이라 어떤 테마에서든 검은
 * 그림자여야 하고, 테마의 `shadow-color`(카드 elevation용, 알파 0.35)로 바꾸면 글자가 밝은
 * 일러스트 위에서 묻힌다([[ADR-064]] 결정 6은 elevation 그림자만 다룬다).
 */
export const MEDIA_TEXT_SHADOW = '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)'

/**
 * 일러스트 bleed 의 색 처리 ([[ADR-018]]). 보스 카드와 파티 인원 모달 히어로가 **같은 값**을 쓴다
 * ([[ADR-121]] 결정 7) — 한쪽만 만지면 같은 그림이 두 자리에서 다르게 보인다.
 */
export const MEDIA_ART_FILTER = 'saturate(.85) brightness(.8)'
export const MEDIA_ART_OPACITY = 0.65

/**
 * 오른쪽으로 사라지는 페이드 마스크. **끝점이 자리마다 다르다** — 카드(80px 높이, 화면 폭)는
 * 38%/76%, 모달 히어로는 더 넓고 낮아 42%/82% 다. 같은 끝점을 쓰면 모달에서 그림이 너무 일찍
 * 끊긴다.
 */
export const MEDIA_ART_MASK_CARD = 'linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)'
export const MEDIA_ART_MASK_HERO = 'linear-gradient(90deg, #000 0%, #000 42%, transparent 82%)'
