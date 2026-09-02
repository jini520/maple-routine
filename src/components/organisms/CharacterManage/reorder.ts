// 「선택됨」 층 **순서 바꾸기의 값 규칙** — 제스처와 떼어 둔다.
//
// ── 왜 떼어 두나 ────────────────────────────────────────────────────────────────────
//
// 끌기는 자동 테스트가 원리적으로 못 본다: 제스처는 네이티브가 인식하고, jest 의 렌더러는 레이아웃을
// 계산하지 않아 «행이 어디까지 내려갔는가» 라는 사실 자체가 없다. 그래서 이 파일에 **손가락 좌표
// → 결과** 사이의 판단을 전부 모으고, 화면 쪽 코드는 좌표를 넣고 나온 값을 그리기만 한다. 계산이
// 제스처 콜백 안에 있으면 그 규칙은 실기기에서만 검증되는데, 이 phase 에는 그 자리가 없다.
//
// ── 끌기와 접근성 액션이 **같은 함수**를 부른다 ─────────────────────────────────────
//
// 끌기는 스크린리더로 조작할 수 없어 「위로/아래로 옮기기」 액션이 짝으로 선다.
// 그 둘이 각자 배열을 만들면 언젠가 갈라지므로 `moveOcid` 하나만 둔다 — 액션은 `to = index ± 1`,
// 끌기는 `to = resolveDropIndex(…)` 로 **같은 문에 들어온다.**

/** 목록 안으로 자른다 — 위/아래로 넘겨도 던지지 않는다. */
function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1)
}

/**
 * `from` 번째를 빼서 `to` 번째에 끼운다 — **놓은 자리가 곧 배열 순서다.**
 *
 * 경계 밖은 목록 안으로 자르고, 결과가 제자리면 내용이 같은 새 배열이다(호출부가 «바뀌었는가» 를
 * 배열 내용으로 판정하므로 참조가 아니라 내용이 계약이다 — `isDirty` 가 그 값을 본다).
 */
export function moveOcid(ocids: string[], from: number, to: number): string[] {
  if (ocids.length === 0) return []

  const source = clampIndex(from, ocids.length)
  const target = clampIndex(to, ocids.length)
  if (source === target) return [...ocids]

  const next = [...ocids]
  const [moved] = next.splice(source, 1)
  next.splice(target, 0, moved)
  return next
}

/**
 * 끈 거리(px)를 «몇 번째 칸에 놓이는가» 로 바꾼다.
 *
 * 행 높이는 얼굴(40px)이 정해 전부 같으므로 칸 간격 하나로 충분하다. 반올림이라 **반 칸을 넘어야**
 * 자리를 내준다 — 그보다 예민하면 손을 조금만 떨어도 목록이 흔들린다.
 *
 * `pitchPx` 가 0인 것은 «아직 재지 않았다» 는 뜻이라(첫 프레임) 제자리로 답한다. 나누면 `Infinity`
 * 가 되어 끝 칸으로 튄다.
 */
export function resolveDropIndex(
  fromIndex: number,
  offsetPx: number,
  pitchPx: number,
  count: number,
): number {
  if (pitchPx <= 0 || count === 0) return fromIndex
  return clampIndex(fromIndex + Math.round(offsetPx / pitchPx), count)
}

interface AutoScrollInput {
  /** 손가락의 화면 좌표(`absoluteY`). */
  pointerYPx: number
  /** 굴릴 수 있는 영역의 위·아래 — 화면 가장자리(안전영역 안쪽)다. */
  topPx: number
  bottomPx: number
  /** 그 가장자리에서 몇 px 안쪽까지를 «가장자리» 로 볼 것인가. */
  zonePx: number
  /** 가장 끝에서의 한 프레임 이동량. */
  maxStepPx: number
}

/**
 * 한 프레임에 굴릴 거리 — 위쪽이면 음수, 아래쪽이면 양수, 가운데면 0.
 *
 * **깊이에 비례**한다(경계에서 0, 끝에서 최대). 계단으로 두면 구간에 살짝 걸치기만 해도 최대
 * 속도로 튀어 «놓을 자리» 를 지나쳐 버린다. 화면 밖으로 나간 손가락도 최대에서 멈춘다.
 *
 * 고정 영역을 만들어 이 문제를 피하지 않는다(— 이 화면에는 고정된 자리가 없다).
 */
export function resolveAutoScrollStepPx(input: AutoScrollInput): number {
  if (input.zonePx <= 0) return 0

  const depthAbove = (input.topPx + input.zonePx - input.pointerYPx) / input.zonePx
  if (depthAbove > 0) return -input.maxStepPx * Math.min(depthAbove, 1)

  const depthBelow = (input.pointerYPx - (input.bottomPx - input.zonePx)) / input.zonePx
  if (depthBelow > 0) return input.maxStepPx * Math.min(depthBelow, 1)

  return 0
}

/**
 * 끌고 있는 동안 **다른 행**이 비켜 주는 칸 수(-1·0·1).
 *
 * 배열은 놓을 때까지 안 바뀌고(그래야 도중에 취소해도 원래대로다) 화면만 미리 그 결과를 보여준다.
 * 끌고 있는 행 자신은 손가락을 따라가므로 여기서 0이다.
 */
export function resolveRowShiftSteps(index: number, fromIndex: number, toIndex: number): number {
  if (index === fromIndex) return 0
  if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return -1
  if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return 1
  return 0
}
