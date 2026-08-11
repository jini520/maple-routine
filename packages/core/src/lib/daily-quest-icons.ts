const dailyQuestIconModules = import.meta.glob('../assets/maps/icons/*.{png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// 아이콘 파일은 png/webp 확장자가 섞여 있어 boss-icons.ts처럼 파일명 전체가 아니라
// 확장자를 뗀 slug를 키로 맵을 만든다. macOS 파일시스템은 한글 파일명을 NFD(분해형)로
// 저장하지만 소스 코드의 문자열 리터럴은 보통 NFC(완성형)라 육안으로 같아 보여도 슬러그
// 문자열이 일치하지 않는다 — 저장/조회 양쪽을 NFC로 정규화해 맞춘다.
const dailyQuestIconUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(dailyQuestIconModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.')).normalize('NFC')
    return [slug, url]
  }),
)

export function getDailyQuestRegionIconUrl(backgroundSlug: string | null): string | null {
  if (backgroundSlug === null) return null

  return dailyQuestIconUrlsBySlug[backgroundSlug.normalize('NFC')] ?? null
}
