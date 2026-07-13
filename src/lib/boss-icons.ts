import cropsData from '../data/boss-portrait-crops.json'

export interface BossPortraitCrop {
  size: string
  position: string
}

const bossPortraitModules = import.meta.glob('../assets/bosses/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const bossPortraitUrlsByFileName: Record<string, string> = Object.fromEntries(
  Object.entries(bossPortraitModules).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
)

const BOSS_PORTRAIT_CROPS = cropsData as Record<string, BossPortraitCrop>

const DEFAULT_CROP: BossPortraitCrop = { size: 'cover', position: 'center' }

export function getBossPortraitUrl(portraitSlug: string | null): string | null {
  if (portraitSlug === null) return null

  const fileName = `${portraitSlug}.webp`
  return bossPortraitUrlsByFileName[fileName] ?? null
}

export function getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_CROPS[portraitSlug] ?? DEFAULT_CROP
}
