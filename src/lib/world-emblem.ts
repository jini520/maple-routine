import worldEmblems from '../data/world-emblems.json'

// assets/worlds/*의 월드 엠블럼을 번들해 파일 basename → URL 맵을 만든다.
const emblemUrlByPath = import.meta.glob('../assets/worlds/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const emblemUrlByBasename: Record<string, string> = {}
for (const [path, url] of Object.entries(emblemUrlByPath)) {
  const basename = (path.split('/').pop() ?? '').replace(/\.(png|webp)$/, '')
  emblemUrlByBasename[basename] = url
}

const basenameByWorld = worldEmblems as Record<string, string>

// 한글 월드명 → 엠블럼 이미지 URL. 매핑에 없거나 파일이 없으면 null(폴백: 엠블럼 생략).
export function worldEmblemUrl(world: string): string | null {
  const basename = basenameByWorld[world]
  if (basename === undefined) return null
  return emblemUrlByBasename[basename] ?? null
}

// 챌린저스/챌린저스2/챌린저스3/챌린저스4 판정([[ADR-031]]) — world-emblems.json에서 이미
// challengers 엠블럼으로 매핑된 월드 집합을 그대로 재사용해, 새 챌린저스 월드가 생겨도
// 그 파일만 갱신하면 이 판정도 함께 갱신되게 한다.
export function isChallengersWorld(world: string): boolean {
  return basenameByWorld[world] === 'challengers'
}
