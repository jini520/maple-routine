/**
 * 펼침판의 **움직임 값** — 판정과 그리기를 가른다.
 *
 * 값이 컴포넌트 밖에 있는 이유는 `valuable-row-glow.ts` 와 같다: **애니메이션을 띄우지 않고도
 * 규칙을 검증**할 수 있어야 한다. 계단의 방향(어느 것이 먼저 뜨고 먼저 접히는가)이 이 판이
 * 말하려는 것의 전부인데, 그것은 렌더된 프레임으로는 붙들기 어렵다.
 *
 * ## 계단이 뜻을 든다
 *
 * - **열 때는 FAB 에서 가까운 것부터** — 지출 원 → 지출 칩 → 수입 원 → 수입 칩.
 *   그래야 «두 개가 동시에 나타났다» 가 아니라 **«이 버튼에서 나왔다»** 로 읽힌다.
 * - **칩은 제 원보다 늦다.** 원이 자리를 잡은 뒤 라벨이 옆으로 밀려 나오는 한 겹이
 *   «메뉴가 떴다» 를 **«버튼이 자기 이름을 폈다»** 로 바꾼다.
 * - **닫을 때는 역순이고 더 짧다.** 먼 것부터 접혀 **FAB 로 빨려 들어가는** 방향이고,
 *   닫기가 열기만큼 길면 답답하다.
 */

/** 한 요소가 열리고 닫히는 데 드는 시간(ms). */
export interface DialStep {
  readonly openDelayMs: number
  readonly openMs: number
  readonly closeDelayMs: number
  readonly closeMs: number
}

/** 닫힘은 어느 요소든 이 길이다 — 값이 하나라 «닫기가 더 짧다» 가 구조로 지켜진다. */
const CLOSE_MS = 130

export const DIAL_MOTION = {
  scrim: { openDelayMs: 0, openMs: 160, closeDelayMs: 0, closeMs: CLOSE_MS },
  fab: { openDelayMs: 0, openMs: 220, closeDelayMs: 0, closeMs: CLOSE_MS },
  // 아래 넷의 지연이 계단이다.
  //
  //   열림   원 둘이 먼저 솟고(0 · 50) 칩 둘이 뒤따라 펴진다(60 · 110).
  //   닫힘   그 **정확한 거울** — 칩 둘이 먼저 접히고(0 · 20) 원 둘이 꺼진다(40 · 60).
  //
  // 처음 초안은 닫힘을 «행별» 로 뒀다(수입 칩 → 수입 원 → 지출 칩 → 지출 원). 그러면 열림은
  // «종류별», 닫힘은 «행별» 이라 두 방향이 서로 다른 규칙이 된다 — 테스트가 그 어긋남을 잡았다.
  // 각 줄 안에서는 **수입이 먼저** 접힌다: FAB 에서 먼 것부터라 «빨려 들어가는» 방향이 된다.
  expenseCircle: { openDelayMs: 0, openMs: 220, closeDelayMs: 60, closeMs: CLOSE_MS },
  expenseChip: { openDelayMs: 60, openMs: 180, closeDelayMs: 20, closeMs: CLOSE_MS },
  incomeCircle: { openDelayMs: 50, openMs: 220, closeDelayMs: 40, closeMs: CLOSE_MS },
  incomeChip: { openDelayMs: 110, openMs: 180, closeDelayMs: 0, closeMs: CLOSE_MS },
} as const satisfies Record<string, DialStep>

/**
 * 원과 칩이 움직이는 거리(px) — `BottomBar` 의 `ROW_SHIFT` 와 **같은 값**이다.
 * 그 파일 주석이 이유를 적어 뒀다: *«크면 «날아온다» 가 되어 층 관계가 흐려진다»*.
 */
export const DIAL_RISE_PX = 10
export const DIAL_SLIDE_PX = 10

/** 원이 시작하는 크기. 0 에서 자라면 «터져 나온다» 가 되어 위 거리와 어울리지 않는다. */
export const DIAL_START_SCALE = 0.8

/** ＋ 를 이만큼 돌리면 그대로 ✕ 다 — 아이콘이 하나뿐이라 두 그림이 어긋날 자리가 없다. */
export const FAB_OPEN_ROTATION_DEG = 45

/**
 * 이 요소가 지금 쓸 지연과 길이.
 *
 * **움직임을 줄이면 지연을 0 으로 접는다.** 계단은 이동·스케일이 있을 때만 보이는데, 그것들을
 * 끄고 지연만 남기면 «아무 일도 없다가 툭 나타난다» 가 된다 — 뜻은 사라지고 기다림만 남는다.
 * 길이는 남긴다: 페이드는 여전히 «열리는 중» 을 말해 준다.
 */
export function dialTiming(
  step: DialStep,
  isOpen: boolean,
  reduceMotion: boolean,
): { delay: number; duration: number } {
  const delay = isOpen ? step.openDelayMs : step.closeDelayMs
  return {
    delay: reduceMotion ? 0 : delay,
    duration: isOpen ? step.openMs : step.closeMs,
  }
}
