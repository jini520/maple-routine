import cropsData from '../data/daily-quest-region-crops.json'

export interface DailyQuestRegionCrop {
  size: string
  position: string
}

// 확장자는 webp/jpg가 섞여 있을 수 있어(ADR-021 정정 — 길드 플래그 레이스 배경이 jpg로 추가됨)
// 파일명 전체가 아니라 확장자를 뗀 slug를 키로 맵을 만든다(boss-icons.ts와 동일한 방식).
const dailyQuestBackgroundModules = import.meta.glob('../assets/maps/*.{webp,jpg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const dailyQuestBackgroundUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(dailyQuestBackgroundModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.'))
    return [slug, url]
  }),
)

const DAILY_QUEST_REGION_CROPS = cropsData as Record<string, DailyQuestRegionCrop>

const DEFAULT_CROP: DailyQuestRegionCrop = { size: 'cover', position: 'center' }

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): string | null {
  if (backgroundSlug === null) return null

  return dailyQuestBackgroundUrlsBySlug[backgroundSlug] ?? null
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): DailyQuestRegionCrop {
  if (backgroundSlug === null) return DEFAULT_CROP

  return DAILY_QUEST_REGION_CROPS[backgroundSlug] ?? DEFAULT_CROP
}
