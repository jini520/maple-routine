
import { assetUri } from '../../assets/__tests__/asset-uri'
import jobThemes from '../../data/job-themes.json'
import { getThemeBackgroundUrl } from '../assets/asset-lookup'

/**
 * 테마 배경 이미지 에셋 해석.
 *
 * JSON 은 번들 경로가 아니라 **슬러그**만 적는다 — 파일을 넣고 슬러그를 적으면 붙어야 한다.
 * 해석 방식은 일일 퀘스트 지역 배경(`lib/daily-quest-backgrounds.ts`)과 같다.
 */
describe('getThemeBackgroundUrl', () => {
  // **실제로 쓰이는 슬러그로 잰다.** 한동안 죽은 에셋(`hontail-cave`)을 쓰고 있었는데, 그러면
  // 그 파일을 지우는 순간 상관없는 테스트가 깨지고 그래서 못 지우게 된다(가
  // 남긴 자리 — 실제로 에서 지울 때 이 테스트가 깨졌다).
  it('슬러그를 번들 URL 로 바꾼다', () => {
    expect(assetUri(getThemeBackgroundUrl('hontail-background'))).not.toBe('')
  })

  it('없는 슬러그는 null 이다 — 파일을 지워도 앱이 죽지 않는다', () => {
    expect(getThemeBackgroundUrl('없는배경')).toBeNull()
  })

  // 값(슬러그)과 파일이 어긋나면 배경만 조용히 사라진다. JSON 에 적힌 슬러그는 전부 실재해야 한다.
  //
  // 선언이 0건이면 루프가 안 돌아 **저절로 초록**이 된다. 그래서 원래 `length > 0` 가르개가 있었는데,
  // 지금은 그림을 바꾸는 중이라 실제로 0건이다. 가르개를 떼서 공허한 통과로
  // 만들지 않고 **skip 으로 남긴다** — "검사했고 괜찮다"와 "검사할 것이 없다"는 리포트에서 달라야
  // 하고, 새 그림이 붙는 순간 손대지 않아도 되살아난다.
  const declaredSlugs = Object.values(jobThemes)
    .map((theme) => (theme as { background?: { image: string } }).background?.image)
    .filter((slug): slug is string => slug !== undefined)

  ;(declaredSlugs.length === 0 ? it.skip : it)(
    'job-themes.json 에 적힌 배경 슬러그는 모두 실재하는 파일이다',
    () => {
      for (const slug of declaredSlugs) {
        expect(getThemeBackgroundUrl(slug), `${slug} 에 해당하는 파일이 없다`).not.toBeNull()
      }
    },
  )
})
