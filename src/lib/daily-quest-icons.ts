const dailyQuestIconModules = import.meta.glob('../assets/maps/icons/*.{png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// 아이콘 파일은 png/webp 확장자가 섞여 있어 boss-icons.ts처럼 파일명 전체가 아니라
// 확장자를 뗀 slug를 키로 맵을 만든다.
const dailyQuestIconUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(dailyQuestIconModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.'))
    return [slug, url]
  }),
)

export function getDailyQuestRegionIconUrl(backgroundSlug: string | null): string | null {
  if (backgroundSlug === null) return null

  return dailyQuestIconUrlsBySlug[backgroundSlug] ?? null
}
