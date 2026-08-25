// 펼침판의 **움직임 값**([[ADR-170]] 결정 8).
//
// 값을 컴포넌트 밖에 두는 이유는 `ValuableRowBackground` 가 `valuable-row-glow.ts` 를 둔 이유와
// 같다 — **애니메이션을 띄우지 않고도 규칙을 검증**할 수 있어야 한다. 여기서 보는 것은 «계단이
// 어느 방향으로 서는가» 이고, 그것이 이 판이 말하려는 것의 전부다.
import {
  DIAL_MOTION,
  DIAL_RISE_PX,
  DIAL_SLIDE_PX,
  DIAL_START_SCALE,
  FAB_OPEN_ROTATION_DEG,
  dialTiming,
} from '../speed-dial-motion'

describe('열림 — 계단이 FAB 에서 멀어지는 방향이다', () => {
  // 가까운 것부터 밀려 나와야 «두 개가 동시에 나타났다» 가 아니라 «이 버튼에서 나왔다» 로 읽힌다.
  it('지출이 수입보다 먼저 뜬다 — FAB 에 더 가깝다', () => {
    expect(DIAL_MOTION.expenseCircle.openDelayMs).toBeLessThan(DIAL_MOTION.incomeCircle.openDelayMs)
  })

  it('지출 원이 맨 먼저다 — 지연이 없다', () => {
    expect(DIAL_MOTION.expenseCircle.openDelayMs).toBe(0)
  })

  // 원이 자리를 잡은 **뒤에** 라벨이 밀려 나온다 — «메뉴가 떴다» 를 «버튼이 자기 이름을 폈다» 로
  // 바꾸는 한 겹이다.
  it('칩이 제 원보다 늦다', () => {
    expect(DIAL_MOTION.expenseChip.openDelayMs).toBeGreaterThan(
      DIAL_MOTION.expenseCircle.openDelayMs,
    )
    expect(DIAL_MOTION.incomeChip.openDelayMs).toBeGreaterThan(DIAL_MOTION.incomeCircle.openDelayMs)
  })

  it('스크림과 FAB 는 기다리지 않는다 — 판이 열리는 것 자체는 즉시다', () => {
    expect(DIAL_MOTION.scrim.openDelayMs).toBe(0)
    expect(DIAL_MOTION.fab.openDelayMs).toBe(0)
  })
})

describe('닫힘 — 더 빠르고 역순이다', () => {
  // 닫기가 열기만큼 길면 답답하다.
  it('무엇이든 닫는 쪽이 짧다', () => {
    for (const [name, step] of Object.entries(DIAL_MOTION)) {
      expect(`${name}:${step.closeMs}`).toBe(`${name}:${Math.min(step.closeMs, step.openMs)}`)
      expect(step.closeMs).toBeLessThan(step.openMs)
    }
  })

  // 열림이 «원 둘 → 칩 둘» 이므로 닫힘은 «칩 둘 → 원 둘» 이다. 각 줄 안에서는 FAB 에서 먼
  // 수입이 먼저 접혀 «빨려 들어가는» 방향이 된다.
  it('칩 둘이 원 둘보다 먼저 접힌다', () => {
    const 칩 = Math.max(DIAL_MOTION.incomeChip.closeDelayMs, DIAL_MOTION.expenseChip.closeDelayMs)
    const 원 = Math.min(
      DIAL_MOTION.incomeCircle.closeDelayMs,
      DIAL_MOTION.expenseCircle.closeDelayMs,
    )

    expect(칩).toBeLessThan(원)
  })

  it('각 줄 안에서는 수입이 먼저다 — FAB 에서 먼 쪽이다', () => {
    expect(DIAL_MOTION.incomeChip.closeDelayMs).toBeLessThan(DIAL_MOTION.expenseChip.closeDelayMs)
    expect(DIAL_MOTION.incomeCircle.closeDelayMs).toBeLessThan(
      DIAL_MOTION.expenseCircle.closeDelayMs,
    )
  })

  it('맨 먼저 접히는 것은 수입 칩이다 — 기다리지 않는다', () => {
    expect(DIAL_MOTION.incomeChip.closeDelayMs).toBe(0)
  })

  it('닫힘 순서가 열림 순서를 뒤집은 것이다', () => {
    const byOpen = Object.entries(DIAL_MOTION)
      .filter(([name]) => name !== 'scrim' && name !== 'fab')
      .sort(([, a], [, b]) => a.openDelayMs - b.openDelayMs)
      .map(([name]) => name)
    const byClose = Object.entries(DIAL_MOTION)
      .filter(([name]) => name !== 'scrim' && name !== 'fab')
      .sort(([, a], [, b]) => a.closeDelayMs - b.closeDelayMs)
      .map(([name]) => name)

    expect(byClose).toEqual([...byOpen].reverse())
  })
})

describe('dialTiming', () => {
  it('열 때와 닫을 때 다른 값을 준다', () => {
    expect(dialTiming(DIAL_MOTION.incomeChip, true, false)).toEqual({ delay: 110, duration: 180 })
    expect(dialTiming(DIAL_MOTION.incomeChip, false, false)).toEqual({ delay: 0, duration: 130 })
  })

  // 계단은 **움직임이 있을 때만** 뜻이 있다 — 이동·스케일이 꺼지면 순서가 보일 자리가 없고,
  // 지연만 남으면 «아무 일도 없다가 툭 나타난다» 가 된다.
  it('움직임을 줄이면 지연이 0 이다', () => {
    expect(dialTiming(DIAL_MOTION.incomeChip, true, true).delay).toBe(0)
    expect(dialTiming(DIAL_MOTION.expenseCircle, false, true).delay).toBe(0)
  })

  it('움직임을 줄여도 길이는 남긴다 — 페이드는 여전히 필요하다', () => {
    expect(dialTiming(DIAL_MOTION.incomeChip, true, true).duration).toBe(180)
  })
})

describe('이동 거리', () => {
  // `BottomBar` 의 `ROW_SHIFT = 10` 과 같은 값이다 — 그 파일 주석이 이유를 적어 뒀다:
  // «크면 «날아온다» 가 되어 층 관계가 흐려진다».
  it('원과 칩이 열 픽셀만 움직인다', () => {
    expect(DIAL_RISE_PX).toBe(10)
    expect(DIAL_SLIDE_PX).toBe(10)
  })

  it('원이 조금 작게 시작한다 — 사라지지는 않는다', () => {
    expect(DIAL_START_SCALE).toBeGreaterThan(0.5)
    expect(DIAL_START_SCALE).toBeLessThan(1)
  })

  // ＋ 를 45° 돌리면 그대로 ✕ 다 — 아이콘이 하나뿐이라 두 그림이 어긋날 자리가 없다.
  it('FAB 가 사십오도 돈다', () => {
    expect(FAB_OPEN_ROTATION_DEG).toBe(45)
  })
})
