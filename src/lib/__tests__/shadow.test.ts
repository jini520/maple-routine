// `shadow*` → `boxShadow` 번역기. **번역이 눈에 안 보이게 틀리는 자리**라 값으로 못박는다.
//
// 블러 ×2 를 빼먹으면 그림자가 절반 크기로 나오고, 알파를 미리 안 곱하면 실효값이 세 배가 된다.
// 둘 다 에러 없이 그려져서 화면에서는 원이 바보다 조금 진하다 로만 보인다.
import { boxShadowOf } from '../shadow'
import { FAB_SHADOW } from '../fab-metrics'

/** 테마 `shadowColor` 의 모양. 8자리 hex 이고 끝 두 자리가 알파(`59` = 0.35)다. */
const SHADOW_COLOR = '#00000059'

describe('boxShadowOf', () => {
  // `boxShadow` 의 반경은 CSS 정의이고 RN 의 iOS 구현이 그것을 `blurRadius / 2` 로 되돌린다.
  // 그대로 옮기면 같은 값이 절반 크기 그림자가 된다.
  it('블러는 반경의 두 배다', () => {
    expect(boxShadowOf(SHADOW_COLOR, { opacity: 1, radius: 10, y: 3 })).toBe(
      '0px 3px 20px #00000059',
    )
  })

  // iOS 는 `shadowColor` 의 알파와 `shadowOpacity` 를 곱하는데 `boxShadow` 는 색의 알파를 그대로
  // 쓴다. 곱을 여기서 한 번 해 두면 실효값이 안 변한다.
  it('알파는 테마 색의 알파와 미리 곱한다', () => {
    // 0.35 × 0.65 = 0.227 → 58 → `3a`. 0.65 는 과한 값이 아니라 실효 0.23 이다.
    expect(boxShadowOf(SHADOW_COLOR, { opacity: 0.65, radius: 10, y: 3 })).toBe(
      '0px 3px 20px #0000003a',
    )
  })

  // 판별력: 곱을 안 하면 위 케이스가 `#00000059`(실효 0.35)로 나온다. 불투명도 1 인 이 케이스와
  // 값이 같아져 버리므로 둘을 함께 둔다.
  it('불투명도 1 이면 테마 알파가 그대로 남는다', () => {
    expect(boxShadowOf(SHADOW_COLOR, { opacity: 1, radius: 5, y: 1 })).toBe('0px 1px 10px #00000059')
  })

  it('알파가 없는 색은 불투명으로 본다', () => {
    expect(boxShadowOf('#123456', { opacity: 0.5, radius: 1, y: 0 })).toBe('0px 0px 2px #12345680')
  })
})

// 떠 있는 원 둘이 나눠 쓰는 값. 원이 알약보다 한 겹 위에 떠 있어 반경과 민 거리가 한 걸음 크다.
describe('FAB_SHADOW', () => {
  it('원의 그림자가 그 값에서 나온다', () => {
    expect(boxShadowOf(SHADOW_COLOR, FAB_SHADOW)).toBe('0px 4px 24px #0000003a')
  })

  // 실효 알파는 하단바 알약과 같은 0.23 이다. 그 값은 실기기에서 고른 것이라 여기서 되짚는다.
  it('실효 알파가 알약과 같다', () => {
    expect(FAB_SHADOW.opacity).toBe(0.65)
  })
})
