/**
 * 에셋 목록 생성의 **명세 한 벌** ([[ADR-129]]).
 *
 * `src/assets/generated/*.ts` 는 이 표를 읽어 만들어지고(`scripts/generate-asset-manifest.mjs`),
 * *"생성물이 지금 디렉터리와 맞는가"* 를 보는 테스트도 같은 표를 읽는다
 * (`generated/__tests__/asset-manifest.test.ts`). 표가 두 벌이면 생성기와 검사기가 서로 다른
 * 것을 보게 되어 **검사가 통과하는데 목록이 틀린** 상태가 생긴다.
 *
 * 스크립트는 `.mjs` 인데 이 파일은 `.ts` 다 — Node 24 의 내장 타입 스트리핑으로 그대로 import
 * 한다(`scripts/publish-live-update.mjs` 가 `data/release-notes.ts` 를 읽는 것과 같은 방식,
 * [[ADR-119]] 결정 1). 그래서 **여기에는 값과 타입만 둔다**(런타임 의존 0개).
 *
 * `dirs` 의 경로는 이 파일이 있는 `src/assets/` 기준이고 **하위 디렉터리를 훑지 않는다** —
 * 옛 Vite 글롭 패턴(`'../assets/maps/*.…'`)의 `*` 가 `/` 를 안 넘던 것과 같은 규칙이다
 * (그래서 `maps/` 와 `maps/icons/` 가 서로 다른 목록으로 남는다).
 */

/** 키를 파일 이름에서 뽑는 방법. */
export type AssetKeyRule =
  /** 확장자를 뗀 이름 — 데이터가 슬러그로 가리키는 에셋(보스·지역·테마·월드) */
  | 'slug'
  /** 확장자까지 포함한 파일 이름 — [[ADR-011]] 결정 6 의 `iconFile` 이 그렇게 적혀 있다 */
  | 'fileName'

export interface AssetGroup {
  /** 생성물 파일 이름(`generated/<file>.ts`) */
  file: string
  /** 생성물이 export 하는 이름 */
  exportName: string
  /**
   * `record` — 키 하나에 에셋 하나.
   * `frames` — 디렉터리 하나가 키이고 값은 그 안의 프레임 배열(숫자 순 정렬).
   */
  kind: 'record' | 'frames'
  key: AssetKeyRule
  /** `src/assets/` 기준 디렉터리. 둘 이상이면 하나로 합친다(뒤가 이긴다). */
  dirs: string[]
  /** 받아들일 확장자(점 없이). 목록에 없는 파일은 무시한다. */
  extensions: string[]
  /** 생성물 머리에 적히는 한 줄 — 이 목록이 무엇에 쓰이는지 */
  purpose: string
}

export const ASSET_GROUPS: AssetGroup[] = [
  {
    file: 'bosses',
    exportName: 'BOSS_PORTRAIT_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['bosses'],
    extensions: ['webp', 'png'],
    purpose: '보스 일러스트 — `lib/boss-icons.ts` 가 `portraitSlug` 로 찾는다',
  },
  {
    file: 'items',
    exportName: 'ITEM_ASSETS',
    kind: 'record',
    key: 'fileName',
    dirs: ['items', 'items/rings'],
    extensions: ['png', 'webp'],
    purpose:
      '아이템·반지 아이콘 — `lib/item-icons.ts` 가 `iconFile`(확장자 포함)로 찾는다([[ADR-011]] 결정 6)',
  },
  {
    file: 'worlds',
    exportName: 'WORLD_EMBLEM_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['worlds'],
    extensions: ['png', 'webp'],
    purpose: '월드 엠블럼 — `lib/world-emblem.ts` 가 `world-emblems.json` 의 basename 으로 찾는다',
  },
  {
    file: 'themes',
    exportName: 'THEME_BACKGROUND_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['themes'],
    extensions: ['webp', 'jpg', 'png'],
    purpose: '테마 배경 이미지 — `lib/theme-backgrounds.ts`([[ADR-088]] 결정 3)',
  },
  {
    file: 'maps',
    exportName: 'DAILY_QUEST_BACKGROUND_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['maps'],
    extensions: ['webp', 'jpg', 'png'],
    purpose: '일일/주간 콘텐츠 카드 지역 배경 — `lib/daily-quest-backgrounds.ts`',
  },
  {
    file: 'map-icons',
    exportName: 'DAILY_QUEST_ICON_ASSETS',
    kind: 'record',
    key: 'slug',
    dirs: ['maps/icons'],
    extensions: ['png', 'webp'],
    purpose: '지역 아이콘 — `lib/daily-quest-icons.ts`(배경과 같은 슬러그를 쓴다)',
  },
  {
    file: 'drop-effect',
    exportName: 'DROP_EFFECT_ASSETS',
    kind: 'frames',
    key: 'slug',
    dirs: ['drop-effect/screen', 'drop-effect/pre', 'drop-effect/loop', 'drop-effect/end'],
    extensions: ['jpg', 'webp'],
    purpose: '고가 드롭 연출 프레임 — `lib/drop-effect-frames.ts`([[ADR-038]] 결정 8)',
  },
]
