import cropsData from '../data/daily-quest-region-crops.json'

import { DAILY_QUEST_BACKGROUND_ASSETS } from '../assets/generated/maps'
import type { ImageAssetRef } from '../types/image-asset'

export interface DailyQuestRegionCrop {
  size: string
  position: string
}

// 확장자는 webp/jpg/png가 섞여 있을 수 있어(ADR-021 정정 — 길드 플래그 레이스 배경이 jpg로,
// 주간 퀘스트 지역 배경이 png로 추가됨) 파일명 전체가 아니라 확장자를 뗀 slug가 키다
// (boss-icons.ts와 동일한 방식이고, 목록은 커밋 시점에 생성돼 있다 — [[ADR-129]]).
//
// macOS 파일시스템은 한글 파일명을 NFD(분해형)로 저장하지만 소스 코드의 문자열 리터럴은
// 보통 NFC(완성형)라 육안으로 같아 보여도 슬러그 문자열이 일치하지 않는다(boss-icons.ts와
// 동일한 문제) — 조회 쪽을 NFC로 정규화해 맞춘다.

const DAILY_QUEST_REGION_CROPS = cropsData as Record<string, DailyQuestRegionCrop>

const DEFAULT_CROP: DailyQuestRegionCrop = { size: 'cover', position: 'center' }

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): ImageAssetRef | null {
  if (backgroundSlug === null) return null

  return DAILY_QUEST_BACKGROUND_ASSETS[backgroundSlug.normalize('NFC')] ?? null
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): DailyQuestRegionCrop {
  if (backgroundSlug === null) return DEFAULT_CROP

  return DAILY_QUEST_REGION_CROPS[backgroundSlug.normalize('NFC')] ?? DEFAULT_CROP
}
