import type { BossDifficulty } from '../types'

const DIFFICULTY_PREFIX: Record<BossDifficulty, string> = {
  이지: 'easy',
  노멀: 'normal',
  하드: 'hard',
  카오스: 'chaos',
  익스트림: 'extreme',
}

const bossPortraitModules = import.meta.glob('../assets/bosses/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const bossPortraitUrlsByFileName: Record<string, string> = Object.fromEntries(
  Object.entries(bossPortraitModules).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
)

export function getBossPortraitUrl(portraitSlug: string | null, difficulty: BossDifficulty): string | null {
  if (portraitSlug === null) return null

  const fileName = `${DIFFICULTY_PREFIX[difficulty]}_${portraitSlug}.png`
  return bossPortraitUrlsByFileName[fileName] ?? null
}
