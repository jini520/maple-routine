/**
 * 테마 배경 이미지 에셋 해석 ([[ADR-088]] 결정 3).
 *
 * `job-themes.json` 은 번들 경로가 아니라 **슬러그**만 적는다(`"image": "hontail-cave"`) —
 * 파일을 `packages/core/src/assets/themes/` 에 넣고 슬러그를 적으면 붙는다. 해석 방식은 일일 퀘스트 지역
 * 배경(`lib/daily-quest-backgrounds.ts`)과 같고, 확장자가 섞일 수 있는 것과 macOS 한글
 * 파일명 NFD 문제도 같은 이유로 같은 처리를 한다.
 */

const themeBackgroundModules = import.meta.glob('../assets/themes/*.{webp,jpg,png}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const themeBackgroundUrlsBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(themeBackgroundModules).map(([path, url]) => {
    const fileName = path.slice(path.lastIndexOf('/') + 1)
    const slug = fileName.slice(0, fileName.lastIndexOf('.')).normalize('NFC')
    return [slug, url]
  }),
)

/** 슬러그에 해당하는 파일이 없으면 `null` — 배경만 사라지고 테마는 그대로 산다. */
export function getThemeBackgroundUrl(slug: string): string | null {
  return themeBackgroundUrlsBySlug[slug.normalize('NFC')] ?? null
}
