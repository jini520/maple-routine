import type { FeatureGuide, FeatureGuideGroup } from '../../types'
import { contentManageGuide } from './content/content-manage'
import { ingameSyncContentGuide } from './content/ingame-sync-content'
import { bossManageGuide } from './boss/boss-manage'
import { ingameSyncBossGuide } from './boss/ingame-sync-boss'
import { bossPartyGuide } from './boss/boss-party'
import { bossProfitRecordGuide } from './profit/boss-profit-record'
import { dropItemRecordGuide } from './profit/drop-item-record'
import { dropItemPriceGuide } from './profit/drop-item-price'
import { dropHistoryGuide } from './profit/drop-history'
import { apiKeyGuide } from './settings/api-key'
import { characterManageGuide } from './shared/character-manage'

// 기능 사용법 안내의 **진실 원천 한 벌**([[ADR-125]] 결정 1 정정). 두 곳에서 읽는다 —
// 기능 설명 화면(`/settings/guide`)이 기능 축으로 전체를 나열하고, 개발 노트 항목이
// `guideId`(+`guideSectionId`)로 그중 한 마디를 가리켜 같은 화면을 연다.
//
// **안내 하나가 파일 하나다**(2026-08-11, 사용자 지정). 한 파일에 전부 있으면 안내를 하나 고칠
// 때마다 수백 줄짜리 파일을 열게 되고, 이미지 import 가 쌓이면서 그 파일이 전부의 의존성이 된다.
// 폴더는 그룹을 따르되, **두 그룹에 서는 안내는 `shared/`** 다 — `character-manage` 는
// `groups: ['content', 'boss']` 라 어느 한쪽 폴더에 두면 나머지에서 찾을 수 없다.
//
// ```
// feature-guides/
// ├── index.ts     ← 지금 이 파일. 조립만 한다
// ├── content/     컨텐츠 전용
// ├── boss/        보스 전용
// ├── profit/      수익 전용
// ├── settings/    설정 전용
// └── shared/      두 그룹 이상에 서는 안내
// ```
//
// **이미지는 안내 파일이 직접 import 한다** — `packages/core/src/assets/guide/<안내 id>/` 에 두고 그 파일
// 상단에서 `import`. `import.meta.glob` 을 쓰지 않는 이유는 파일명이 틀렸을 때 `undefined` 로
// 조용히 통과하는 대신 **빌드가 실패해야** 하기 때문이다(결정 4).
//
// **`release-notes.ts` 와 갈라져 있는 이유는 배포다**(결정 2). 배포 스크립트가 `release-notes.ts` 를
// **Node 에서 직접 import** 하는데(ADR-119 결정 1), 이미지 import 를 그 파일에 넣으면 Node 가
// `.webp` 를 해석하지 못해 그 자리에서 배포가 죽는다.
//
// ⚠️ **본문은 코드·설계 문서를 근거로 쓴 초안이고 아직 사용자 검토를 받지 않았다**(이슈 #198).
// 이미지는 **한 장도 없다** — 넣을 자리를 각 파일의 `TODO(#198)` 로 표시해 뒀다.

/** 그룹 탭에 서는 이름. 넷은 하단 탭바와 **글자까지 같다** — 사용자가 이미 아는 구획이다. */
export const FEATURE_GUIDE_GROUP_LABELS: Record<FeatureGuideGroup, string> = {
  content: '컨텐츠',
  boss: '보스',
  profit: '수익',
  utility: '유틸리티',
  settings: '설정',
}

/**
 * 탭이 서는 순서. **데이터 순서와 무관하게 이 순서로 그린다** — 안내를 쓰는 사람이 어떤 순서로
 * 적든 화면은 늘 같아야 한다(`RELEASE_NOTE_CATEGORY_ORDER` 와 같은 규칙).
 */
export const FEATURE_GUIDE_GROUP_ORDER: readonly FeatureGuideGroup[] = [
  'content',
  'boss',
  'profit',
  'utility',
  'settings',
]

/**
 * 목록에 나오는 순서다 — 화면은 이 배열을 걸러 그대로 그리고 다시 정렬하지 않는다.
 * 그룹 안에서 **사용자가 지정한 순서** 그대로 둔다.
 *
 * **새 안내 파일을 만들면 여기에도 넣을 것.** 빠뜨리면 화면에 안 나오는데, 파일은 멀쩡히 있어
 * 눈으로는 알아채기 어렵다 — `__tests__/feature-guides.test.ts` 가 폴더를 훑어 이 누락을 잡는다.
 */
export const FEATURE_GUIDES: FeatureGuide[] = [
  // 컨텐츠
  contentManageGuide,
  characterManageGuide, // 보스 탭에도 같은 글로 선다
  ingameSyncContentGuide,
  // 보스
  bossManageGuide,
  ingameSyncBossGuide,
  bossPartyGuide,
  // 수익
  bossProfitRecordGuide,
  dropItemRecordGuide,
  dropItemPriceGuide,
  dropHistoryGuide,
  // 유틸리티 — 아직 없음
  // 설정
  apiKeyGuide,
]

/**
 * 그 id 의 안내를 찾는다. `findReleaseNote` 와 같은 계약이다 — 없으면 **던지지 않고 `undefined`**
 * 이고, "없다"의 판정은 호출부가 한다(상세 화면은 목록으로 되돌린다).
 */
export function findFeatureGuide(id: string): FeatureGuide | undefined {
  return FEATURE_GUIDES.find((guide) => guide.id === id)
}
