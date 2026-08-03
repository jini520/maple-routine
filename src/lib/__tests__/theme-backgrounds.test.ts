import { describe, expect, it } from 'vitest'
import jobThemes from '../../data/job-themes.json'
import { getThemeBackgroundUrl } from '../theme-backgrounds'

/**
 * 테마 배경 이미지 에셋 해석([[ADR-088]] 결정 3).
 *
 * JSON 은 번들 경로가 아니라 **슬러그**만 적는다 — 파일을 넣고 슬러그를 적으면 붙어야 한다.
 * 해석 방식은 일일 퀘스트 지역 배경(`lib/daily-quest-backgrounds.ts`)과 같다.
 */
describe('getThemeBackgroundUrl', () => {
  it('슬러그를 번들 URL 로 바꾼다', () => {
    expect(getThemeBackgroundUrl('hontail-cave')).toEqual(expect.any(String))
  })

  it('없는 슬러그는 null 이다 — 파일을 지워도 앱이 죽지 않는다', () => {
    expect(getThemeBackgroundUrl('없는배경')).toBeNull()
  })

  // 값(슬러그)과 파일이 어긋나면 배경만 조용히 사라진다. JSON 에 적힌 슬러그는 전부 실재해야 한다.
  it('job-themes.json 에 적힌 배경 슬러그는 모두 실재하는 파일이다', () => {
    const slugs = Object.values(jobThemes)
      .map((theme) => (theme as { background?: { image: string } }).background?.image)
      .filter((slug): slug is string => slug !== undefined)

    expect(slugs.length).toBeGreaterThan(0)
    for (const slug of slugs) {
      expect(getThemeBackgroundUrl(slug), `${slug} 에 해당하는 파일이 없다`).not.toBeNull()
    }
  })
})
