import cropsData from '../data/daily-quest-region-crops.json'

export interface DailyQuestRegionCrop {
  size: string
  position: string
}

// 확장자는 webp/jpg/png가 섞여 있을 수 있어(ADR-021 정정 — 길드 플래그 레이스 배경이 jpg로,
// 주간 퀘스트 지역 배경이 png로 추가됨) 파일명 전체가 아니라 확장자를 뗀 slug를 키로 맵을
// 만든다(boss-icons.ts와 동일한 방식).
const dailyQuestBackgroundModules = import.meta.glob('../assets/maps/*.{webp,jpg,png}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// macOS 파일시스템은 한글 파일명을 NFD(분해형)로 저장하지만 소스 코드의 문자열 리터럴은
// 보통 NFC(완성형)라 육안으로 같아 보여도 슬러그 문자열이 일치하지 않는다(boss-icons.ts와
// 동일한 문제) — 저장/조회 양쪽을 NFC로 정규화해 맞춘다.
const dailyQuestBackgroundUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(dailyQuestBackgroundModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.')).normalize('NFC')
    return [slug, url]
  }),
)

const DAILY_QUEST_REGION_CROPS = cropsData as Record<string, DailyQuestRegionCrop>

const DEFAULT_CROP: DailyQuestRegionCrop = { size: 'cover', position: 'center' }

export function getDailyQuestBackgroundUrl(backgroundSlug: string | null): string | null {
  if (backgroundSlug === null) return null

  return dailyQuestBackgroundUrlsBySlug[backgroundSlug.normalize('NFC')] ?? null
}

export function getDailyQuestRegionCrop(backgroundSlug: string | null): DailyQuestRegionCrop {
  if (backgroundSlug === null) return DEFAULT_CROP

  return DAILY_QUEST_REGION_CROPS[backgroundSlug.normalize('NFC')] ?? DEFAULT_CROP
}
