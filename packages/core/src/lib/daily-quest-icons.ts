import { DAILY_QUEST_ICON_ASSETS } from '../assets/generated/map-icons'
import type { ImageAssetRef } from '../types/image-asset'

// 아이콘 파일은 png/webp 확장자가 섞여 있어 boss-icons.ts처럼 파일명 전체가 아니라
// 확장자를 뗀 slug가 키다(목록은 커밋 시점에 생성돼 있다 — [[ADR-129]]). macOS 파일시스템은
// 한글 파일명을 NFD(분해형)로 저장하지만 소스 코드의 문자열 리터럴은 보통 NFC(완성형)라
// 육안으로 같아 보여도 슬러그 문자열이 일치하지 않는다 — 조회 쪽을 NFC로 정규화해 맞춘다.
export function getDailyQuestRegionIconUrl(backgroundSlug: string | null): ImageAssetRef | null {
  if (backgroundSlug === null) return null

  return DAILY_QUEST_ICON_ASSETS[backgroundSlug.normalize('NFC')] ?? null
}
