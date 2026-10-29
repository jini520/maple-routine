/**
 * 우리 서버 `GET /v1/game-data` 의 칸 열넷. 칸 하나가 표 하나이고 번들 `src/data/<칸>.json` 과 기기 사본도 같은 모양이다.
 *
 * 응답은 전부 납작한 줄 표다. 보스 · 난이도 · 갈래로 묶거나 지역 안에 사냥터를 품는 것은 조회 모듈이 한다. 선택 칸은
 * 응답에서 `null` 이고 계약 검사(`parse`)를 거친 뒤에는 빠진 칸이다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 칸을 더할 때 양쪽을 함께 본다.
 */
import type { BossCatalog } from './boss-catalog'
import type { DropCategory } from './drops'
import type { ForceType } from './hunting-grounds'
import type { BossDifficulty } from './scheduler'

/** 칸 맨 위의 시각. `null` 은 서버에서 받은 적 없는 사본이다. */
export interface TableHead {
  updatedAt: string | null
}

export interface DropItemRow {
  key: string
  name: string
  /** `assets/items/` 또는 `assets/items/rings/` 의 파일명. 없는 아이템은 빠진다. */
  iconFile?: string
  /** 고가 드롭. 세트 소속이 아니라 이 칸 하나로 판정한다. */
  valuable: boolean
}
export interface DropItemsTable extends TableHead {
  items: DropItemRow[]
}

export interface BossDropRow {
  boss: string
  difficulty: BossDifficulty
  category: DropCategory
  /** 아이템 key. */
  item: string
  /** 고정 보상의 수량 글자. `160개`. */
  amount?: string
  from?: string
  until?: string
}
export interface BossDropsTable extends TableHead {
  rewards: BossDropRow[]
}

export interface DropBoxRow {
  /** 상자의 아이템 key. */
  item: string
  /** 반지 상자만 든다. 장신구 상자는 둘 다 빠진다. */
  levelMin?: number
  levelMax?: number
  /** 개봉 후보의 아이템 key. 차례가 화면 차례다. */
  contents: string[]
}
export interface DropBoxesTable extends TableHead {
  boxes: DropBoxRow[]
}

export interface CrystalPriceRow {
  boss: string
  difficulty: BossDifficulty
  priceMeso: number
  from?: string
  until?: string
}
export interface CrystalPricesTable extends TableHead {
  prices: CrystalPriceRow[]
}

export interface WorldRow {
  key: string
  /** API `world_name` 표기. 보이는 이름이다. */
  name: string
  /** 엠블럼 파일 basename. 스페셜은 빠진다. */
  emblem?: string
  challengers: boolean
  event: boolean
}
export interface WorldsTable extends TableHead {
  worlds: WorldRow[]
}

export interface SpendCatalogRules {
  tariffPercent: number
  rewardCoinPriceMeso: number
}
export interface SpendGroupRow {
  key: string
  name: string
  /** 지출 갈래 key(`cashbookCategories` 칸). 묶음마다 갈래가 하나다. */
  category: string
  /** 하루 목록 카드 첫 줄. */
  cardTitle: string
  active: boolean
}
export interface SpendTileRow {
  key: string
  name: string
  iconFile?: string
  iconMap?: string
}
export interface SpendItemRow {
  key: string
  group: string
  tile: string
  /** 원본 이름. 하루 목록 카드에도 선다. */
  name: string
  /** 좁은 자리용으로 줄인 이름. 없으면 `name` 을 쓴다. */
  shortName?: string
  tier?: string
  currency: 'point' | 'meso'
  /** `null` 은 경매장 값이라 적을 때 친다. */
  unitPrice: number | null
  unit: string
  maxQuantity?: number
  rewardCoins?: number
  from?: string
  until?: string
}
export interface SpendItemOptionRow {
  item: string
  axis: string
  value: string
}
export interface SpendItemFormRow {
  item: string
  /** 형태 key(`SpendFormRow.key`). */
  form: string
}
export interface SpendFormRow {
  /** 앱 코드가 이 값으로 갈린다(`exp` · `sol_erda`). */
  key: string
  /** 카드에도 이 이름이 선다. */
  name: string
}
export interface SpendCatalogTable extends TableHead {
  rules: SpendCatalogRules
  groups: SpendGroupRow[]
  tiles: SpendTileRow[]
  items: SpendItemRow[]
  itemOptions: SpendItemOptionRow[]
  itemForms: SpendItemFormRow[]
  forms: SpendFormRow[]
}

export interface CashbookCategoryRow {
  entryType: 'income' | 'spend'
  /** 기록이 든다. 앱이 입력 폼을 모르는 key 도 온다. */
  key: string
  name: string
  /** 묶음이 없는 갈래의 하루 목록 카드 첫 줄. */
  cardTitle: string
  iconFile: string
  /** 갈래 카드 한 줄. 빈 글자일 수 있다. */
  description: string
  /** 묶음이 없는 갈래의 수량 단위. */
  unit?: string
}
export interface CashbookItemKindRow {
  key: string
  name: string
  /** 수량 단위. 없으면 수량이 없다(장비). */
  unit?: string
  hasTariff: boolean
}
/** 갈래는 수입 · 지출 순서이고 그 안은 차례대로다. */
export interface CashbookCategoriesTable extends TableHead {
  categories: CashbookCategoryRow[]
  itemKinds: CashbookItemKindRow[]
}

export interface SymbolGroupRow {
  key: string
  name: string
  maxLevel: number
  defaultFrom: number
  defaultTo: number
}
export interface SymbolRow {
  key: string
  group: string
  name: string
  requiredLevel: number
  iconFile: string
}
export interface SymbolLevelCostRow {
  symbol: string
  /** 강화 전 레벨. Lv.level → level+1 의 값이다. */
  level: number
  costMeso: number
  from?: string
  until?: string
}
export interface SymbolCostsTable extends TableHead {
  groups: SymbolGroupRow[]
  symbols: SymbolRow[]
  levelCosts: SymbolLevelCostRow[]
}

/** 컨텐츠 갈래 key. 카드 모양 · 길드 판정 · 계열 한도가 이 값으로 갈려 코드가 집합을 든다. 글자는 표가 든다. */
export const CONTENT_CATEGORY_KEYS = [
  'monster_park',
  'daily_quest',
  'epic_dungeon',
  'maple_union',
  'arcane_river_quest',
  'weekly_quest',
  'mu_lung_dojo',
  'guild',
] as const
export type ContentCategoryKey = (typeof CONTENT_CATEGORY_KEYS)[number]

export type ContentSection = 'daily' | 'weekly'
export type ShareScope = 'character' | 'world' | 'account'

export interface ContentCategoryRow {
  key: ContentCategoryKey
  /** 카드 라벨 · today 공유 위젯 머리글. */
  name: string
  /** 갈래의 참고 태그. 에픽 던전 `ID당 1회`. */
  countTag?: string
  /** 참이면 그 갈래의 태그를 숨긴다. 아케인리버 지역 퀘스트. */
  hideCountTag: boolean
  /** 갈래의 주간 진행 한도. 에픽 던전 3. */
  weeklyLimit?: number
  /** today 공유 위젯의 계열 차례. 없으면 뒤에 선다. */
  sharedOrder?: number
}
export interface ContentRow {
  key: string
  section: ContentSection
  /** 넥슨 응답의 `content_name`. */
  apiName: string
  category: ContentCategoryKey
  displayName: string
  shortName: string
  backgroundMap?: string
  backgroundPortrait?: string
  /** 컨텐츠가 참고 태그를 덮는 글자. */
  countTag?: string
  type: 'contents' | 'quest'
  /** 수동 모드의 기본 상한. */
  maxCount: number
  requiredLevel?: number
  from?: string
  until?: string
  shareScope: ShareScope
  /** today 공유 위젯의 글자. 공유 줄만 든다. */
  sharedShortName?: string
  onlyWhenScheduled: boolean
  trustRegistrationFlag: boolean
  cumulativeScore: boolean
  maxCountOverride?: number
}
export interface ContentsTable extends TableHead {
  categories: ContentCategoryRow[]
  /** 일간 뒤 주간. 섹션 안의 차례가 관리 화면의 차례다. */
  contents: ContentRow[]
}

export interface EquipmentItemRow {
  key: string
  /** 붙여 쓴 이름. */
  name: string
  /** 착용 레벨. `null` 은 모른다는 뜻이고 0 이 아니다. */
  level: number | null
}
export interface EquipmentItemsTable extends TableHead {
  items: EquipmentItemRow[]
}

export const POTENTIAL_RESET_TYPES = ['potential', 'additional'] as const
export type PotentialResetTypeKey = (typeof POTENTIAL_RESET_TYPES)[number]
export const POTENTIAL_GRADES = ['rare', 'epic', 'unique', 'legendary'] as const
export type PotentialGradeKey = (typeof POTENTIAL_GRADES)[number]

export interface EnhancementRules {
  cubeAppraisalFreeMaxLevel: number
  cubeAppraisalCoefficient: number
  starforceDestroyDefenceSurchargePercent: number
}
export interface PotentialResetCostRow {
  type: PotentialResetTypeKey
  /** 레벨 구간의 시작. 장비 레벨 이하인 줄 중 가장 큰 것이 그 레벨의 줄이다. */
  minLevel: number
  grade: PotentialGradeKey
  costMeso: number
}
export interface SoulPotentialResetCostRow {
  grade: PotentialGradeKey
  costMeso: number
}
export interface StarforceStepRow {
  /** 시도 전 성수. */
  fromStar: number
  exponent: number
  divisor: number
}
export interface EnhancementCostsTable extends TableHead {
  rules: EnhancementRules
  potentialResetCosts: PotentialResetCostRow[]
  soulPotentialResetCosts: SoulPotentialResetCostRow[]
  starforceSteps: StarforceStepRow[]
}

export const MVP_GRADE_KEYS = ['normal', 'bronze', 'silver', 'gold', 'diamond', 'red', 'black'] as const
export type MvpGradeKey = (typeof MVP_GRADE_KEYS)[number]

export interface MvpGradeRow {
  key: MvpGradeKey
  name: string
  auctionFeePercent: number
  starforceDiscountPercent: number
}
export interface MvpGradesTable extends TableHead {
  /** 낮은 등급부터. 이 차례가 높낮이다. */
  grades: MvpGradeRow[]
}

export const HUNT_LOOT_KINDS = ['fragment', 'consumable', 'event'] as const
export type HuntLootKind = (typeof HUNT_LOOT_KINDS)[number]

/** 사냥 전리품 판매의 아이템. `from` · `until` 은 이벤트 아이템이 서는 기간이다(KST 날짜). */
export interface HuntLootRow {
  key: string
  kind: HuntLootKind
  name: string
  iconFile: string
  /** 소비 아이템의 NPC 개당 가격. 소비에만 있고 소비에는 반드시 있다. */
  npcPriceMeso: number | null
  from?: string
  until?: string
}
export interface HuntLootTable extends TableHead {
  /** 이 차례가 폼의 차례다. */
  items: HuntLootRow[]
}

export interface HuntingRegionRow {
  key: string
  name: string
  forceType: ForceType
}
export interface HuntingGroundRow {
  key: string
  region: string
  name: string
  force: number
  mobs: number
}
export interface HuntingGroundLevelRow {
  ground: string
  level: number
}
export interface HuntingGroundsTable extends TableHead {
  regions: HuntingRegionRow[]
  grounds: HuntingGroundRow[]
  groundLevels: HuntingGroundLevelRow[]
}

/** 서버 그림 한 장. 앱은 `path` 로 찾고 기기에는 `file`(내용 해시 이름)로 둔다. */
export interface AssetFileRow {
  /** 서버 경로. `bosses/bellona.webp` 처럼 디렉터리와 파일 이름이다 */
  path: string
  /** `<sha256>.<확장자>`. 서버 `/assets/` 아래와 기기 디렉터리의 이름이다 */
  file: string
  sha256: string
  /** 바이트 */
  size: number
  width: number
  height: number
}
export interface AssetFilesTable extends TableHead {
  files: AssetFileRow[]
}

/** 크롭 표의 종류. 같은 그림도 놓이는 자리마다 잘 보이는 곳이 달라 표가 갈린다. */
export const IMAGE_CROP_KINDS = ['boss_portrait', 'boss_portrait_icon', 'boss_portrait_modal', 'daily_quest_region'] as const
export type ImageCropKind = (typeof IMAGE_CROP_KINDS)[number]

export interface ImageCropRow {
  kind: ImageCropKind
  /** 보스는 `portraitSlug`, 지역은 `backgroundMap` 의 값 */
  slug: string
  /** CSS `background-size` 문법(`120% auto`) */
  size: string
  /** CSS `background-position` 문법(`50% 40%`) */
  position: string
}
export interface ImageCropsTable extends TableHead {
  crops: ImageCropRow[]
}

/** 계약을 통과한 칸 열일곱. */
export interface GameData {
  bosses: BossCatalog
  dropItems: DropItemsTable
  bossDrops: BossDropsTable
  dropBoxes: DropBoxesTable
  crystalPrices: CrystalPricesTable
  worlds: WorldsTable
  spendCatalog: SpendCatalogTable
  cashbookCategories: CashbookCategoriesTable
  symbolCosts: SymbolCostsTable
  contents: ContentsTable
  equipmentItems: EquipmentItemsTable
  enhancementCosts: EnhancementCostsTable
  mvpGrades: MvpGradesTable
  huntingGrounds: HuntingGroundsTable
  huntLoot: HuntLootTable
  assets: AssetFilesTable
  imageCrops: ImageCropsTable
}

export type GameDataSection = keyof GameData

/** 칸 이름 열일곱. 응답과 기기 사본이 같은 차례로 든다. */
export const GAME_DATA_SECTIONS: readonly GameDataSection[] = [
  'bosses',
  'dropItems',
  'bossDrops',
  'dropBoxes',
  'crystalPrices',
  'worlds',
  'spendCatalog',
  'cashbookCategories',
  'symbolCosts',
  'contents',
  'equipmentItems',
  'enhancementCosts',
  'mvpGrades',
  'huntingGrounds',
  'huntLoot',
  'assets',
  'imageCrops',
]

/** 서버 응답을 칸마다 검사한 결과. 못 받았거나 계약을 어겼거나 서버가 아직 안 넣은 칸은 `null` 이다. */
export type GameDataResponse = { [K in GameDataSection]: GameData[K] | null }
