// 기하 표가 지키기로 한 것 하나 — **글자와 링이 겹치지 않는다**([[ADR-142]] 결정 2 · 정정 1).
//
// 이 파일이 없으면 값 하나를 "조금만" 옮겼을 때 겹침이 조용히 생긴다(RN 은 넘친 글자를 에러로
// 말하지 않는다). jest 에 레이아웃이 없어 **실제 글꼴 폭은 못 본다** — 볼 수 있는 것은 반지름들의
// 관계뿐이고, 그것이 이 테스트의 상한이다.
import {
  PORTRAIT_CAP_HEIGHT_RATIO,
  PORTRAIT_CENTER_Y,
  PORTRAIT_FACE_SIZE,
  PORTRAIT_GAP,
  PORTRAIT_TEXT_FONT_SIZE,
  PORTRAIT_RING_GAP_DEG,
  PORTRAIT_RING_R,
  PORTRAIT_RING_STROKE,
  PORTRAIT_SLOT_H,
  PORTRAIT_SLOT_W,
  PORTRAIT_TEXT_R,
  isFullTurn,
  portraitMetrics,
  portraitRingArcPath,
  portraitRingSpan,
  portraitTextArcPath,
  ringRatio,
} from '../character-portrait-geometry'

const ringOuterEdge = PORTRAIT_RING_R + PORTRAIT_RING_STROKE / 2
const ringInnerEdge = PORTRAIT_RING_R - PORTRAIT_RING_STROKE / 2
const textCap = PORTRAIT_TEXT_FONT_SIZE * PORTRAIT_CAP_HEIGHT_RATIO

describe('겹침 금지', () => {
  it('얼굴 원이 링 안에 든다', () => {
    expect(PORTRAIT_FACE_SIZE / 2).toBeLessThan(ringInnerEdge)
  })

  // 아래 호의 글자는 **안쪽으로** 자란다 — 자란 끝이 링에 닿으면 안 된다. 정정 2로 호가 하나뿐이라
  // 검사할 관계도 하나다(레벨은 같은 베이스라인에 나란히 앉는다).
  it('글자가 안쪽으로 자라도 링에 안 닿는다', () => {
    expect(PORTRAIT_TEXT_R - textCap).toBeGreaterThan(ringOuterEdge)
  })

  it('링과 글자가 모두 상자 안에 든다', () => {
    // 위: 링이 상자를 안 넘는다(위쪽에는 글자가 없다).
    expect(PORTRAIT_CENTER_Y - ringOuterEdge).toBeGreaterThanOrEqual(0)
    // 아래: 글자 베이스라인이 상자 안이다.
    expect(PORTRAIT_CENTER_Y + PORTRAIT_TEXT_R).toBeLessThanOrEqual(PORTRAIT_SLOT_H)
    // 좌우: 링이 상자를 안 넘는다(호 자체는 넘어도 되지만 링은 보인다).
    expect(ringOuterEdge * 2).toBeLessThanOrEqual(PORTRAIT_SLOT_W)
  })
})

// [[ADR-161]] 결정 1 — **두 갈래가 없어졌다.** 정정 전에는 링이 없는 칸(관리 화면)이 글자 반지름 ·
// 칸 높이 · 칸 간격 셋을 따로 썼는데([[ADR-142]] 정정 8 · [[ADR-145]] 결정 5), 그 탓에 화면을 옮길
// 때 같은 캐릭터의 초상화가 커졌다 작아졌다 했다. 이제 **링은 자리만 잡고**(사용자 판정 —
// *"링의 레이아웃은 잡지만 색깔을 채우지 마"*) 치수는 한 벌이다.
describe('칸 치수는 한 벌이다 ([[ADR-161]] 결정 1)', () => {
  // 시그니처에 인자가 없는 것 자체가 계약이다 — `portraitMetrics(hasRing)` 를 남겨 두면 «링 유무로
  // 갈릴 수 있다» 가 타입에 남고, 다음 사람이 그 자리에 값을 다시 넣는다.
  it('한 벌뿐이고, 그 값은 링 있는 쪽 기준이다', () => {
    expect(portraitMetrics()).toEqual({
      textR: PORTRAIT_TEXT_R,
      slotH: PORTRAIT_SLOT_H,
      gap: PORTRAIT_GAP,
    })
  })

  // 치수를 합쳤으니 **죽은 여백이 돌아온다** — 얼굴과 글자 사이가 링 두께만큼 벌어진다. 그것을
  // 감수한 것이 이 결정이므로(대가 절), 여백이 «남는다» 는 사실 자체를 못 박아 둔다.
  it('링을 안 그리는 칸에는 링 두께만큼 빈 자리가 남는다', () => {
    const 얼굴_가장자리 = PORTRAIT_FACE_SIZE / 2
    const 글자_안쪽 = portraitMetrics().textR - PORTRAIT_TEXT_FONT_SIZE * PORTRAIT_CAP_HEIGHT_RATIO

    expect(글자_안쪽 - 얼굴_가장자리).toBeGreaterThan(PORTRAIT_RING_STROKE)
  })
})

describe('글자 호', () => {
  it('아래 반원을 왼쪽에서 오른쪽으로 그린다(sweep 0)', () => {
    expect(portraitTextArcPath(30)).toBe('M 4 32 A 30 30 0 0 0 64 32')
  })
})

describe('링 구간', () => {
  // 정정 1: 컨텐츠는 좌·우 반원(일간·주간), 보스는 온전한 원(주간)이다. 셋 다 12시에서 시작한다.
  it('좌·우 반원이 12시에서 갈라져 서로 반대로 돈다', () => {
    expect(portraitRingSpan('left')).toEqual({ from: -PORTRAIT_RING_GAP_DEG, to: -(180 - PORTRAIT_RING_GAP_DEG) })
    expect(portraitRingSpan('right')).toEqual({ from: PORTRAIT_RING_GAP_DEG, to: 180 - PORTRAIT_RING_GAP_DEG })
  })

  // 정정 3(사용자 지시): 온전한 원은 **반시계**로 돌고 **12시에 틈이 없다** — 가를 상대가 없는
  // 링에서 틈은 «나눔» 이 아니라 «결손» 으로 읽힌다.
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
    expect(portraitRingArcPath(26, 5, 100)).toContain(' 0 0 1 ')
    expect(portraitRingArcPath(26, 5, 355)).toContain(' 0 1 1 ')
  })

  it('반시계(왼쪽 반원)는 sweep 0 이다', () => {
    expect(portraitRingArcPath(26, -5, -175)).toContain(' 0 0 0 ')
  })

  // 길이 0인 호를 그리면 `strokeLinecap="round"` 가 점 하나를 찍어 «조금 했다» 로 보인다.
  it('길이가 0이면 경로를 아예 안 만든다', () => {
    expect(portraitRingArcPath(26, 5, 5)).toBe('')
  })
})

describe('진행 비율', () => {
  it('절반은 0.5 다', () => {
    expect(ringRatio(1, 2)).toBe(0.5)
  })

  // 0/0을 100%로 읽으면 «아직 아무것도 없는» 캐릭터가 다 찬 것처럼 보인다.
  it('셀 것이 없으면 0 이다', () => {
    expect(ringRatio(0, 0)).toBe(0)
  })

  it('넘치거나 음수여도 0~1 로 잘린다', () => {
    expect(ringRatio(5, 2)).toBe(1)
    expect(ringRatio(-1, 2)).toBe(0)
  })
})
