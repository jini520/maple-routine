import cropsData from '../data/boss-portrait-crops.json'

export interface BossPortraitCrop {
  size: string
  position: string
}

// 확장자는 webp/png가 섞여 있을 수 있어(ADR-021 — 에픽 던전/길드 배경이 png로 추가됨)
// 파일명 전체가 아니라 확장자를 뗀 slug를 키로 맵을 만든다.
const bossPortraitModules = import.meta.glob('../assets/bosses/*.{webp,png}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const bossPortraitUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(bossPortraitModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.'))
    return [slug, url]
  }),
)

const BOSS_PORTRAIT_CROPS = cropsData as Record<string, BossPortraitCrop>

const DEFAULT_CROP: BossPortraitCrop = { size: 'cover', position: 'center' }

export function getBossPortraitUrl(portraitSlug: string | null): string | null {
  if (portraitSlug === null) return null

  return bossPortraitUrlsBySlug[portraitSlug] ?? null
}

export function getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_CROPS[portraitSlug] ?? DEFAULT_CROP
}
