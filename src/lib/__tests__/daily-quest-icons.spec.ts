import { assetUri } from '../../assets/__tests__/asset-uri'
import { getDailyQuestRegionIconUrl } from '../assets/asset-lookup'
import { findContent } from '../scheduler/contents'

describe('getDailyQuestRegionIconUrl', () => {
  it('칸이 비면 null 이다', () => {
    expect(getDailyQuestRegionIconUrl(null)).toBeNull()
  })

  // 지역 아이콘은 컨텐츠 표의 그림 id 다. 앱은 배경 지도의 이름을 빌려 아이콘을 찾지 않는다.
  it('컨텐츠 표의 지역 아이콘 id 로 그 지역의 아이콘을 찾는다', () => {
    const url = getDailyQuestRegionIconUrl(findContent('daily_quest_lacheln')?.background?.regionIcon ?? null)

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('maps/icons/lacheln')
  })

  it('목록에 없는 id 면 null 이다', () => {
    expect(getDailyQuestRegionIconUrl('없는 그림 id')).toBeNull()
  })

  // 회귀 방지: 아이콘 파일명(moonbridge.png)이 지도 이름(moonBridge)과 대소문자가 어긋나 '문브릿지 조사' 퀘스트의 지역
  // 아이콘이 안 서던 버그. 지금은 서버가 대소문자까지 같은 그림을 표에 붙인다.
  it('문브릿지 조사는 대소문자까지 같은 moonBridge 아이콘이다', () => {
    const url = getDailyQuestRegionIconUrl(findContent('daily_quest_moon_bridge')?.background?.regionIcon ?? null)

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('maps/icons/moonBridge')
  })
})
