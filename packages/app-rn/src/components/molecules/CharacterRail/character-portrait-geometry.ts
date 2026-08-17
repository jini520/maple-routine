// 초상화 한 칸의 **기하 표**([[ADR-142]] 결정 2 · 정정 1).
//
// ## 이 표의 유일한 목적: 글자와 링이 겹치지 않는다
//
// **정정 1로 글자가 모두 아래로 내려왔고, 정정 2로 그 둘이 호 하나를 함께 쓴다.** 그래서 상자가
// 정사각이 아니고, 원이 **위로 붙는다** — 위쪽에 글자가 없으니 그 여백은 낭비다.
//
// ```
//        ┌────────────────┐  ← 상자 68 × 70
//        │    ╭──────╮    │
//        │   │ ● 얼굴 ● │   │  ← 링 r=26 (중심 y=32)
//        │    ╰──────╯    │
//        │ 내옆에최성일 Lv.285 │  ← 글자 호 **하나** r=35 (이름 + 레벨)
//        └────────────────┘
// ```
//
// **아래 호의 글자는 안쪽으로 자란다**(원형 도장의 관례 — 그래야 왼→오른쪽으로 똑바로 읽힌다).
// 그래서 호는 링 바깥으로 **글자 높이만큼** 떨어져 있어야 한다. 호가 하나뿐이라 그 조건도 하나다.
//
// 반지름이 상자 폭의 절반보다 커도 된다 — 호는 눈에 안 보이고, 글자는 아래 한가운데에만 앉는다.
//
// **이 값들은 계산이지 실측이 아니다**(ADR «미검증») — 곡선 한글의 자간·베이스라인은 플랫폼 폰트가
// 정하고 jest 에는 레이아웃이 없다. 실기기에서 어긋나면 여기 숫자를 고친다.

/** 칸 하나의 상자. 글자가 아래로만 자라므로 **세로가 더 길다**. */
export const PORTRAIT_SLOT_W = 68
export const PORTRAIT_SLOT_H = 70
/** 링이 없는 칸(관리 화면, [[ADR-142]] 정정 8) — 글자가 얼굴 쪽으로 들어와 그만큼 낮다. */
export const PORTRAIT_SLOT_H_RINGLESS = 62
/** 원의 중심 — 위로 붙는다(위쪽에 글자가 없다). */
export const PORTRAIT_CENTER_X = PORTRAIT_SLOT_W / 2
export const PORTRAIT_CENTER_Y = 32

/** 칸 사이 간격(px) — 정정 1로 8 → 4(«초상화 간 간격을 좁힌다»). */
export const PORTRAIT_GAP = 4
/**
 * 링이 없는 칸의 간격 — **0**([[ADR-145]] 결정 5, 사용자 지시).
 *
 * 링이 사라져도 칸 폭(68)과 안쪽 여백은 그대로라 이웃 사이가 필요 이상으로 벌어진다. 글자 호
 * (`PORTRAIT_TEXT_R_RINGLESS` = 28)는 칸 가장자리에서 6px 안쪽이라 **간격을 0으로 둬도 이웃 사이에
 * 12px 이 남는다**(링 있는 쪽은 13 + 4 = 17px). 칸 폭을 줄이는 길도 있었지만 그쪽은 원 중심이
 * 움직여 두 화면의 초상화가 다른 그림이 된다(정정 8이 폭을 안 건드린 이유와 같다).
 */
export const PORTRAIT_GAP_RINGLESS = 0

/** 얼굴 원의 지름(px) — [[ADR-015]] 크롭이 기준으로 삼는 상자다. */
export const PORTRAIT_FACE_SIZE = 40

/**
 * 진행 링 **한 겹**. `r` 은 stroke 중심선의 반지름이다.
 *
 * 정정 1로 두 겹이 한 겹이 됐다 — 컨텐츠는 그 한 겹을 **좌·우 반원으로 갈라** 일간·주간을 담고,
 * 보스는 **온전한 원 하나**로 주간만 담는다(월간은 종류가 하나뿐이라 링에서 뺐다).
 */
export const PORTRAIT_RING_R = 26
export const PORTRAIT_RING_STROKE = 3

/**
 * **반원 두 개를 쓸 때만** 양 끝에서 비우는 각도 — 12시·6시에서 둘이 갈라져 보이게 한다.
 *
 * 온전한 원(보스)에는 **안 쓴다**([[ADR-142]] 정정 3, 사용자 지시) — 가를 상대가 없는 링에서 그 틈은
 * «나눔» 이 아니라 «결손» 으로 읽힌다([[ADR-059]] 정정 1이 보스 수익 링에서 같은 판단을 했다).
 */
export const PORTRAIT_RING_GAP_DEG = 5

/**
 * 글자 호 **하나**([[ADR-142]] 정정 2) — 이름과 레벨이 같은 베이스라인에 나란히 앉는다.
 *
 * 둘을 따로 두르면 바깥 줄이 안쪽 줄을 향해 자라 사이를 벌려야 했고, 그만큼 상자가 세로로 커졌다.
 * 한 호에 실으면 그 값이 통째로 사라진다 — 글자 크기만 서로 다르다(레벨이 부가 정보다).
 */
export const PORTRAIT_TEXT_R = 35
/**
 * **레벨과 이름이 같은 글자다**([[ADR-142]] 정정 6, 사용자 지시) — 크기·굵기·색이 전부 같다.
 *
 * 처음에는 레벨을 «부가 정보» 로 보고 작고 흐리게 뒀는데, 요청한 적 없는 차이였고 눈에 띄었다.
 * 이제 둘을 가르는 것은 **자리뿐**이다(가운데 왼쪽 = 레벨 · 오른쪽 = 이름).
 */
export const PORTRAIT_TEXT_FONT_SIZE = 8.5
/**
 * 링이 **없을 때**의 글자 반지름([[ADR-142]] 정정 8) — 얼굴 바로 밖이다.
 *
 * 링 자리를 비운 채 글자를 그대로 두면 얼굴과 글자 사이에 **링 두께만큼 죽은 여백**이 남는다.
 * 관리 화면은 진행률을 안 그리므로 그 자리를 걷어내고 칸도 그만큼 낮춘다.
 */
export const PORTRAIT_TEXT_R_RINGLESS = 28
/** 레벨과 이름 사이에 벌리는 몫(px) — 가운데를 기준으로 좌우 절반씩 나눠 쓴다. */
export const PORTRAIT_TEXT_GAP = 3

/**
 * 글자를 **원 중앙(6시)에 맞춰** 붙이는 오프셋([[ADR-142]] 정정 5, 사용자 지시).
 *
 * 줄 전체를 `startOffset="50%"` + `middle` 로 앉히면 **줄의 한가운데**가 6시에 온다 — 이름이 레벨보다
 * 길어서 그 경계가 왼쪽으로 밀리고, 글자가 통째로 오른쪽으로 치우쳐 보인다. 그래서 가운데에 맞추는
 * 것은 줄이 아니라 **레벨과 이름의 경계**다: 레벨은 6시에서 **끝나고**(`textAnchor="end"`), 이름은
 * 6시에서 **시작한다**(`start"`). 둘을 `PORTRAIT_TEXT_GAP` 만큼만 벌린다.
 *
 * 호는 여전히 **하나**다(정정 2) — 같은 `Path` 를 두 `TextPath` 가 가리킬 뿐이다.
 */
export function portraitTextOffsetPercent(side: 'left' | 'right', radius: number): string {
  const halfArcLength = Math.PI * radius
  const delta = ((PORTRAIT_TEXT_GAP / 2) / halfArcLength) * 100
  return `${(side === 'right' ? 50 + delta : 50 - delta).toFixed(2)}%`
}

/**
 * 칸의 두 갈래([[ADR-142]] 정정 8 · [[ADR-145]] 결정 5) — 링을 그리는 칸(스케줄러)과 안 그리는
 * 칸(관리 화면).
 *
 * 갈리는 것은 **글자 반지름 · 칸 높이 · 칸 사이 간격 셋뿐**이다. 폭·원 중심·얼굴 크기는 같아서 두
 * 화면의 초상화가 같은 그림으로 보인다. 셋을 한 함수가 함께 돌려주므로 «링 없는 칸» 의 정의가
 * 흩어지지 않는다 — 간격만 레일에 손으로 적어 두면 그 값이 조용히 갈린다.
 */
export function portraitMetrics(hasRing: boolean): { textR: number; slotH: number; gap: number } {
  return hasRing
    ? { textR: PORTRAIT_TEXT_R, slotH: PORTRAIT_SLOT_H, gap: PORTRAIT_GAP }
    : { textR: PORTRAIT_TEXT_R_RINGLESS, slotH: PORTRAIT_SLOT_H_RINGLESS, gap: PORTRAIT_GAP_RINGLESS }
}

/** 글자가 베이스라인에서 자라는 높이의 어림값(대문자 높이 ≈ 0.75em) — 여백 검사가 쓴다. */
export const PORTRAIT_CAP_HEIGHT_RATIO = 0.75

/**
 * 글자가 붙는 **아래 반원** 경로 — 왼쪽에서 아래를 지나 오른쪽으로(sweep 0).
 *
 * 왼→오른쪽이라 글자가 뒤집히지 않는다. 오른→왼쪽으로 그리면 글자가 바깥으로 자라는 대신 거울처럼
 * 뒤집혀 읽을 수 없게 된다(그 갈래를 고른 것이 파일 머리의 배치 이유다).
 */
export function portraitTextArcPath(radius: number): string {
  const { x, y } = { x: PORTRAIT_CENTER_X, y: PORTRAIT_CENTER_Y }
  return `M ${x - radius} ${y} A ${radius} ${radius} 0 0 0 ${x + radius} ${y}`
}

/** 12시를 0°로 두고 시계방향을 양수로 재는 좌표 — 링 각도를 사람이 읽는 방향과 맞춘다. */
function pointAt(radius: number, degrees: number): { x: number; y: number } {
  const radians = ((degrees - 90) * Math.PI) / 180
  return {
    x: PORTRAIT_CENTER_X + radius * Math.cos(radians),
    y: PORTRAIT_CENTER_Y + radius * Math.sin(radians),
  }
}

/**
 * 링 호 경로 — `from`·`to` 는 위 좌표계의 각도다(음수면 반시계).
 *
 * 진행률이 0이면 **빈 문자열**을 돌려준다: 길이 0인 호를 `strokeLinecap="round"` 로 그리면 점 하나가
 * 찍혀 «아직 아무것도 안 했다» 가 «조금 했다» 로 보인다.
 */
export function portraitRingArcPath(radius: number, from: number, to: number): string {
  if (Math.abs(to - from) < 0.01) return ''
  const start = pointAt(radius, from)
  const end = pointAt(radius, to)
  const largeArc = Math.abs(to - from) > 180 ? 1 : 0
  const sweep = to > from ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`
}

/** 0~1 로 자른 진행 비율 — `total` 이 0이면 0이다(0/0을 100%로 읽지 않는다). */
export function ringRatio(completed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(completed / total, 0), 1)
}

/**
 * 링 한 칸이 차지하는 각도 구간.
 *
 * `half: 'left'`(일간·반시계) · `'right'`(주간·시계) · `'full'`(온전한 원, **반시계** · 틈 없음).
 * 셋 다 **12시에서 시작**한다 — 시작점이 같아야 두 반원을 나란히 읽을 수 있다.
 *
 * 온전한 원이 반시계인 것과 틈이 없는 것은 [[ADR-142]] 정정 3(사용자 지시)이다.
 */
export function portraitRingSpan(half: 'left' | 'right' | 'full'): { from: number; to: number } {
  if (half === 'full') return { from: 0, to: -360 }
  const gap = PORTRAIT_RING_GAP_DEG
  const sign = half === 'right' ? 1 : -1
  return { from: sign * gap, to: sign * (180 - gap) }
}

/** 한 바퀴는 호로 못 그린다(시작점과 끝점이 같다) — 호출부가 `Circle` 로 갈아탄다. */
export function isFullTurn(span: { from: number; to: number }): boolean {
  return Math.abs(span.to - span.from) >= 360
}
