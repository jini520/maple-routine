
import { assetUri } from '../../assets/__tests__/asset-uri'
import { getDailyQuestRegionIconUrl } from '../daily-quest-icons'

describe('getDailyQuestRegionIconUrl', () => {
  it('slug가 null이면 null을 반환한다', () => {
    expect(getDailyQuestRegionIconUrl(null)).toBeNull()
  })

  // 실제 아이콘 파일의 확장자(png/webp)는 언제든 바뀔 수 있어 특정 확장자를 전제하지 않는다 —
  // 확장자와 무관하게 slug만으로 조회되는지가 검증 대상이다.
  it('실제로 존재하는 slug면 확장자와 무관하게 URL을 반환한다', () => {
    const url = getDailyQuestRegionIconUrl('lacheln')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('lacheln')
  })

  it('존재하지 않는 slug면 null을 반환한다', () => {
    expect(getDailyQuestRegionIconUrl('존재하지않는슬러그')).toBeNull()
  })

  // 회귀 방지: 아이콘 파일명(moonbridge.png)이 slug(moonBridge)와 대소문자가 어긋나
  // '문브릿지 조사' 퀘스트의 지역 아이콘이 조회되지 않던 버그. 조회는 NFC 정규화만 하고
  // 대소문자는 구분하므로 파일명이 slug와 정확히 일치해야 한다.
  it('moonBridge slug는 대소문자까지 일치하는 아이콘 URL을 반환한다', () => {
    const url = getDailyQuestRegionIconUrl('moonBridge')

    expect(url).not.toBeNull()
    expect(assetUri(url)).toContain('moonBridge')
  })
})
