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
 * 이름표를 번들 에셋으로 바꾸는 조회. 앱의 그림은 이 길로만 화면에 붙는다.
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
import dailyQuestCropsData from '../../data/daily-quest-region-crops.json'
import worldEmblemsData from '../../data/world-emblems.json'
import { findDropItem } from '../drop/drop-items'

type AssetMap = Record<string, ImageAssetRef>

function bySlug(assets: AssetMap, slug: string | null): ImageAssetRef | null {
  if (slug === null) return null
  return assets[slug.normalize('NFC')] ?? null
}

// 보스 초상

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

// 일일·주간 퀘스트 지역

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): ImageAssetRef | null {
  return bySlug(DAILY_QUEST_BACKGROUND_ASSETS, backgroundSlug)
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): ImageCrop {
  return cropBySlug(DAILY_QUEST_REGION_CROPS, backgroundSlug)
}

export function getDailyQuestRegionIconUrl(backgroundSlug: string | null): ImageAssetRef | null {
  return bySlug(DAILY_QUEST_ICON_ASSETS, backgroundSlug)
}

// 테마 배경

/** 파일이 없으면 배경만 사라지고 테마는 산다. @see */
export function getThemeBackgroundUrl(slug: string): ImageAssetRef | null {
  return bySlug(THEME_BACKGROUND_ASSETS, slug)
}

// 월드 엠블럼

/** 월드 이름 → 엠블럼 파일의 basename. **여기서는 NFC 를 안 건다.** 표의 키가 소스 리터럴이다. */
const basenameByWorld = worldEmblemsData as Record<string, string>

export function worldEmblemUrl(world: string): ImageAssetRef | null {
  const basename = basenameByWorld[world]
  if (basename === undefined) return null

  return WORLD_EMBLEM_ASSETS[basename] ?? null
}

/** 월드를 아는 유일한 표라 판정도 여기 있다. @see */
export function isChallengersWorld(world: string): boolean {
  return basenameByWorld[world] === 'challengers'
}

// 포스

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

// 아이템 아이콘

/** 드롭 아이템 그림. 아이템 key 로 마스터 표(`drop-items.json`)의 파일을 찾는다. 모르는 key 는 `null` 이다. */
export function dropItemIconOf(itemKey: string | null | undefined): ImageAssetRef | null {
  const fileName = findDropItem(itemKey)?.iconFile
  return fileName === undefined ? null : (ITEM_ASSETS[fileName.normalize('NFC')] ?? null)
}

/** 파일명으로만 참조되는 표시 전용 아이콘(솔 에르다 단위 분해 등). */
export function getItemIconUrlByFile(fileName: string): ImageAssetRef | null {
  return ITEM_ASSETS[fileName.normalize('NFC')] ?? null
}

// 지출 타일

/**
 * 그림과 서는 자리를 함께 든 값. `beside` 는 이름 바로 옆이고 아니면 타일 왼쪽 끝이다.
 *
 * 지역 아이콘이면 이름 옆 이 지금은 우연히 일치하지만 그 둘은 다른 이야기라, 자리를 표가
 * 아니라 이 값이 직접 말한다.
 */
export interface SpendIcon {
  readonly ref: ImageAssetRef
  readonly beside: boolean
}

/**
 * 가계부 하루 상세 줄의 표식. 열쇠는 `features/cashbook/row-icon.ts` 가 만든다.
 *
 * 여기 없는 갈래는 `null` 이고 화면이 지금 아이콘을 그대로 쓴다. 비슷한 그림을 갖다 붙이면
 * 틀린 것을 그리는 셈이다.
 *
 * 결정석은 **주간** 것이다. 그림 둘의 픽셀을 재서 골랐다(weekly 가 보라 · monthly 는 금색).
 */
const CASHBOOK_ROW_ICON_BY_KEY: Record<string, string> = {
  '보스 결정석': 'intense_power_crystal_weekly.webp',
  // 큐브는 본잠·에디를 안 가르므로 그림도 하나다(사용자 지정).
  '큐브 재설정': 'cube_gold.png',
  '스타포스': 'equipment_enhancement_scroll.png',
  '잠재능력': 'potential_reset.png',
  '에디셔널 잠재능력': 'additional_potential_reset.png',
  // 손입력 갈래 둘. 열쇠는 `기록 종류:갈래 key` 라 수익 · 지출의 같은 갈래 key 가 안 겹친다.
  'income:hunting': 'wealth_acquisition_potion_small.webp',
  'spend:buff': 'seiram_elixir.webp',
}

export function cashbookRowIconOf(key: string): ImageAssetRef | null {
  const file = CASHBOOK_ROW_ICON_BY_KEY[key]
  if (file === undefined) return null
  return ITEM_ASSETS[file.normalize('NFC')] ?? null
}

/**
 * 지출 타일 그림을 자산으로 푼다. 그림 파일 이름은 카탈로그의 `tiles` 가 든다.
 *
 * 파일이면 타일 왼쪽, 지역 아이콘 slug 면 이름 옆에 선다. 못 찾으면 `null` 이고 화면은 그림 없이 선다.
 */
export function spendIconOf(icon: { readonly file?: string; readonly map?: string } | undefined): SpendIcon | null {
  if (icon?.file !== undefined) {
    const ref = ITEM_ASSETS[icon.file]
    return ref === undefined ? null : { ref, beside: false }
  }

  if (icon?.map !== undefined) {
    const ref = DAILY_QUEST_ICON_ASSETS[icon.map]
    return ref === undefined ? null : { ref, beside: true }
  }

  return null
}
