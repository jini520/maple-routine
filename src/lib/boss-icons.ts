import cropsData from '../data/boss-portrait-crops.json'
import iconCropsData from '../data/boss-portrait-icon-crops.json'

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
// boss-portrait-crops.json(보스 카드 bleed 일러스트용)과는 별도의 크롭 테이블 — 원형 아이콘
// (BossPortrait, 보스 수익 화면)은 크기·구도가 달라 같은 값을 재사용할 수 없다(ADR-018 결정).
// UI 표시 파라미터라 값은 AI가 임의로 채우지 않고 /debug/boss-portrait-size에서 사용자가
// 직접 조정한다(ADR-006과 동일한 원칙).
const BOSS_PORTRAIT_ICON_CROPS = iconCropsData as Record<string, BossPortraitCrop>

const DEFAULT_CROP: BossPortraitCrop = { size: 'cover', position: 'center' }

export function getBossPortraitUrl(portraitSlug: string | null): string | null {
  if (portraitSlug === null) return null

  return bossPortraitUrlsBySlug[portraitSlug] ?? null
}

export function getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_CROPS[portraitSlug] ?? DEFAULT_CROP
}

export function getBossPortraitIconCrop(portraitSlug: string | null): BossPortraitCrop {
  if (portraitSlug === null) return DEFAULT_CROP

  return BOSS_PORTRAIT_ICON_CROPS[portraitSlug] ?? DEFAULT_CROP
}
