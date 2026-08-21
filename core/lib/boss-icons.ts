import cropsData from '@core/data/boss-portrait-crops.json'
import iconCropsData from '@core/data/boss-portrait-icon-crops.json'

import { BOSS_PORTRAIT_ASSETS } from '../assets/generated/bosses'
import type { ImageAssetRef } from '../types/image-asset'

export interface BossPortraitCrop {
  size: string
  position: string
}

// 확장자는 webp/png가 섞여 있을 수 있어(ADR-021 — 에픽 던전/길드 배경이 png로 추가됨)
// 파일명 전체가 아니라 확장자를 뗀 slug가 키다. 그 목록은 빌드가 아니라 **커밋 시점에**
// 만들어져 있다([[ADR-129]]) — 웹·RN 이 같은 파일을 읽는다.
//
// 조회 쪽 NFC 정규화는 그대로 남는다: macOS 파일시스템은 한글 파일명을 NFD(분해형)로 저장하지만
// 소스 코드의 문자열 리터럴은 보통 NFC(완성형)라, 호출자가 준 슬러그를 맞춰 줘야 한다
// (목록 쪽 정규화는 생성기가 한다).

const BOSS_PORTRAIT_CROPS = cropsData as Record<string, BossPortraitCrop>
// boss-portrait-crops.json(보스 카드 bleed 일러스트용)과는 별도의 크롭 테이블 — 원형 아이콘
// (BossPortrait, 보스 수익 화면)은 크기·구도가 달라 같은 값을 재사용할 수 없다(ADR-018 결정).
// UI 표시 파라미터라 값은 AI가 임의로 채우지 않고 /debug/boss-portrait-size에서 사용자가
// 직접 조정한다(ADR-006과 동일한 원칙).
const BOSS_PORTRAIT_ICON_CROPS = iconCropsData as Record<string, BossPortraitCrop>

const DEFAULT_CROP: BossPortraitCrop = { size: 'cover', position: 'center' }

export function getBossPortraitUrl(portraitSlug: string | null): ImageAssetRef | null {
  if (portraitSlug === null) return null

  return BOSS_PORTRAIT_ASSETS[portraitSlug.normalize('NFC')] ?? null
}

export function getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_CROPS[portraitSlug.normalize('NFC')] ?? DEFAULT_CROP
}

export function getBossPortraitIconCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_ICON_CROPS[portraitSlug.normalize('NFC')] ?? DEFAULT_CROP
}
