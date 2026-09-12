// 스토어 리뷰 주소.
//
// 플랫폼 분기를 화면에 인라인으로 적으면 두 갈래 중 한쪽만 테스트가 볼 수 있다. 순수 함수라
// 양쪽을 다 잰다.
import { storeReviewUrl } from '../store-review-link'

describe('storeReviewUrl', () => {
  // iOS 는 리뷰 작성 화면으로 곧장 갈 수 있다.
  it('iOS 는 리뷰 작성 화면을 연다', () => {
    expect(storeReviewUrl('ios')).toBe(
      'itms-apps://apps.apple.com/app/id6797579391?action=write-review',
    )
  })

  // Play 는 리뷰 작성으로 바로 가는 주소를 안 내준다. 스토어 페이지에 별점 UI 가 있다.
  it('안드로이드는 스토어 페이지까지만 간다', () => {
    expect(storeReviewUrl('android')).toBe('market://details?id=com.mapleroutine.app')
  })

  // 웹·데스크톱에서 열릴 자리가 아니지만, 값이 없으면 행이 죽은 링크가 된다.
  it('나머지 플랫폼은 안드로이드와 같은 자리로 보낸다', () => {
    expect(storeReviewUrl('web')).toBe('market://details?id=com.mapleroutine.app')
  })
})
