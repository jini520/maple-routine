import { BOSS_PORTRAIT_ASSETS } from '../../assets/generated/bosses'
import { DAILY_QUEST_BACKGROUND_ASSETS } from '../../assets/generated/maps'
import { DAILY_QUEST_ICON_ASSETS } from '../../assets/generated/map-icons'
import { FORCE_ASSETS } from '../../assets/generated/force'
import type { ForceType } from '../../types/hunting-grounds'
import { ITEM_ASSETS } from '../../assets/generated/items'
import type { ImageAssetRef } from '../../types/image-asset'
import type { ImageCrop } from '../image-crop'
import { THEME_BACKGROUND_ASSETS } from '../../assets/generated/themes'
import { WORLD_EMBLEM_ASSETS } from '../../assets/generated/worlds'
import bossCropsData from '../../data/boss-portrait-crops.json'
import bossIconCropsData from '../../data/boss-portrait-icon-crops.json'
/**
 * 이름표를 번들 에셋으로 바꾼다. 앱의 그림은 이 길로만 화면에 붙는다.
 *
 * 전부 같은 모양이다. `키 → (표를 한 번 거쳐) ASSETS[…] ?? null`.
 *
 * **조회 쪽을 NFC 로 정규화한다.** macOS 파일시스템은 한글 파일명을 NFD 로 저장하는데 소스의
 * 문자열 리터럴은 NFC 라, 육안으로 같아 보여도 키가 안 맞는다. 목록 쪽은 생성기가 맞춘다.
 *
 * **없으면 `null` 이고 화면이 비운다.** 비슷한 그림을 갖다 붙이면 틀린 것을 그리는 셈이다.
 *
 * @see. 목록(`assets/generated/*`)은 빌드가 아니라 커밋 시점에 생성된다.
 * @see. 모르는 것을 그리지 않는다.
 */
import bossRingBoxesData from '../../data/boss-ring-boxes.json'
import dailyQuestCropsData from '../../data/daily-quest-region-crops.json'
import itemIconsData from '../../data/item-icons.json'
import worldEmblemsData from '../../data/world-emblems.json'

type AssetMap = Record<string, ImageAssetRef>

function bySlug(assets: AssetMap, slug: string | null): ImageAssetRef | null {
  if (slug === null) return null
  return assets[slug.normalize('NFC')] ?? null
}

// ── 보스 초상 ────────────────────────────────────────────────────────────────────────

/**
 * 같은 그림이라도 카드 bleed 와 원형 아이콘은 잘 보이는 자리가 달라 크롭 표가 둘이다. 값은
 * 사용자가 눈으로 맞춘 것이라 AI 가 채우지 않는다.
 *
 * @see
 */
const BOSS_PORTRAIT_CROPS = bossCropsData as Record<string, ImageCrop>
const BOSS_PORTRAIT_ICON_CROPS = bossIconCropsData as Record<string, ImageCrop>
const DAILY_QUEST_REGION_CROPS = dailyQuestCropsData as Record<string, ImageCrop>

const DEFAULT_CROP: ImageCrop = { size: 'cover', position: 'center' }

function cropBySlug(table: Record<string, ImageCrop>, slug: string | null): ImageCrop {
  if (slug === null) return DEFAULT_CROP
  return table[slug.normalize('NFC')] ?? DEFAULT_CROP
}

export function getBossPortraitUrl(portraitSlug: string | null): ImageAssetRef | null {
  return bySlug(BOSS_PORTRAIT_ASSETS, portraitSlug)
}

export function getBossPortraitCrop(portraitSlug: string | null): ImageCrop {
  return cropBySlug(BOSS_PORTRAIT_CROPS, portraitSlug)
}

export function getBossPortraitIconCrop(portraitSlug: string | null): ImageCrop {
  return cropBySlug(BOSS_PORTRAIT_ICON_CROPS, portraitSlug)
}

// ── 일일·주간 퀘스트 지역 ────────────────────────────────────────────────────────────

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): ImageAssetRef | null {
  return bySlug(DAILY_QUEST_BACKGROUND_ASSETS, backgroundSlug)
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): ImageCrop {
  return cropBySlug(DAILY_QUEST_REGION_CROPS, backgroundSlug)
}

export function getDailyQuestRegionIconUrl(backgroundSlug: string | null): ImageAssetRef | null {
  return bySlug(DAILY_QUEST_ICON_ASSETS, backgroundSlug)
}

// ── 테마 배경 ────────────────────────────────────────────────────────────────────────

/** 파일이 없으면 배경만 사라지고 테마는 산다. @see */
export function getThemeBackgroundUrl(slug: string): ImageAssetRef | null {
  return bySlug(THEME_BACKGROUND_ASSETS, slug)
}

// ── 월드 엠블럼 ──────────────────────────────────────────────────────────────────────

/** 월드 이름 → 엠블럼 파일의 basename. **여기서는 NFC 를 안 건다.** 표의 키가 소스 리터럴이다. */
const basenameByWorld = worldEmblemsData as Record<string, string>

export function worldEmblemUrl(world: string): ImageAssetRef | null {
  const basename = basenameByWorld[world]
  if (basename === undefined) return null

  return WORLD_EMBLEM_ASSETS[basename] ?? null
}

/** 월드를 아는 것은 이 표뿐이라 판정도 여기서 한다. @see */
export function isChallengersWorld(world: string): boolean {
  return basenameByWorld[world] === 'challengers'
}

// ── 포스 ─────────────────────────────────────────────────────────────────────────────

export const FORCE_LABELS: Record<ForceType, string> = {
  arcane: '아케인 포스',
  authentic: '어센틱 포스',
}

const FORCE_SLUGS: Record<ForceType, string> = {
  arcane: 'arcane-force',
  authentic: 'authentic-force',
}

export function forceIconOf(forceType: ForceType): ImageAssetRef | null {
  return FORCE_ASSETS[FORCE_SLUGS[forceType]] ?? null
}

// ── 아이템 아이콘 ────────────────────────────────────────────────────────────────────

/** 이름에서 파일명을 계산하지 않고 표에서 찾는다. @see */
interface ItemIconEntry {
  name: string
  iconFile?: string
  iconFileBySlot?: Record<string, string>
}

type IconMapping = string | Record<string, string>

const iconByName: Record<string, IconMapping> = {}

// 반지를 먼저 넣고 `item-icons` 가 덮어써 우선한다. `생명의 연마석` 은 반지 표에선 `iconFile` 이
// null 이고 `item-icons` 의 `whetstone_life.png` 가 실제 아이콘이라 후자가 이겨야 한다.
for (const box of bossRingBoxesData.boxes) {
  for (const ring of box.itemProbabilities) {
    if (ring.iconFile) {
      iconByName[ring.name.normalize('NFC')] = ring.iconFile
    }
  }
}
for (const item of itemIconsData.items as ItemIconEntry[]) {
  if (item.iconFileBySlot !== undefined) {
    iconByName[item.name.normalize('NFC')] = item.iconFileBySlot
  } else if (item.iconFile !== undefined) {
    iconByName[item.name.normalize('NFC')] = item.iconFile
  }
}

// `기타`는 백옥 반지 상자 목록 밖 저가치 반지 묶음이다. 실재 아이템명이 아니라 UI
// 전용이라 `item-icons.json`(정합성 테스트가 드랍테이블 실재를 강제한다)이 아니라 여기서 맨다.
iconByName['기타'.normalize('NFC')] = 'Limit_Ring.webp'

/** 슬롯별 매핑(`iconFileBySlot`, 현재 데이터엔 없다)은 `slot` 이 있어야 특정할 수 있다. */
export function getItemIconUrl(name: string, slot?: string): ImageAssetRef | null {
  const mapping = iconByName[name.normalize('NFC')]
  if (mapping === undefined) return null

  const fileName =
    typeof mapping === 'string' ? mapping : slot === undefined ? undefined : mapping[slot]
  if (fileName === undefined) return null

  return ITEM_ASSETS[fileName.normalize('NFC')] ?? null
}

/** 실재 아이템명이 아닌 표시 전용 아이콘(솔 에르다 단위 분해 등)은 파일명으로만 참조된다. */
export function getItemIconUrlByFile(fileName: string): ImageAssetRef | null {
  return ITEM_ASSETS[fileName.normalize('NFC')] ?? null
}

// ── 지출 타일 ────────────────────────────────────────────────────────────────────────

/**
 * 키가 **타일에 적히는 이름**이다(카탈로그의 `base ?? name`). 카탈로그를 사용자가 고치면 이 표도
 * 함께 고쳐야 하고, 안 고치면 그림만 조용히 사라진다. `SpendSheet.test` 가 그 자리를 붙든다.
 *
 * 표가 둘인 것은 원천이 둘이라서다. 에픽던전 셋만 지역 아이콘을 쓰는데(일일 퀘스트 화면과 같은
 * 그림이다) 두 생성물의 키 모양이 달라 파일명과 슬러그가 섞이면 안 된다.
 *
 * @see
 */
const ITEM_ICON_BY_LABEL: Record<string, string> = {
  '몬스터 파크': 'monster_park_ticket.webp',
  '에픽던전': 'cerzar.webp',
  '일간 퀘스트': 'grandis_spiegelmann.webp',
  '주간 퀘스트': 'arcane_river_spiegelmann.webp',
  '메카베리 농장': 'mechaberry_farm_ticket.webp',
  '블루베리 농장': 'blueberry_farm_ticket.webp',
  '솔 에르다': 'sole_1000.webp',
  '블랙 서큘레이터': 'black_circulator.webp',
  '미호로이드': 'mihoroid.webp',
  'VIP 사우나': 'vip_sauna_ticket.webp',
  '닉네임 변경': 'npc_mr_newname.webp',
  '세이람의 영약': 'seiram_elixir.webp',
  '알레리아의 영약': 'alleria_elixir.webp',
  '콜렉터의 영약': 'collector_elixir.webp',
  '명예의 영약': 'honor_elixir.webp',
}

const MAP_ICON_BY_LABEL: Record<string, string> = {
  '하이마운틴': 'highMountain',
  '앵글러 컴퍼니': 'anglerCompany',
  '악몽선경': 'nightmareParadise',
}

/**
 * 그림과 **서는 자리**를 함께 든다. `beside` 는 이름 바로 옆이고 아니면 타일 왼쪽 끝이다.
 *
 * 지금은 `지역 아이콘이면 이름 옆` 이 우연히 일치하지만 그 둘은 다른 이야기라, 자리를 표가 아니라
 * 이 값이 직접 말한다(사용자 지정 2026-08-28).
 */
export interface SpendIcon {
  readonly ref: ImageAssetRef
  readonly beside: boolean
}

export function spendIconOf(label: string): SpendIcon | null {
  const file = ITEM_ICON_BY_LABEL[label]
  if (file !== undefined) {
    const ref = ITEM_ASSETS[file]
    return ref === undefined ? null : { ref, beside: false }
  }

  const slug = MAP_ICON_BY_LABEL[label]
  if (slug !== undefined) {
    const ref = DAILY_QUEST_ICON_ASSETS[slug]
    return ref === undefined ? null : { ref, beside: true }
  }

  return null
}
