// 당김 인디케이터를 **얼마나 내리는가**.
//
// 값이 하나가 아닌 이유는 두 플랫폼이 인디케이터를 **다른 자리에서 시작**하기 때문이다. 마스크에
// 깎이는 것은 둘 다 같지만(뷰 트리로 걸린다. 안드로이드에서도 `AndroidSwipeRefreshLayout` 이
// `ScrollView` 를 감싼 채 `MaskedView` 안에 있다), 기본 자리가 다르므로 **구간 밖으로 내보내는 데
// 필요한 양** 도 다르다.
//
// | | 기본 자리(오프셋 0) | 페이드 구간을 벗어나려면 |
// |---|---|---|
// | iOS | 당긴 틈의 가운데. 화면 맨 위에서 시작 | 구간 높이 **전부** |
// | 안드로이드 | 원이 이미 **24dp** 내려온 자리에서 멈춘다 | 구간 높이 **− 24** |
//
// 안드로이드의 24 는 우리가 고른 값이 아니라 플랫폼 상수의 차다. RN 의
// `ReactSwipeRefreshLayout` 이 `end = offset + DEFAULT_CIRCLE_TARGET(64) − 원 지름(40)` 으로
// 정지 위치를 잡는다. 그래서 원의 윗변은 `offset + 24` 에 선다.

import {
  ANDROID_CIRCLE_REST_TOP_PX,
  resolvePullIndicatorOffset,
} from '../pull-indicator-offset'

describe('resolvePullIndicatorOffset', () => {
  // iOS 는 `UIRefreshControl.bounds` 원점을 그만큼 내릴 뿐이라 기본 자리가 화면 맨 위다.
  it('iOS 는 페이드 높이만큼 내린다', () => {
    expect(resolvePullIndicatorOffset({ fadeTopPx: 59, platform: 'ios' })).toBe(59)
  })

  // ★ 이 테스트가 정정 1 자신이다. 정정 전에는 안드로이드도 59(또는 48)를 그대로 받아
  //   원이 필요보다 24dp 낮은 자리에서 돌았다.
  it('안드로이드는 원이 이미 내려와 있는 24 를 뺀다', () => {
    expect(resolvePullIndicatorOffset({ fadeTopPx: 48, platform: 'android' })).toBe(24)
    expect(ANDROID_CIRCLE_REST_TOP_PX).toBe(24)
  })

  // 큰 컷아웃 기기(인셋이 하한 48보다 큰 경우)에서도 뺄셈은 같다.
  it('페이드가 더 길면 그만큼 더 내린다. 뺄셈은 그대로다', () => {
    expect(resolvePullIndicatorOffset({ fadeTopPx: 72, platform: 'android' })).toBe(48)
  })

  // 원이 이미 구간 밖이면 더 내릴 몫이 없다. 음수를 넘기면 RN 이 원을 **위로** 올려 도로
  // 가려지므로 0 에서 멈춘다.
  it('페이드가 원의 기본 자리보다 짧으면 안 내린다', () => {
    expect(resolvePullIndicatorOffset({ fadeTopPx: 20, platform: 'android' })).toBe(0)
  })

  // 헤더가 없는 화면(설정 계열)은 셸이 상자를 내려 안전영역을 먹으므로 위를 안 깎는다.
  // 깎지 않으면 가려질 일도 없고, 그래도 내리면 엉뚱하게 낮은 자리에서 돈다.
  it('상단을 안 깎는 화면에서는 두 플랫폼 다 0 이다', () => {
    expect(resolvePullIndicatorOffset({ fadeTopPx: 0, platform: 'ios' })).toBe(0)
    expect(resolvePullIndicatorOffset({ fadeTopPx: 0, platform: 'android' })).toBe(0)
  })
})
