// 호 경로와 각도. 치수는 `portrait-metrics` 가 검사한다.
import {
  isFullTurn,
  portraitRingArcPath,
  portraitRingSpan,
  portraitTextArcPath,
  ringRatio,
} from '../portrait-arc'
import { PORTRAIT_RAIL } from '../portrait-metrics'

describe('글자 호', () => {
  // 반지름은 인자가 아니다. 값이 하나뿐이라 경로도 하나뿐이다.
  //
  // 식을 다시 세우지 않고 **좌표를 그대로 적는다.** 상수에서 다시 계산하면 구현과 같은 식이라
  // 어느 상수가 바뀌어도 함께 따라가 아무것도 안 잡는다.
  it('아래 반원을 왼쪽에서 오른쪽으로 그린다(sweep 0)', () => {
    expect(portraitTextArcPath()).toBe('M -1 32 A 35 35 0 0 0 69 32')
  })
})

describe('링 구간', () => {
  // 정정 1: 컨텐츠는 좌·우 반원(일간·주간), 보스는 온전한 원(주간)이다. 셋 다 12시에서 시작한다.
  it('좌·우 반원이 12시에서 갈라져 서로 반대로 돈다', () => {
    const gap = PORTRAIT_RAIL.ringGapDeg

    expect(portraitRingSpan('left')).toEqual({ from: -gap, to: -(180 - gap) })
    expect(portraitRingSpan('right')).toEqual({ from: gap, to: 180 - gap })
  })

  // 정정 3(사용자 지시): 온전한 원은 **반시계**로 돌고 **12시에 틈이 없다**. 가를 상대가 없는
  // 링에서 틈은 나눔이 아니라 결손으로 읽힌다.
  it('온전한 원은 12시에서 반시계로 한 바퀴를 틈 없이 돈다', () => {
    const full = portraitRingSpan('full')

    expect(full.from).toBe(0)
    expect(full.to).toBe(-360)
    expect(isFullTurn(full)).toBe(true)
  })

  it('반원은 한 바퀴가 아니다 — 호로 그린다', () => {
    expect(isFullTurn(portraitRingSpan('left'))).toBe(false)
    expect(isFullTurn(portraitRingSpan('right'))).toBe(false)
  })

  it('180도를 넘으면 large-arc 플래그가 선다', () => {
    expect(portraitRingArcPath(5, 100)).toContain(' 0 0 1 ')
    expect(portraitRingArcPath(5, 355)).toContain(' 0 1 1 ')
  })

  it('반시계(왼쪽 반원)는 sweep 0 이다', () => {
    expect(portraitRingArcPath(-5, -175)).toContain(' 0 0 0 ')
  })

  // 길이 0인 호를 그리면 `strokeLinecap="round"` 가 점 하나를 찍어 조금 했다로 보인다.
  it('길이가 0이면 경로를 아예 안 만든다', () => {
    expect(portraitRingArcPath(5, 5)).toBe('')
  })
})

describe('진행 비율', () => {
  it('절반은 0.5 다', () => {
    expect(ringRatio(1, 2)).toBe(0.5)
  })

  // 0/0을 100%로 읽으면 아직 아무것도 없는 캐릭터가 다 찬 것처럼 보인다.
  it('셀 것이 없으면 0 이다', () => {
    expect(ringRatio(0, 0)).toBe(0)
  })

  it('넘치거나 음수여도 0~1 로 잘린다', () => {
    expect(ringRatio(5, 2)).toBe(1)
    expect(ringRatio(-1, 2)).toBe(0)
  })
})
