/**
 * 게임 데이터의 그림 칸을 그림으로 바꾸는 조회. 앱의 그림은 이 길로만 화면에 붙는다.
 *
 * 게임 데이터 그림은 서버에서 받아 기기에 둔 파일이다(`asset-files.ts`). 그림 칸은 그림 id 를 들고, 붙일 표가 없는
 * 그림은 `appImages` 칸의 key 로 찾는다. 테마 배경만 번들에 남는다.
 *
 * **없으면 `null` 이고 화면이 비운다.** 비슷한 그림을 갖다 붙이면 틀린 것을 그리는 셈이다.
 */
import { THEME_BACKGROUND_ASSETS } from '../../assets/generated/themes'
import type { MesoBoostId } from '../cashbook/hunting-meso'
import type { ForceType } from '../../types/hunting-grounds'
import type { ImageAssetRef } from '../../types/image-asset'
import { cashbookCategoryOf } from '../cashbook/categories'
import { findHuntLoot } from '../cashbook/hunt-loot'
import { findDropItem } from '../drop/drop-items'
import type { ImageCrop } from '../image-crop'
import { findMvpGrade, type MvpGradeKey } from '../mvp/grades'
import { findWorld } from '../world/worlds'
import { appImage, type AppImageKey } from './app-images'
import { assetImage } from './asset-files'
import { imageCropOf } from './image-crops'

export { appImage, appImageFrames } from './app-images'

/** 게임 데이터 표의 그림 칸이 든 id 의 그림. 칸이 비거나 목록에 없으면 `null` 이다. */
export function getAssetImage(assetId: string | null | undefined): ImageAssetRef | null {
  return assetImage(assetId)
}

// 보스 초상

/**
 * 같은 그림이라도 카드 bleed · 원형 아이콘 · 모달 띠는 잘 보이는 자리가 달라 크롭 표가 셋이다. 값은 운영자가 관리 화면에서
 * 눈으로 맞춘다.
 */
export function getBossPortraitUrl(portraitAssetId: string | null): ImageAssetRef | null {
  return assetImage(portraitAssetId)
}

export function getBossPortraitCrop(portraitAssetId: string | null): ImageCrop {
  return imageCropOf('boss_portrait', portraitAssetId)
}

export function getBossPortraitIconCrop(portraitAssetId: string | null): ImageCrop {
  return imageCropOf('boss_portrait_icon', portraitAssetId)
}

/**
 * 파티 분배 모달의 오른쪽 띠에 쓰는 크롭.
 *
 * **카드 표와 갈라 둔 표다.** 띠는 카드보다 좁고 높아 같은 값이 다른 구도를 낸다. 한 표를 같이
 * 쓰면 모달을 맞출 때마다 보스 카드가 함께 움직인다.
 */
export function getBossPortraitModalCrop(portraitAssetId: string | null): ImageCrop {
  return imageCropOf('boss_portrait_modal', portraitAssetId)
}

// 일일·주간 퀘스트 지역

export function getDailyQuestBackgroundUrl(backgroundAssetId: string | null): ImageAssetRef | null {
  return assetImage(backgroundAssetId)
}

export function getDailyQuestRegionCrop(backgroundAssetId: string | null): ImageCrop {
  return imageCropOf('daily_quest_region', backgroundAssetId)
}

/** 컨텐츠 카드의 지역 아이콘. 컨텐츠 표의 `regionIcon` 그림이다. */
export function getDailyQuestRegionIconUrl(regionIconAssetId: string | null): ImageAssetRef | null {
  return assetImage(regionIconAssetId)
}

/** 사냥 지역 드롭다운의 지역 아이콘. 일일 퀘스트와 같은 그림 묶음이다. */
export function getHuntingRegionIconUrl(iconAssetId: string | null): ImageAssetRef | null {
  return assetImage(iconAssetId)
}

// 테마 배경

/** 파일이 없으면 배경만 사라지고 테마는 산다. @see */
export function getThemeBackgroundUrl(slug: string): ImageAssetRef | null {
  return THEME_BACKGROUND_ASSETS[slug.normalize('NFC')] ?? null
}

// 월드 엠블럼

/** 월드 key 의 엠블럼. 엠블럼이 없는 월드(스페셜)와 모르는 key 는 `null` 이다. */
export function worldEmblemUrl(worldKey: string | null | undefined): ImageAssetRef | null {
  return assetImage(findWorld(worldKey)?.emblemAssetId)
}

// MVP 등급

/** 등급의 명패. 일반은 그림이 없어 `null` 이다. */
export function mvpPlateAsset(grade: MvpGradeKey): ImageAssetRef | null {
  return assetImage(findMvpGrade(grade)?.plateAssetId)
}

/** 캐릭터 그림을 모를 때 서는 흰 실루엣. 넥슨 그림과 달리 180×180 이다 */
export function unknownCharacterAsset(): ImageAssetRef | null {
  return appImage('unknown_character')
}

// 포스

export const FORCE_LABELS: Record<ForceType, string> = {
  arcane: '아케인 포스',
  authentic: '어센틱 포스',
}

const FORCE_IMAGE_KEYS: Record<ForceType, AppImageKey> = {
  arcane: 'arcane_force',
  authentic: 'authentic_force',
}

export function forceIconOf(forceType: ForceType): ImageAssetRef | null {
  return appImage(FORCE_IMAGE_KEYS[forceType])
}

// 아이템 아이콘

/** 드롭 아이템 그림. 아이템 key 로 드롭 아이템 표의 그림을 찾는다. 모르는 key 는 `null` 이다. */
export function dropItemIconOf(itemKey: string | null | undefined): ImageAssetRef | null {
  return assetImage(findDropItem(itemKey)?.iconAssetId)
}

/** 솔 에르다 조각. 사냥 전리품 표의 그 아이템 그림이다. */
export function solErdaFragmentIcon(): ImageAssetRef | null {
  return assetImage(findHuntLoot('sol_erda_fragment')?.iconAssetId)
}

/**
 * 사냥 계산기의 버프 칩 그림. 칩이 글자가 아니라 그림이라 없으면 칩이 빈 채로 선다. 재물 획득의 비약은 가계부 사냥 갈래와
 * 같은 그림이다(사용자 지정 2026-11-09).
 */
export function mesoBoostIconOf(id: MesoBoostId): ImageAssetRef | null {
  if (id === 'union') return appImage('union_wealth')
  return assetImage(cashbookCategoryOf('income', 'hunting')?.iconAssetId)
}

// 가계부 줄 표식

/**
 * 가계부 하루 상세 줄의 표식. 열쇠는 `features/cashbook/row-icon.ts` 가 만든다.
 *
 * 여기 없는 갈래는 `null` 이고 화면이 지금 아이콘을 그대로 쓴다. 비슷한 그림을 갖다 붙이면
 * 틀린 것을 그리는 셈이다.
 */
const CASHBOOK_ROW_APP_IMAGES: Record<string, AppImageKey> = {
  // 결정석은 주간 것이다. 그림 둘의 픽셀을 재서 골랐다(weekly 가 보라 · monthly 는 금색).
  bossCrystal: 'boss_crystal_weekly',
  // 강화 갈래 다섯. 열쇠는 `enhancement:갈래 key` 다. 큐브는 본잠·에디를 안 가르므로 그림도 하나다(사용자 지정).
  'enhancement:cube_reset': 'enhancement_cube_reset',
  'enhancement:starforce': 'enhancement_starforce',
  'enhancement:potential': 'enhancement_potential',
  'enhancement:additional_potential': 'enhancement_additional_potential',
  'enhancement:soul_potential': 'enhancement_soul_potential',
}

/**
 * 손입력 갈래 넷은 가계부 분류 표의 그 갈래 그림이다. 열쇠는 `기록 종류:갈래 key` 라 수익 · 지출의 같은 갈래 key(`etc`)가
 * 안 겹친다. 지출의 목록 갈래는 여기 없고 고른 타일의 그림을 쓴다.
 */
const CASHBOOK_ROW_CATEGORIES: Record<string, readonly ['income' | 'spend', string]> = {
  'income:hunting': ['income', 'hunting'],
  'income:sol_erda_fragment': ['income', 'sol_erda_fragment'],
  'income:etc': ['income', 'etc'],
  'spend:etc': ['spend', 'etc'],
}

export function cashbookRowIconOf(key: string): ImageAssetRef | null {
  const appKey = CASHBOOK_ROW_APP_IMAGES[key]
  if (appKey !== undefined) return appImage(appKey)
  const category = CASHBOOK_ROW_CATEGORIES[key]
  return category === undefined ? null : assetImage(cashbookCategoryOf(...category)?.iconAssetId)
}
