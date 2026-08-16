// 기하 표가 지키기로 한 것 하나 — **글자와 링이 겹치지 않는다**([[ADR-142]] 결정 2 · 정정 1).
//
// 이 파일이 없으면 값 하나를 "조금만" 옮겼을 때 겹침이 조용히 생긴다(RN 은 넘친 글자를 에러로
// 말하지 않는다). jest 에 레이아웃이 없어 **실제 글꼴 폭은 못 본다** — 볼 수 있는 것은 반지름들의
// 관계뿐이고, 그것이 이 테스트의 상한이다.
import {
  PORTRAIT_CAP_HEIGHT_RATIO,
  PORTRAIT_CENTER_Y,
  PORTRAIT_FACE_SIZE,
  PORTRAIT_TEXT_FONT_SIZE,
  PORTRAIT_RING_GAP_DEG,
  PORTRAIT_RING_R,
  PORTRAIT_RING_STROKE,
  PORTRAIT_SLOT_H,
  PORTRAIT_SLOT_W,
  PORTRAIT_TEXT_R,
  isFullTurn,
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
