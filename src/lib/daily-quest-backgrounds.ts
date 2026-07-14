import cropsData from '../data/daily-quest-region-crops.json'

export interface DailyQuestRegionCrop {
  size: string
  position: string
}

const dailyQuestBackgroundModules = import.meta.glob('../assets/maps/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const dailyQuestBackgroundUrlsByFileName: Record<string, string> = Object.fromEntries(
  Object.entries(dailyQuestBackgroundModules).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
)

const DAILY_QUEST_REGION_CROPS = cropsData as Record<string, DailyQuestRegionCrop>

const DEFAULT_CROP: DailyQuestRegionCrop = { size: 'cover', position: 'center' }

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): string | null {
  if (backgroundSlug === null) return null

  const fileName = `${backgroundSlug}.webp`
  return dailyQuestBackgroundUrlsByFileName[fileName] ?? null
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): DailyQuestRegionCrop {
  if (backgroundSlug === null) return DEFAULT_CROP

  return DAILY_QUEST_REGION_CROPS[backgroundSlug] ?? DEFAULT_CROP
}
