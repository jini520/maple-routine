import {
  PULL_MAX_PX,
  PULL_RESISTANCE,
  PULL_SETTLE_TRANSITION,
  PULL_THRESHOLD_PX,
  resolveContentOffsetPx,
  resolvePullDistance,
  resolvePullPhase,
  resolvePullProgress,
  shouldTriggerRefresh,
} from '../pull-to-refresh'

describe('resolvePullDistance', () => {
  it('위로 움직인 델타는 당김이 아니라 0이다', () => {
    expect(resolvePullDistance(-30)).toBe(0)
    expect(resolvePullDistance(0)).toBe(0)
  })

  it('감쇠 계수를 적용한다', () => {
    expect(resolvePullDistance(100)).toBe(100 * PULL_RESISTANCE)
  })

  it('상한에서 멈춘다', () => {
    expect(resolvePullDistance(1000)).toBe(PULL_MAX_PX)
  })
})

describe('resolvePullPhase', () => {
  it('당기지 않았으면 idle이다', () => {
    expect(resolvePullPhase(0, false)).toBe('idle')
  })

  it('임계값 미만은 pulling이다', () => {
    expect(resolvePullPhase(1, false)).toBe('pulling')
    expect(resolvePullPhase(PULL_THRESHOLD_PX - 1, false)).toBe('pulling')
  })

  it('경계 정확히 임계값이면 ready다', () => {
    expect(resolvePullPhase(PULL_THRESHOLD_PX, false)).toBe('ready')
    expect(resolvePullPhase(PULL_MAX_PX, false)).toBe('ready')
  })

  it('재조회 중이면 distance가 0이어도 refreshing이다', () => {
    expect(resolvePullPhase(0, true)).toBe('refreshing')
    expect(resolvePullPhase(PULL_THRESHOLD_PX, true)).toBe('refreshing')
  })
})

describe('shouldTriggerRefresh', () => {
  it('경계 정확히 임계값에서 true다 — resolvePullPhase의 ready와 같은 경계', () => {
    expect(shouldTriggerRefresh(PULL_THRESHOLD_PX)).toBe(true)
    expect(resolvePullPhase(PULL_THRESHOLD_PX, false)).toBe('ready')
  })

  it('임계값 미만이면 false다', () => {
    expect(shouldTriggerRefresh(PULL_THRESHOLD_PX - 1)).toBe(false)
    expect(shouldTriggerRefresh(0)).toBe(false)
  })
})

describe('resolvePullProgress', () => {
  it('임계값까지 0~1로 비례한다', () => {
    expect(resolvePullProgress(0)).toBe(0)
    expect(resolvePullProgress(PULL_THRESHOLD_PX / 2)).toBe(0.5)
    expect(resolvePullProgress(PULL_THRESHOLD_PX)).toBe(1)
  })

  it('임계값을 넘겨 더 당겨도 1을 넘지 않는다', () => {
    expect(resolvePullProgress(PULL_MAX_PX)).toBe(1)
    expect(resolvePullProgress(1000)).toBe(1)
  })

  it('음수 거리는 0이다', () => {
    expect(resolvePullProgress(-10)).toBe(0)
  })
})

describe('resolveContentOffsetPx', () => {
  it('재조회 중에는 손을 떼서 distance가 0이어도 임계 위치에 머문다', () => {
    // ADR-073 결정 5 — 대기 신호가 문구뿐 아니라 목록 위치로도 남는다.
    expect(resolveContentOffsetPx(0, 'refreshing')).toBe(PULL_THRESHOLD_PX)
  })

  it('idle이면 0이다', () => {
    expect(resolveContentOffsetPx(0, 'idle')).toBe(0)
  })

  it('당기는 중에는 당김 거리를 그대로 쓴다', () => {
    expect(resolveContentOffsetPx(20, 'pulling')).toBe(20)
    expect(resolveContentOffsetPx(PULL_THRESHOLD_PX, 'ready')).toBe(PULL_THRESHOLD_PX)
  })

  it('당기는 중에도 상한을 넘지 않는다', () => {
    expect(resolveContentOffsetPx(1000, 'ready')).toBe(PULL_MAX_PX)
    expect(resolveContentOffsetPx(-10, 'pulling')).toBe(0)
  })
})

describe('PULL_SETTLE_TRANSITION', () => {
  it('transform 을 대상으로 하는 전환 문자열이다', () => {
    // 목록 이동은 transform 이라 다른 속성을 적으면 정착·복귀가 통째로 즉시 점프한다(ADR-073 결정 2·4).
    expect(PULL_SETTLE_TRANSITION).toMatch(/^transform\s/)
  })
})
