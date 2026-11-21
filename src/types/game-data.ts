/**
 * 우리 서버 `GET /v1/game-data` 의 칸 스물. 칸 하나가 표 하나이고 기기 사본과 테스트 fixture(`src/__fixtures__/game-data/`)도
 * 같은 모양이다.
 *
 * 응답은 전부 납작한 줄 표다. 보스 · 난이도 · 분류로 묶거나 지역 안에 사냥터를 품는 것은 조회 모듈이 한다. 선택 칸은
 * 응답에서 `null` 이고 계약 검사(`parse`)를 거친 뒤에는 빠진 칸이다.
 *
 * 계약의 원본은 서버 저장소와 이 앱이 나눠 갖는다. 칸을 더할 때 양쪽을 함께 본다.
 */
import type { BossCatalog } from './boss-catalog'
import type { DropCategory } from './drops'
import type { FaqBlock } from './faq'
import type { ForceType } from './hunting-grounds'

/**
 * 게임 규칙 아홉. 서버 `game_rules` 표의 한 줄이고 칸 이름도 그 표를 따른다. 보스 · 가계부 지출 · 강화 비용이 읽는다.
 */
export interface GameRules {
  /** 캐릭터 한 명의 주간 보스 등록 · 처치 한도 */
  weeklyBossSelectionLimit: number
  /** 한도 줄마다의 주간 결정석 판매 한도 */
  weeklyCrystalSaleLimit: number
  /** 난이도 줄에 파티 인원 상한이 없을 때의 상한 */
  defaultMaxPartySize: number
  /** 월드 간 거래 구매에 붙는 관세(%) */
  spendTariffPercent: number
  /** 세라자르 주화 한 개의 메소 값 */
  rewardCoinPriceMeso: number
  /** 메소마켓 수수료(%)의 기본값 */
  mesoMarketFeePercent: number
  /** 감정비용이 없는 장비 레벨의 상한 */
  cubeAppraisalFreeMaxLevel: number
  /** 감정비용 = 계수 × 레벨 × 레벨 */
  cubeAppraisalCoefficient: number
  /** 스타포스 파괴 방지 추가분(%) */
  starforceDestroyDefenceSurchargePercent: number
}
export interface GameRulesTable extends TableHead {
  gameRules: GameRules
}

/** 칸 맨 위의 시각. `null` 은 서버에서 받은 적 없는 사본이다. */
export interface TableHead {
  updatedAt: string | null
}

/** 보스 난이도의 보상 한 줄. */
export interface BossDifficultyRewardRow {
  /** 난이도 줄 id(`bosses` 칸의 `bossDifficulties`) */
  bossDifficultyId: string
  category: DropCategory
  /** 아이템 줄 id(`items` 칸) */
  itemId: string
  /** 고정 보상의 수량. 장비 · 소비 보상은 빠진다. */
  quantity?: number
  validFrom?: string
  validUntil?: string
}
export interface BossDropsTable extends TableHead {
  bossDifficultyRewards: BossDifficultyRewardRow[]
}

/** 개봉 결과를 직접 고르는 상자 한 줄. */
export interface DropBoxRow {
  id: string
  /** 상자의 아이템 줄 id */
  itemId: string
  /** 반지 상자만 든다. 장신구 상자는 둘 다 빠진다. */
  ringLevelMin?: number
  ringLevelMax?: number
}
/** 상자의 개봉 후보 한 줄. 한 상자의 줄 차례가 화면 차례다. */
export interface DropBoxContentRow {
  boxId: string
  itemId: string
}
export interface DropBoxesTable extends TableHead {
  dropBoxes: DropBoxRow[]
  dropBoxContents: DropBoxContentRow[]
}

export interface BossCrystalPriceRow {
  /** 난이도 줄 id(`bosses` 칸의 `bossDifficulties`) */
  bossDifficultyId: string
  priceMeso: number
  validFrom?: string
  validUntil?: string
}
export interface CrystalPricesTable extends TableHead {
  bossCrystalPrices: BossCrystalPriceRow[]
}

export interface WorldRow {
  id: string
  key: string
  /** API `world_name` 표기. 보이는 이름이다. */
  name: string
  /** 엠블럼 그림 id. 스페셜은 빠진다. */
  emblemAssetId?: string
  isChallengers: boolean
  isEvent: boolean
}
/**
 * 월드가 열린 기간 한 줄. 이벤트 · 챌린저스 월드는 같은 이름으로 다시 열려 한 월드에 여러 줄이다.
 *
 * KST `YYYY-MM-DD`. `validFrom` 은 연 날, `validUntil` 은 닫힌 다음 날이라 기간에 안 든다.
 */
export interface WorldOpenPeriodRow {
  worldId: string
  validFrom: string
  validUntil: string
}
export interface WorldsTable extends TableHead {
  worlds: WorldRow[]
  worldOpenPeriods: WorldOpenPeriodRow[]
}

/** 추가 리워드 종류. 앱 코드가 key 로 갈린다(`exp` · `sol_erda`). 카드에도 이 이름이 선다. */
export interface SpendRewardTypeRow {
  id: string
  key: string
  name: string
}
export interface SpendGroupRow {
  id: string
  key: string
  name: string
  /** 하루 목록 카드 첫 줄. */
  cardTitle: string
  /** 지출 분류 줄 id(`cashbookCategories` 칸). 묶음마다 분류가 하나다. */
  cashbookCategoryId: string
  /** 지금 고를 수 있는 묶음인가. 기간제 묶음은 날짜가 아니라 이 값으로 닫는다. 이벤트가 미뤄지면 날짜로 한 판정이 틀린다. */
  isActive: boolean
}
export interface SpendTileRow {
  id: string
  key: string
  name: string
  /** 아이템 그림이나 지역 아이콘의 그림 id. 그림이 없는 타일은 빠진다. */
  iconAssetId?: string
}
export interface SpendItemRow {
  id: string
  key: string
  /** 원본 이름. 하루 목록 카드에도 선다. */
  name: string
  groupId: string
  tileId: string
  tier?: string
  currency: 'point' | 'meso'
  /** `null` 은 경매장 값이라 적을 때 친다. */
  unitPrice: number | null
  unit: string
  maxQuantity?: number
  /** 추가 리워드 종류 하나를 샀을 때 받는 세라자르 주화 개수 */
  rewardCoinQuantity?: number
  validFrom?: string
  validUntil?: string
}
export interface SpendItemOptionRow {
  itemId: string
  axis: string
  value: string
}
export interface SpendItemRewardTypeRow {
  itemId: string
  rewardTypeId: string
}
export interface SpendCatalogTable extends TableHead {
  spendRewardTypes: SpendRewardTypeRow[]
  spendGroups: SpendGroupRow[]
  spendTiles: SpendTileRow[]
  spendItems: SpendItemRow[]
  spendItemOptions: SpendItemOptionRow[]
  spendItemRewardTypes: SpendItemRewardTypeRow[]
}

export interface CashbookCategoryRow {
  id: string
  entryType: 'income' | 'spend'
  /** 기록이 든다. 앱이 입력 폼을 모르는 key 도 온다. */
  key: string
  name: string
  /** 묶음이 없는 분류의 하루 목록 카드 첫 줄. */
  cardTitle: string
  iconAssetId: string
  /** 분류 카드 한 줄. 빈 글자일 수 있다. */
  description: string
  /** 묶음이 없는 분류의 수량 단위. */
  unit?: string
}
export interface CashbookItemTypeRow {
  id: string
  key: string
  name: string
  /** 수량 단위. 없으면 수량이 없다(장비). */
  unit?: string
  hasTariff: boolean
}
/** 분류는 수입 · 지출 순서이고 그 안은 차례대로다. */
export interface CashbookCategoriesTable extends TableHead {
  cashbookCategories: CashbookCategoryRow[]
  cashbookItemTypes: CashbookItemTypeRow[]
}

export interface SymbolGroupRow {
  id: string
  key: string
  name: string
  maxLevel: number
  /** 심볼을 고르는 순간 서는 강화 전 레벨 */
  defaultFromLevel: number
  /** 심볼을 고르는 순간 서는 강화 후 레벨 */
  defaultToLevel: number
}
export interface SymbolRow {
  id: string
  key: string
  groupId: string
  name: string
  requiredLevel: number
  iconAssetId: string
}
export interface SymbolLevelCostRow {
  symbolId: string
  /** 강화 전 레벨. Lv.fromLevel → fromLevel+1 의 값이다. */
  fromLevel: number
  costMeso: number
  validFrom?: string
  validUntil?: string
}
export interface SymbolCostsTable extends TableHead {
  symbolGroups: SymbolGroupRow[]
  symbols: SymbolRow[]
  symbolLevelCosts: SymbolLevelCostRow[]
}

/** 헥사 코어 종류. API 타입마다 기본 종류가 하나이고, 나머지 종류는 이름 표가 코어를 가리킨다. */
/** 직업 하나. 넥슨 `character_class` 의 이름이고, 모든 직업이 함께 쓰는 코어는 `전직업` 줄(`isAllJobs`)을 가리킨다. */
export interface JobRow {
  id: string
  name: string
  isAllJobs: boolean
}
export interface HexaCoreTypeRow {
  id: string
  key: string
  name: string
  /** 넥슨 `hexa_core_type` 의 글자. */
  apiType: string
  isDefault: boolean
  maxLevel: number
  iconAssetId: string
  /** 한 직업의 코어 목록에서 종류의 차례 */
  sortOrder: number
}
export interface HexaCoreRow {
  id: string
  jobId: string
  /** 넥슨이 주는 코어 이름. 같은 이름도 직업마다 다른 줄이다. */
  name: string
  typeId: string
  iconAssetId: string
  /** 한 직업의 같은 종류 안에서의 차례 */
  sortOrder: number
}
export interface HexaCoreLevelCostRow {
  typeId: string
  /** 강화 전 레벨. Lv.fromLevel → fromLevel+1 의 값이다. */
  fromLevel: number
  fragmentQuantity: number
  solErdaQuantity: number
}
export interface HexaStatRow {
  id: string
  key: string
  name: string
  /** 모르면 없다. 그때 활성화 체크를 막는다. */
  activationFragmentQuantity?: number
}
export interface HexaMatrixTable extends TableHead {
  jobs: JobRow[]
  hexaCoreTypes: HexaCoreTypeRow[]
  hexaCores: HexaCoreRow[]
  hexaCoreLevelCosts: HexaCoreLevelCostRow[]
  hexaStats: HexaStatRow[]
}

/** 컨텐츠 분류 key. 카드 모양 · 길드 판정 · 계열 한도가 이 값으로 갈려 코드가 집합을 든다. 글자는 표가 든다. */
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
  /** 분류의 참고 태그. 에픽 던전 `ID당 1회`. */
  countTag?: string
  /** 참이면 그 분류의 태그를 숨긴다. 아케인리버 지역 퀘스트. */
  hideCountTag: boolean
  /** 분류의 주간 진행 한도. 에픽 던전 3. */
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
  /** 카드 그림 id. 지도 배경과 보스 초상 중 하나다. 둘 다 없으면 카드가 그림 없이 선다. */
  backgroundMapAssetId?: string
  backgroundPortraitAssetId?: string
  /** 지도 배경 카드 옆의 지역 아이콘 그림 id. */
  regionIconAssetId?: string
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

export const POTENTIAL_RESET_TYPES = ['potential', 'additional'] as const
export type PotentialResetTypeKey = (typeof POTENTIAL_RESET_TYPES)[number]
export const POTENTIAL_GRADES = ['rare', 'epic', 'unique', 'legendary'] as const
export type PotentialGradeKey = (typeof POTENTIAL_GRADES)[number]

export interface PotentialResetCostRow {
  type: PotentialResetTypeKey
  /** 레벨 구간의 시작. 장비 레벨 이하인 줄 중 가장 큰 것이 그 레벨의 줄이다. */
  minRequiredLevel: number
  grade: PotentialGradeKey
  costMeso: number
}
export interface SoulPotentialResetCostRow {
  grade: PotentialGradeKey
  costMeso: number
}
export interface StarforceCostStepRow {
  /** 시도 전 성수. */
  fromStar: number
  exponent: number
  divisor: number
}
/** 슈페리얼 장비의 계열. 스타포스 1회 비용이 계열마다 하나이고, 성수 · 할인과 상관없다. */
export interface SuperiorSeriesRow {
  id: string
  key: string
  name: string
  starforceCostMeso: number
}
/** 슈페리얼 장비 하나. 넥슨 응답의 장비 이름과 공백을 지운 뒤 통째로 맞춘다. */
export interface SuperiorItemRow {
  name: string
  seriesId: string
  /** 펼친 강화 줄의 장비 그림. 아이템 표에 없는 슈페리얼 장비도 그림이 서게 둔다. 없으면 빠진다 */
  iconAssetId?: string
}
export interface EnhancementCostsTable extends TableHead {
  potentialResetCosts: PotentialResetCostRow[]
  soulPotentialResetCosts: SoulPotentialResetCostRow[]
  starforceCostSteps: StarforceCostStepRow[]
  superiorSeries: SuperiorSeriesRow[]
  superiorItems: SuperiorItemRow[]
}

export const MVP_GRADE_KEYS = ['normal', 'bronze', 'silver', 'gold', 'diamond', 'red', 'black'] as const
export type MvpGradeKey = (typeof MVP_GRADE_KEYS)[number]

export interface MvpGradeRow {
  id: string
  key: MvpGradeKey
  name: string
  auctionFeePercent: number
  starforceDiscountPercent: number
  /** 명패 그림 id. 일반 등급은 명패가 없어 빠진다. */
  plateAssetId?: string
}
export interface MvpGradesTable extends TableHead {
  /** 낮은 등급부터. 이 차례가 높낮이다. */
  mvpGrades: MvpGradeRow[]
}

export const HUNT_LOOT_TYPES = ['fragment', 'consumable', 'event'] as const
export type HuntLootType = (typeof HUNT_LOOT_TYPES)[number]

/** 사냥 전리품 판매의 아이템. 기간은 이벤트 아이템이 서는 기간이다(KST 날짜). */
export interface HuntLootItemRow {
  /** 아이템 줄 id(`items` 칸). 이름 · 그림은 아이템 표에서 읽는다. */
  itemId: string
  type: HuntLootType
  /** 소비 아이템의 NPC 개당 가격. 소비에만 있고 소비에는 반드시 있다. */
  npcPriceMeso: number | null
  validFrom?: string
  validUntil?: string
}
export interface HuntLootTable extends TableHead {
  /** 이 차례가 폼의 차례다. */
  huntLootItems: HuntLootItemRow[]
}

export interface HuntingRegionRow {
  id: string
  key: string
  name: string
  forceType: ForceType
  /** 지역 아이콘 그림 id. 없으면 빠진다. */
  iconAssetId?: string
}
export interface HuntingGroundRow {
  id: string
  key: string
  regionId: string
  name: string
  /** 아케인/어센틱 포스 요구치 */
  requiredForce: number
  /** 맵에 한 번에 뜨는 몬스터 마릿수 */
  mobQuantity: number
  isPopular: boolean
}
export interface HuntingGroundLevelRow {
  groundId: string
  mobLevel: number
}
export interface HuntingGroundsTable extends TableHead {
  huntingRegions: HuntingRegionRow[]
  huntingGrounds: HuntingGroundRow[]
  huntingGroundLevels: HuntingGroundLevelRow[]
}

/** 서버 그림 한 장. 앱은 게임 데이터 표의 그림 칸이 든 `id` 로 찾고 기기에는 `file`(내용 해시 이름)로 둔다. */
export interface AssetFileRow {
  id: string
  /** `<sha256>.<확장자>`. 서버 `/assets/` 아래와 기기 디렉터리의 이름이다 */
  file: string
  sha256: string
  sizeBytes: number
  width: number
  height: number
}
export interface AssetFilesTable extends TableHead {
  files: AssetFileRow[]
}

/**
 * 크롭 표의 종류. 같은 그림도 놓이는 자리마다 잘 보이는 곳이 달라 표가 갈린다.
 *
 * `boss_portrait_modal` 은 앱이 더 읽지 않지만 서버 표에 줄이 남아 있다. 여기서 빼면 그 줄이 계약을 어겨 크롭 표
 * 전체를 버린다.
 */
export const IMAGE_CROP_KINDS = ['boss_portrait', 'boss_portrait_icon', 'boss_portrait_modal', 'daily_quest_region'] as const
export type ImageCropKind = (typeof IMAGE_CROP_KINDS)[number]

export interface ImageCropRow {
  kind: ImageCropKind
  /** 자르는 그림 id. 보스 초상이나 지역 지도다 */
  assetId: string
  /** CSS `background-size` 문법(`120% auto`) */
  size: string
  /** CSS `background-position` 문법(`50% 40%`) */
  position: string
}
export interface ImageCropsTable extends TableHead {
  crops: ImageCropRow[]
}

/** FAQ 묶음. 묶음 하나가 시트 하나이고 key 는 화면이 물음표에 다는 이름이다. */
export interface FaqSheetRow {
  key: string
  title: string
}
export interface FaqItemRow {
  /** 묶음 key */
  sheet: string
  question: string
  /** 앱이 아는 종류의 블록만 남긴 것. 하나 이상이다 */
  answer: FaqBlock[]
}
/** 한 묶음의 문항 차례는 `items` 의 차례다. */
export interface FaqsTable extends TableHead {
  sheets: FaqSheetRow[]
  items: FaqItemRow[]
}

/** 붙일 게임 데이터 표가 없는 앱 그림. key 는 앱 코드가 그림을 찾는 이름이다. */
export interface AppImageRow {
  key: string
  assetId: string
}
export interface AppImagesTable extends TableHead {
  images: AppImageRow[]
}

/** 아이템 표 한 줄. 드롭 · 강화 장비 · 고르기 목록이 모두 이 표에서 아이템을 찾는다. */
export interface ItemRow {
  id: string
  key: string
  name: string
  /** 묶음 줄 id(`itemGroups`). 묶음이 없는 아이템은 빠진다. */
  groupId?: string
  /** 그림 id(`assets` 칸). 그림이 없는 아이템은 빠진다. */
  iconAssetId?: string
  /** 보스 드롭으로 적을 수 있는 아이템 */
  isDrop: boolean
  /** 고가 드롭. 화면의 고가 배지와 연출이 이 칸 하나로 가른다. */
  isValuable: boolean
  /** 강화 기록이 가리키는 장비 */
  isEquipment: boolean
  /** 착용 레벨. 모르면 빠지고 0 이 아니다. */
  requiredLevel?: number
}
/** 아이템 묶음. `type` 은 서버 분류 트리의 첫 단(장비 · 장신구 · 소비 · 기타 · 캐시)이고 묶음은 둘째 단이다. */
export interface ItemGroupRow {
  id: string
  key: string
  name: string
  type: string
  sortOrder: number
}
/** 특수스킬 반지의 레벨 줄. 레벨마다 다른 아이템 줄이고 원래 반지를 가리킨다. */
export interface RingLevelItemRow {
  itemId: string
  ringItemId: string
  ringLevel: number
}
/** 다른 줄로 둔 같은 물건. 상자에서 나온 연마석처럼 따로 적어야 하는 아이템이 원래 아이템을 가리킨다. */
export interface SameItemLinkRow {
  itemId: string
  originalItemId: string
}
export interface ItemsTable extends TableHead {
  items: ItemRow[]
  itemGroups: ItemGroupRow[]
  ringLevelItems: RingLevelItemRow[]
  sameItemLinks: SameItemLinkRow[]
}

/** 계약을 통과한 칸 스물. */
export interface GameData {
  bosses: BossCatalog
  bossDrops: BossDropsTable
  dropBoxes: DropBoxesTable
  crystalPrices: CrystalPricesTable
  worlds: WorldsTable
  spendCatalog: SpendCatalogTable
  cashbookCategories: CashbookCategoriesTable
  symbolCosts: SymbolCostsTable
  hexaMatrix: HexaMatrixTable
  contents: ContentsTable
  enhancementCosts: EnhancementCostsTable
  mvpGrades: MvpGradesTable
  huntingGrounds: HuntingGroundsTable
  huntLoot: HuntLootTable
  assets: AssetFilesTable
  imageCrops: ImageCropsTable
  faqs: FaqsTable
  appImages: AppImagesTable
  items: ItemsTable
  gameRules: GameRulesTable
}

export type GameDataSection = keyof GameData

/** 칸 이름 스물. 응답과 기기 사본이 같은 차례로 든다. */
export const GAME_DATA_SECTIONS: readonly GameDataSection[] = [
  'bosses',
  'bossDrops',
  'dropBoxes',
  'crystalPrices',
  'worlds',
  'spendCatalog',
  'cashbookCategories',
  'symbolCosts',
  'hexaMatrix',
  'contents',
  'enhancementCosts',
  'mvpGrades',
  'huntingGrounds',
  'huntLoot',
  'assets',
  'imageCrops',
  'faqs',
  'appImages',
  'items',
  'gameRules',
]

/** 서버 응답을 칸마다 검사한 결과. 못 받았거나 계약을 어겼거나 서버가 아직 안 넣은 칸은 `null` 이다. */
export type GameDataResponse = { [K in GameDataSection]: GameData[K] | null }
