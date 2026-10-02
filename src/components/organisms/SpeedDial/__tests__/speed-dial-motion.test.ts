// 펼치는 ＋ 의 **움직임 값**.
//
// 값을 컴포넌트 밖에 두는 이유는 **애니메이션을 띄우지 않고도 규칙을 검증**하기 위해서다. 여기서 보는 것은
// 두 단계(원이 솟고 → 알약으로 펼쳐진다)의 **순서와 계단의 방향**이고, 그것이 이 부품이 말하려는 것의 전부다.
import {
  DIAL_GAP_PX,
  DIAL_RISE_START_SCALE,
  FAB_OPEN_ROTATION_DEG,
  PILL_HEIGHT_PX,
  chromeTiming,
  dialTiming,
  pillWidth,
  riseOffsetPx,
} from '../speed-dial-motion'
import { FAB_DIAMETER_PX } from '../../../../lib/fab-metrics'

/** 갈래 셋, 위에서부터 0 · 1 · 2. 2 가 ＋ 에 가장 가깝다 */
const 셋 = [0, 1, 2].map((index) => dialTiming(index, 3, true, false))

describe('펴기. 원이 먼저 솟고, 위 알약부터 펼쳐진다', () => {
  // 가까운 것부터 솟아야 **동시에 나타났다** 가 아니라 **이 버튼에서 나왔다** 로 읽힌다.
  it('원은 ＋ 에 가까운 것부터 솟는다', () => {
    expect(셋[2]!.rise.delayMs).toBe(0)
    expect(셋[1]!.rise.delayMs).toBeGreaterThan(셋[2]!.rise.delayMs)
    expect(셋[0]!.rise.delayMs).toBeGreaterThan(셋[1]!.rise.delayMs)
  })

  it('알약은 맨 위부터 펼쳐진다', () => {
    expect(셋[0]!.expand.delayMs).toBeLessThan(셋[1]!.expand.delayMs)
    expect(셋[1]!.expand.delayMs).toBeLessThan(셋[2]!.expand.delayMs)
  })

  // 첫 순간에는 ＋ 위에 원만 세로로 한 줄 선다. 펼침이 솟음을 앞지르면 그 줄이 안 보인다.
  it('어느 알약도 마지막 원이 솟기 시작하기 전에는 안 펼쳐진다', () => {
    const lastRise = Math.max(...셋.map((step) => step.rise.delayMs))
    for (const step of 셋) expect(step.expand.delayMs).toBeGreaterThan(lastRise)
  })

  it('이름은 제 알약이 펼치기 시작한 뒤에 나타난다', () => {
    for (const step of 셋) expect(step.label.delayMs).toBeGreaterThan(step.expand.delayMs)
  })

  it('갈래 둘이면 위가 아래보다 먼저 펼쳐진다', () => {
    expect(dialTiming(0, 2, true, false).expand.delayMs).toBeLessThan(dialTiming(1, 2, true, false).expand.delayMs)
  })
})

describe('접기. 거울이고 더 짧다', () => {
  const 접기 = [0, 1, 2].map((index) => dialTiming(index, 3, false, false))

  it('이름이 먼저 사라지고, 알약이 원으로 줄고, 원이 ＋ 로 들어간다', () => {
    for (const step of 접기) {
      expect(step.label.delayMs).toBeLessThan(step.expand.delayMs)
      expect(step.expand.delayMs).toBeLessThan(step.rise.delayMs)
    }
  })

  // 먼 것부터 들어가야 ＋ 로 **빨려 들어가는** 방향이 된다.
  it('원은 ＋ 에서 먼 것부터 들어간다', () => {
    expect(접기[0]!.rise.delayMs).toBeLessThan(접기[1]!.rise.delayMs)
    expect(접기[1]!.rise.delayMs).toBeLessThan(접기[2]!.rise.delayMs)
  })

  // 닫기가 열기만큼 길면 답답하다.
  it('무엇이든 접는 쪽이 짧다', () => {
    for (const [index, step] of 접기.entries()) {
      const open = 셋[index]!
      expect(step.rise.durationMs).toBeLessThan(open.rise.durationMs)
      expect(step.expand.durationMs).toBeLessThan(open.expand.durationMs)
      expect(step.label.durationMs).toBeLessThan(open.label.durationMs)
    }
    expect(chromeTiming(false, false).scrim.durationMs).toBeLessThan(chromeTiming(true, false).scrim.durationMs)
    expect(chromeTiming(false, false).fab.durationMs).toBeLessThan(chromeTiming(true, false).fab.durationMs)
  })

  it('스크림과 ＋ 는 원이 들어갈 때 함께 걷힌다', () => {
    expect(chromeTiming(false, false).scrim.delayMs).toBe(접기[0]!.rise.delayMs)
  })
})

describe('스크림과 ＋ 는 펼 때 기다리지 않는다', () => {
  it('지연이 없다', () => {
    expect(chromeTiming(true, false).scrim.delayMs).toBe(0)
    expect(chromeTiming(true, false).fab.delayMs).toBe(0)
  })
})

describe('움직임을 줄이면', () => {
  // 계단은 움직임이 있을 때만 뜻이 있다. 지연만 남으면 **아무 일도 없다가 툭 나타난다** 가 된다.
  it('지연이 모두 0 이다', () => {
    for (const isOpen of [true, false]) {
      const step = dialTiming(0, 3, isOpen, true)
      expect([step.rise.delayMs, step.expand.delayMs, step.label.delayMs]).toEqual([0, 0, 0])
      expect(chromeTiming(isOpen, true).scrim.delayMs).toBe(0)
    }
  })

  it('길이는 남긴다. 페이드는 여전히 필요하다', () => {
    expect(dialTiming(0, 3, true, true).rise.durationMs).toBe(dialTiming(0, 3, true, false).rise.durationMs)
  })
})

describe('치수', () => {
  // 알약이 ＋ 와 같은 높이라 펼치기 전의 원이 ＋ 와 같은 크기로 줄을 선다.
  it('알약 높이는 ＋ 지름이다', () => {
    expect(PILL_HEIGHT_PX).toBe(FAB_DIAMETER_PX)
  })

  // 넉넉한 고정 폭을 두지 않는다. 문구가 짧아지면 알약도 짧아진다(사용자 지시).
  it('알약 폭은 가장 긴 글자에 원 자리 60 과 오른쪽 여백 16 을 더한 것이다', () => {
    expect(pillWidth(100)).toBe(176)
    expect(pillWidth(40)).toBe(116)
  })

  it('글자를 아직 못 쟀으면 원 크기다', () => {
    expect(pillWidth(0)).toBe(PILL_HEIGHT_PX)
  })

  it('솟는 거리는 ＋ 중심에서 그 줄 중심까지다', () => {
    expect(riseOffsetPx(0)).toBe(PILL_HEIGHT_PX + DIAL_GAP_PX)
    expect(riseOffsetPx(1)).toBe(2 * (PILL_HEIGHT_PX + DIAL_GAP_PX))
  })

  it('원은 반 크기에서 솟는다', () => {
    expect(DIAL_RISE_START_SCALE).toBe(0.5)
  })

  // ＋ 를 45° 돌리면 그대로 ✕ 다. 아이콘이 하나뿐이라 두 그림이 어긋날 자리가 없다.
  it('＋ 가 사십오도 돈다', () => {
    expect(FAB_OPEN_ROTATION_DEG).toBe(45)
  })
})
