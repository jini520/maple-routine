// 데이터에 선언된 **모든** 슬러그가 실제 번들 URL로 해석되는지 전수 검사한다.
//
// 왜 필요한가. 자산 최적화(PNG→WebP 변환·고아 삭제)는 **파일만 바꾸고 코드를 안 바꾼다.**
// 그래서 슬러그 하나가 해석되지 않아도 예외가 나지 않고 화면에는 폴백(일러스트 없는 카드)이
// 뜰 뿐이라 **조용히 깨진다.** 기존 boss-icons·daily-quest-backgrounds 테스트는 대표 슬러그
// 한둘만 확인하므로 이 사고를 못 잡는다.
//
// 파일명은 macOS가 NFD로 저장하고 소스 리터럴은 보통 NFC라, 조회 함수들이 양쪽을 NFC로
// 정규화한다. 이 테스트는 그 정규화까지 함께 검증하는 셈이다.
import weeklyBossesData from '../../data/weekly-bosses.json'
import dailyQuestRegionCrops from '../../data/daily-quest-region-crops.json'
import jobThemesData from '../../data/job-themes.json'
import { getBossPortraitUrl, getDailyQuestBackgroundUrl, getThemeBackgroundUrl } from '../assets/asset-lookup'

function collectPortraitSlugs(node: unknown, acc: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((child) => {
      collectPortraitSlugs(child, acc)
    })
    return
  }
  if (typeof node !== 'object' || node === null) return

  const record = node as Record<string, unknown>
  const slug = record.portraitSlug
  if (typeof slug === 'string' && slug.length > 0) acc.add(slug)
  Object.values(record).forEach((child) => {
    collectPortraitSlugs(child, acc)
  })
}

describe('자산 슬러그 전수 해석', () => {
  it('weekly-bosses.json의 portraitSlug가 하나도 빠짐없이 URL로 해석된다', () => {
    const slugs = new Set<string>()
    collectPortraitSlugs(weeklyBossesData, slugs)

    expect(slugs.size).toBeGreaterThan(0)
    const unresolved = [...slugs].filter((slug) => getBossPortraitUrl(slug) === null)
    expect(unresolved).toEqual([])
  })

  it('daily-quest-region-crops.json의 지역 슬러그가 하나도 빠짐없이 배경 URL로 해석된다', () => {
    const slugs = Object.keys(dailyQuestRegionCrops)

    expect(slugs.length).toBeGreaterThan(0)
    const unresolved = slugs.filter((slug) => getDailyQuestBackgroundUrl(slug) === null)
    expect(unresolved).toEqual([])
  })

  // 배경을 가진 테마는 현재 **0종**이다. 그림을 바꾸는 중이라 둘 다 뗐다.
  // 0건이면 이 검사는 저절로 초록이 되므로, 원래 있던 `length > 0` 가르개를 떼는 대신 skip 으로
  // 남긴다. 새 그림이 붙으면 손대지 않아도 되살아난다.
  const declaredThemeBackgrounds = Object.entries(
    jobThemesData as Record<string, { background?: { image?: string } }>,
  )
    .filter(([, definition]) => definition.background !== undefined)
    .map(([name, definition]) => ({ name, image: definition.background?.image ?? '' }))

  ;(declaredThemeBackgrounds.length === 0 ? it.skip : it)(
    'job-themes.json이 background를 선언한 테마는 그 이미지 슬러그가 URL로 해석된다',
    () => {
      const unresolved = declaredThemeBackgrounds
        .filter(({ image }) => getThemeBackgroundUrl(image) === null)
        .map(({ name }) => name)
      expect(unresolved).toEqual([])
    },
  )
})
