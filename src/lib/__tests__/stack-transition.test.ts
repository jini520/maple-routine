import { describe, expect, it } from 'vitest'
import {
  resolveBelowTransform,
  resolveLayerAboveProgress,
  resolveLayerTransform,
  resolveParentPath,
  resolveScrimOpacity,
  resolveSettleMs,
  resolveStackDirection,
  resolveStackTransform,
  resolveTabPath,
  shouldPopOnRelease,
  STACK_BELOW_SHIFT_PERCENT,
  STACK_MIN_SETTLE_MS,
  STACK_POP_DISTANCE_RATIO,
  STACK_POP_VELOCITY,
  STACK_SCRIM_OPACITY,
  STACK_TRANSITION_MS,
} from '../stack-transition'

describe('resolveStackTransform', () => {
  it('다 들어와 멈춰 있으면 transform 속성을 걸지 않는다 (ADR-120 결정 7)', () => {
    // translateX(0) 을 남기면 그 요소가 containing block 이 되어 fixed·중첩 sticky 후손의
    // 기준을 바꾼다(ADR-073 결정 3). 값이 0이면 속성 자체가 없어야 한다.
    expect(resolveStackTransform(0)).toBeUndefined()
  })

  it('화면 밖 오른쪽은 100%다', () => {
    expect(resolveStackTransform(1)).toBe('translateX(100%)')
  })

  it('중간 진행률은 그대로 비례한다', () => {
    expect(resolveStackTransform(0.5)).toBe('translateX(50%)')
  })

  it('범위를 벗어난 값은 잘라낸다 — 러버밴드로 음수가 들어와도 되밀리지 않는다', () => {
    expect(resolveStackTransform(-0.4)).toBeUndefined()
    expect(resolveStackTransform(1.8)).toBe('translateX(100%)')
  })
})

describe('resolveBelowTransform', () => {
  it('오버레이가 없으면(진행률 1) transform 속성을 걸지 않는다', () => {
    // 앱 시간의 대부분이 이 상태다 — 탭 화면에 transform 이 존재하지 않아야 한다.
    expect(resolveBelowTransform(1)).toBeUndefined()
  })

  it('오버레이가 다 들어오면 패럴랙스 비율만큼 밀린다', () => {
    expect(resolveBelowTransform(0)).toBe(`translateX(${-STACK_BELOW_SHIFT_PERCENT}%)`)
  })

  it('진행률과 반대 방향으로 비례한다', () => {
    expect(resolveBelowTransform(0.5)).toBe(`translateX(${-STACK_BELOW_SHIFT_PERCENT / 2}%)`)
  })
})

describe('resolveScrimOpacity', () => {
  it('오버레이가 다 들어왔을 때 가장 어둡다', () => {
    expect(resolveScrimOpacity(0)).toBe(STACK_SCRIM_OPACITY)
  })

  it('오버레이가 없으면 투명하다', () => {
    expect(resolveScrimOpacity(1)).toBe(0)
  })
})

describe('shouldPopOnRelease', () => {
  it('거리 기준을 넘기면 pop 한다', () => {
    expect(shouldPopOnRelease(STACK_POP_DISTANCE_RATIO, 0)).toBe(true)
  })

  it('거리가 모자라면 원위치한다', () => {
    expect(shouldPopOnRelease(STACK_POP_DISTANCE_RATIO - 0.01, 0)).toBe(false)
  })

  it('빠르게 튕기면 거리가 모자라도 pop 한다', () => {
    // 짧게 튕기는 것도 "돌아가겠다"는 뜻이다. 거리만 보면 이 제스처가 취소된다.
    expect(shouldPopOnRelease(0.05, STACK_POP_VELOCITY)).toBe(true)
  })

  it('왼쪽으로 되민 속도(음수)는 pop 이 아니다', () => {
    expect(shouldPopOnRelease(0.1, -1.2)).toBe(false)
  })
})

describe('resolveSettleMs', () => {
  it('거의 다 끌어놓고 pop 하면 짧게 끝낸다', () => {
    // 남은 거리가 10%면 전체 시간의 10% — 다만 하한이 있다.
    expect(resolveSettleMs(0.9, true)).toBe(STACK_MIN_SETTLE_MS)
  })

  it('조금만 끌고 취소하면 그만큼만 되돌아간다', () => {
    expect(resolveSettleMs(0.1, false)).toBe(STACK_MIN_SETTLE_MS)
  })

  it('절반에서 pop 하면 남은 절반만큼 쓴다', () => {
    expect(resolveSettleMs(0.5, true)).toBe(Math.round(STACK_TRANSITION_MS / 2))
  })

  it('전환을 끈 환경(prefers-reduced-motion)에서는 0이다', () => {
    // 하한(120ms)이 0을 덮어쓰면 전환을 껐는데도 기다리게 된다.
    expect(resolveSettleMs(0.5, true, 0)).toBe(0)
  })
})

describe('resolveStackDirection', () => {
  it('부모로 가면 pop 이다', () => {
    expect(resolveStackDirection('/content/manage', '/content')).toBe('pop')
    expect(resolveStackDirection('/settings/about', '/settings')).toBe('pop')
  })

  it('자식으로 가면 push 다', () => {
    expect(resolveStackDirection('/profit', '/profit/drops')).toBe('push')
  })

  it('탭 이동은 replace 다 — 연출 없이 즉시 교체한다', () => {
    expect(resolveStackDirection('/content', '/boss')).toBe('replace')
  })

  it('하위 페이지에서 다른 탭으로 튀는 이동도 replace 다', () => {
    // ApiKeyNoticeModal 이 어느 화면에서든 온보딩으로 보내는 경로가 여기다.
    expect(resolveStackDirection('/settings/about', '/onboarding')).toBe('replace')
  })

  it('같은 경로는 replace 다 (스택 이동이 아니다)', () => {
    expect(resolveStackDirection('/content', '/content')).toBe('replace')
  })

  it('이름이 겹치는 형제를 부모·자식으로 오판하지 않는다', () => {
    // 문자열 startsWith 로 물으면 '/boss' 가 '/boss-profit' 의 부모로 보인다.
    expect(resolveStackDirection('/boss-profit', '/boss')).toBe('replace')
    expect(resolveStackDirection('/boss', '/boss-profit')).toBe('replace')
  })

  it('맨 끝 슬래시는 세그먼트가 아니다', () => {
    expect(resolveStackDirection('/content/manage', '/content/')).toBe('pop')
  })
})

describe('resolveLayerAboveProgress', () => {
  it('최상단은 위에 아무것도 없다', () => {
    expect(resolveLayerAboveProgress(0, 1, 0.4)).toBe(1)
    expect(resolveLayerAboveProgress(1, 2, 0.4)).toBe(1)
  })

  it('바로 위가 최상단이면 그 진행률이 곧 내가 밀리는 정도다', () => {
    expect(resolveLayerAboveProgress(0, 2, 0.4)).toBe(0.4)
    // 탭 레이어는 index -1 로 묻는다.
    expect(resolveLayerAboveProgress(-1, 1, 0.4)).toBe(0.4)
  })

  it('두 층 아래는 더 밀리지 않는다 — 위가 이미 다 덮고 있다', () => {
    expect(resolveLayerAboveProgress(-1, 2, 0.4)).toBe(0)
  })

  it('오버레이가 하나도 없으면 탭 레이어 위에는 아무것도 없다', () => {
    // 이 1이 resolveBelowTransform 을 undefined 로 만들어, 앱 시간의 대부분 동안
    // 탭 화면에 transform 이 존재하지 않게 한다(ADR-120 결정 7).
    expect(resolveLayerAboveProgress(-1, 0, 1)).toBe(1)
  })
})

describe('resolveLayerTransform', () => {
  it('최상단은 자기가 들어오고 나가는 값이다', () => {
    expect(resolveLayerTransform(0, 1, 0.5)).toBe('translateX(50%)')
  })

  it('아래 층은 반대 방향으로 밀린다', () => {
    expect(resolveLayerTransform(0, 2, 0)).toBe(`translateX(${-STACK_BELOW_SHIFT_PERCENT}%)`)
  })

  it('다 들어와 멈춘 최상단에는 속성이 없다', () => {
    expect(resolveLayerTransform(0, 1, 0)).toBeUndefined()
  })
})

describe('resolveTabPath', () => {
  it('탭 경로는 그대로다', () => {
    expect(resolveTabPath('/settings')).toBe('/settings')
  })

  it('하위 페이지는 부모 탭으로 접힌다', () => {
    expect(resolveTabPath('/content/manage')).toBe('/content')
    expect(resolveTabPath('/profit/drops')).toBe('/profit')
  })

  it('2단 하위 페이지도 탭까지 접힌다', () => {
    // 프리페치는 탭 단위라 깊이와 무관하게 같은 목록을 받아야 한다.
    expect(resolveTabPath('/settings/about/privacy')).toBe('/settings')
  })

  it('맨 끝 슬래시와 루트를 구분한다', () => {
    expect(resolveTabPath('/settings/')).toBe('/settings')
    expect(resolveTabPath('/')).toBe('/')
    expect(resolveTabPath('')).toBe('/')
  })
})

describe('resolveLayerTransform — 아직 등록되지 않은 층', () => {
  // **첫 렌더의 자리다.** `StackScreen` 은 마운트 effect 에서 `open()` 을 부르므로, 그 컴포넌트의
  // 첫 렌더는 아직 `depth` 에 세어지지 않은 상태로 돈다(index 0, depth 0). 여기서 `transform` 이
  // 없으면 오버레이가 **제자리에 통째로 한 번 그려지고** 그다음에야 밖으로 튀었다가 들어온다 —
  // 실기기에서 "화면이 다 그려진 뒤에 애니메이션이 시작"으로 관측됐다(2026-08-09).
  it('depth 에 아직 안 세어졌으면 화면 밖이다', () => {
    expect(resolveLayerTransform(0, 0, 1)).toBe('translateX(100%)')
  })

  it('2단의 첫 렌더도 화면 밖이다', () => {
    // /settings/about/privacy — 아래 층이 하나 있는 상태에서 새 층이 마운트되는 프레임.
    expect(resolveLayerTransform(1, 1, 0)).toBe('translateX(100%)')
  })

  it('등록된 뒤에는 평소대로 동작한다', () => {
    expect(resolveLayerTransform(0, 1, 1)).toBe('translateX(100%)')
    expect(resolveLayerTransform(0, 1, 0)).toBeUndefined()
  })
})

describe('resolveParentPath', () => {
  it('한 단계 위로 올라간다', () => {
    expect(resolveParentPath('/content/manage')).toBe('/content')
    expect(resolveParentPath('/settings/about/privacy')).toBe('/settings/about')
  })

  it('탭 최상위의 부모는 루트다', () => {
    expect(resolveParentPath('/settings')).toBe('/')
  })

  it('루트는 그대로다', () => {
    expect(resolveParentPath('/')).toBe('/')
    expect(resolveParentPath('')).toBe('/')
  })

  it('맨 끝 슬래시에 속지 않는다', () => {
    expect(resolveParentPath('/settings/about/')).toBe('/settings')
  })
})
