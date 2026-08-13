import { describe, expect, it } from 'vitest'
import { DROP_EFFECT_FRAMES } from '../drop-effect-frames'
import { DROP_EFFECT_ORIGINS, dropFrameTransform } from '../drop-effect-layout'

const PHASES = ['pre', 'loop', 'end'] as const

describe('DROP_EFFECT_ORIGINS', () => {
  // 테이블은 에셋 비트맵에서 계측한 값이라 프레임과 인덱스로만 묶여 있다(ADR-048). 에셋을 다시 export 해
  // 프레임 수가 바뀌면 기둥이 엉뚱한 위치로 튀므로, 조용히 어긋나지 않게 개수를 고정한다.
  it.each(PHASES)('%s: origin 개수가 실제 프레임 수와 일치한다', (phase) => {
    expect(DROP_EFFECT_ORIGINS[phase]).toHaveLength(DROP_EFFECT_FRAMES[phase].length)
    expect(DROP_EFFECT_ORIGINS[phase].length).toBeGreaterThan(0)
  })

  it.each(PHASES)('%s: origin이 모두 유한한 양수 좌표다', (phase) => {
    for (const [x, y] of DROP_EFFECT_ORIGINS[phase]) {
      expect(Number.isFinite(x) && x > 0).toBe(true)
      expect(Number.isFinite(y) && y > 0).toBe(true)
    }
  })
})

describe('dropFrameTransform', () => {
  // origin 점이 요소 좌상단(= 화면 앵커)에 오도록 스케일된 만큼 되돌려 미는 변환.
  it('origin을 앵커로 끌어오는 translate + scale을 만든다', () => {
    expect(dropFrameTransform([100, 800], 1.3)).toBe('translate(-130px, -1040px) scale(1.3)')
  })

  it('스케일이 1이면 origin 픽셀 값 그대로 되민다', () => {
    expect(dropFrameTransform([58.8, 288], 1)).toBe('translate(-58.8px, -288px) scale(1)')
  })

  // 소수 origin × 스케일이 부동소수 꼬리(76.44000000000001)를 남기면 style 문자열이 지저분해진다.
  it('부동소수 꼬리를 남기지 않는다', () => {
    expect(dropFrameTransform([58.8, 288], 1.3)).toBe('translate(-76.44px, -374.4px) scale(1.3)')
  })
})
