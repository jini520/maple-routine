// 클램프의 **산수**만 보는 테스트 — 렌더는 옆 파일(`Text.test.tsx`)이 본다([[ADR-152]] 결정 3).
//
// 표의 12칸을 그대로 케이스로 두는 이유: 이 함수가 지키는 것은 "min/max 를 곱한다" 가 아니라
// **«OS 가 줄 수 있는 값마다 무엇이 나오는가»** 다. 경계(1.0·1.235)만 검사하면 «하한을 끄기로
// 만든다»(결정 3)는 구현 선택이 바뀌어도 초록으로 남는데, 그 선택이 곧 계약이다.
import { FONT_SCALE_MAX, FONT_SCALE_MIN, fontScalingProps } from '../font-scaling'

/** iOS 가 주는 12칸 — `RCTUtils.mm:366` 의 하드코딩 표와 같은 값이다([[ADR-152]] 맥락). */
const iOS_배수 = [
  0.823, 0.882, 0.941, 1.0, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571,
]

/** 실제로 화면에 나올 배수 — `allowFontScaling` 이 꺼지면 OS 값과 무관하게 1.0 이다. */
function 실효배수(fontScale: number, fixed = false): number {
  const { allowFontScaling, maxFontSizeMultiplier } = fontScalingProps(fontScale, fixed)
  return allowFontScaling ? Math.min(fontScale, maxFontSizeMultiplier) : 1
}

describe('[[ADR-152]] — 시스템 글자 배수를 [1.0, 1.235] 로 자른다', () => {
  it('하한·상한이 결정한 값 그대로다', () => {
    expect(FONT_SCALE_MIN).toBe(1)
    expect(FONT_SCALE_MAX).toBe(1.235)
  })

  it('축소는 «자르는» 것이 아니라 «끄는» 것이다 — 1 미만이면 스케일링 자체가 꺼진다', () => {
    for (const fontScale of iOS_배수.filter((v) => v < 1)) {
      expect(fontScalingProps(fontScale, false).allowFontScaling).toBe(false)
    }
  })

  it('1 이상이면 켜 두고 상한만 건다', () => {
    for (const fontScale of iOS_배수.filter((v) => v >= 1)) {
      expect(fontScalingProps(fontScale, false)).toEqual({
        allowFontScaling: true,
        maxFontSizeMultiplier: FONT_SCALE_MAX,
      })
    }
  })

  it('12칸 어디에서도 실효 배수가 [1, 1.235] 를 벗어나지 않는다', () => {
    for (const fontScale of iOS_배수) {
      const 배수 = 실효배수(fontScale)
      expect(배수).toBeGreaterThanOrEqual(FONT_SCALE_MIN)
      expect(배수).toBeLessThanOrEqual(FONT_SCALE_MAX)
    }
  })

  it('구간 안(1.118)은 손대지 않는다 — 클램프이지 고정이 아니다', () => {
    expect(실효배수(1.118)).toBe(1.118)
  })

  it('Android 의 값(0.85 · 1.3 · 2.0)도 같은 구간으로 들어온다', () => {
    expect(실효배수(0.85)).toBe(1)
    expect(실효배수(1.3)).toBe(FONT_SCALE_MAX)
    expect(실효배수(2.0)).toBe(FONT_SCALE_MAX)
  })

  // ── 값은 «목록» 이 아니다 ────────────────────────────────────────────────────────
  //
  // 위 12칸은 iOS 가 주는 값의 **전부**지만(`UIContentSizeCategory` 가 12개다), Android 의
  // `Configuration.fontScale` 은 **연속값**이다 — 제조사 슬라이더가 0.85·1.0·1.15·1.3 을 주고
  // 접근성 글꼴 크기는 2.0 까지 열리며, `Settings.System.FONT_SCALE` 로는 임의의 실수가 들어온다.
  // 그래서 계약을 «12칸에서 맞는다» 가 아니라 **«어떤 실수가 와도 구간 밖으로 안 나간다»** 로 적는다.
  // 구현이 표 조회가 아니라 비교 하나(`>= 1`)와 `min` 하나인 것이 이 성질의 근거다.
  describe('임의의 실수 — 표에 없는 값이 와도 성립한다', () => {
    /** 0.50 부터 3.60 까지 0.01 씩 — OS 가 실제로 낼 수 있는 범위를 통째로 훑는다. */
    const 스윕 = Array.from({ length: 311 }, (_, i) => Number((0.5 + i * 0.01).toFixed(2)))

    it('실효 배수가 구간을 벗어나는 값이 하나도 없다', () => {
      expect(스윕.filter((v) => 실효배수(v) < FONT_SCALE_MIN || 실효배수(v) > FONT_SCALE_MAX)).toEqual(
        [],
      )
    })

    it('구간 아래는 전부 1.0 으로 올라온다', () => {
      expect(스윕.filter((v) => v < FONT_SCALE_MIN).every((v) => 실효배수(v) === 1)).toBe(true)
    })

    it('구간 안은 전부 그대로 통과한다', () => {
      const 구간안 = 스윕.filter((v) => v >= FONT_SCALE_MIN && v <= FONT_SCALE_MAX)
      expect(구간안.length).toBeGreaterThan(20)
      expect(구간안.filter((v) => 실효배수(v) !== v)).toEqual([])
    })

    it('구간 위는 전부 1.235 로 내려온다', () => {
      expect(스윕.filter((v) => v > FONT_SCALE_MAX).every((v) => 실효배수(v) === FONT_SCALE_MAX)).toBe(
        true,
      )
    })
  })

  it('fixed 는 배수와 무관하게 1.0 이다 — 칸에 묶인 글자(결정 5)', () => {
    for (const fontScale of iOS_배수) {
      expect(실효배수(fontScale, true)).toBe(1)
      expect(fontScalingProps(fontScale, true).allowFontScaling).toBe(false)
    }
  })
})
