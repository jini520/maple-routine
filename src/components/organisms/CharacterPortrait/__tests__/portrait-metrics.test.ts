// 치수 표가 지키기로 한 것 하나. **글자와 링이 겹치지 않는다**.
//
// 이 파일이 없으면 값 하나를 조금만 옮겼을 때 겹침이 조용히 생긴다(RN 은 넘친 글자를 에러로 말하지
// 않는다). jest 에 레이아웃이 없어 **실제 글꼴 폭은 못 본다**. 볼 수 있는 것은 반지름들의 관계뿐이고
// 그것이 이 테스트의 상한이다.
import { PAGE_HEADER_TITLE_ROW_MIN_H } from '../../../templates/PageHeader/PageHeaderTitleRow'
import { PORTRAIT_COMPACT, PORTRAIT_HEADER, PORTRAIT_RAIL } from '../portrait-metrics'

const ringOuterEdge = PORTRAIT_RAIL.ringR + PORTRAIT_RAIL.ringStroke / 2
const ringInnerEdge = PORTRAIT_RAIL.ringR - PORTRAIT_RAIL.ringStroke / 2
const textCap = PORTRAIT_RAIL.textFontSize * PORTRAIT_RAIL.capHeightRatio

describe('rail 규격은 겹치지 않는다', () => {
  it('얼굴 원이 링 안에 든다', () => {
    expect(PORTRAIT_RAIL.faceSize / 2).toBeLessThan(ringInnerEdge)
  })

  // 아래 호의 글자는 안쪽으로 자란다. 자란 끝이 링에 닿으면 안 된다. 호가 하나뿐이라 검사할
  // 관계도 하나다. 레벨은 같은 베이스라인에 나란히 앉는다.
  it('글자가 안쪽으로 자라도 링에 안 닿는다', () => {
    expect(PORTRAIT_RAIL.textR - textCap).toBeGreaterThan(ringOuterEdge)
  })

  it('링과 글자가 모두 상자 안에 든다', () => {
    // 위: 링이 상자를 안 넘는다(위쪽에는 글자가 없다).
    expect(PORTRAIT_RAIL.centerY - ringOuterEdge).toBeGreaterThanOrEqual(0)
    // 아래: 글자 베이스라인이 상자 안이다.
    expect(PORTRAIT_RAIL.centerY + PORTRAIT_RAIL.textR).toBeLessThanOrEqual(PORTRAIT_RAIL.slotH)
    // 좌우: 링이 상자를 안 넘는다(호 자체는 넘어도 되지만 링은 보인다).
    expect(ringOuterEdge * 2).toBeLessThanOrEqual(PORTRAIT_RAIL.slotW)
  })

  // 치수를 한 벌로 합쳤으니 **죽은 여백이 돌아온다**. 링을 안 그리는 관리 화면에서
  // 얼굴과 글자 사이가 링 두께만큼 벌어진다. 그것을 감수한 것이 그 결정이므로 여백이 남는다는 사실
  // 자체를 못 박아 둔다.
  it('링을 안 그리는 칸에는 링 두께만큼 빈 자리가 남는다', () => {
    expect(PORTRAIT_RAIL.textR - textCap - PORTRAIT_RAIL.faceSize / 2).toBeGreaterThan(
      PORTRAIT_RAIL.ringStroke,
    )
  })
})

// today 머리의 캐릭터 관리 버튼. 이 규격은 링도 글자도 없어 값이 지름 하나뿐이고, 그 하나가
// **머리 높이를 정한다.**
describe('header 규격은 머리를 안 높인다', () => {
  /** 갱신 시각 줄의 높이. `DataFreshness` 의 `h-4` 다(클래스 문자열이라 값으로는 못 가져온다). */
  const 갱신시각_높이 = 16
  /** 테두리 두께. `CharacterManageButton` 의 `CIRCLE_BORDER_PX` 다. */
  const 테두리 = 2

  // 머리 덩어리는 제목 줄과 갱신 시각 줄을 쌓은 것이고, 곁에 서는 것이 그 합을 넘을 때만 덩어리
  // 높이가 그것을 따라간다. 그러면 today 머리만 높아져 탭을 옮길 때 들썩여 보인다.
  it('원이 머리 덩어리 높이를 안 넘는다', () => {
    expect(PORTRAIT_HEADER.slot).toBeLessThanOrEqual(PAGE_HEADER_TITLE_ROW_MIN_H + 갱신시각_높이)
  })

  // 판별력: 상한만 재면 32 로 되돌아가도 초록이다. 키우라는 지시를 받은 값이라 제목 줄 하나보다
  // 크다는 것을 함께 못박는다.
  it('원이 제목 줄 하나보다는 크다', () => {
    expect(PORTRAIT_HEADER.slot).toBeGreaterThan(PAGE_HEADER_TITLE_ROW_MIN_H)
  })

  // 얼굴이 원을 꽉 채우면 테두리에 딱 붙어 어색하다(사용자 관측). 얼굴을 원보다 작게 두어
  // 그 차이가 안쪽 여백으로 남는다. `PORTRAIT_COMPACT` 가 같은 모양이다(칸 40 · 얼굴 32).
  it('얼굴이 원보다 작아 안쪽에 여백이 남는다', () => {
    expect(PORTRAIT_HEADER.faceSize).toBeLessThan(PORTRAIT_HEADER.slot)
  })

  // 여백이 테두리보다 얇으면 선에 먹혀 안 보인다. 지금은 둘이 같은 2 이고 **그것이 바닥**이다.
  // 테두리를 더 두껍게 하려면 `faceSize` 를 함께 줄여야 한다.
  it('그 여백이 테두리보다 얇지 않다', () => {
    const 여백 = (PORTRAIT_HEADER.slot - PORTRAIT_HEADER.faceSize) / 2

    expect(여백).toBeGreaterThanOrEqual(테두리)
  })

  // 얼굴 크기는 compact 규격과 같은 값이다. 40 짜리 칸에 얼굴을 앉히는 모양이 앱에 하나로 남는다.
  it('compact 규격과 같은 칸·얼굴을 쓴다', () => {
    expect(PORTRAIT_HEADER.slot).toBe(PORTRAIT_COMPACT.slot)
    expect(PORTRAIT_HEADER.faceSize).toBe(PORTRAIT_COMPACT.faceSize)
  })
})

// 링은 얼굴 **바깥**에 여백을 두고 두른다. 슬롯 하나가 얼굴 상자이면서 링이
// 서는 테두리라, 두 값을 따로 적으면 한쪽만 고쳐졌을 때 링이 얼굴을 파고든다.
describe('compact 규격은 링이 얼굴 밖에 선다', () => {
  it('링 안쪽 끝이 얼굴 가장자리보다 바깥이다', () => {
    const 링_안쪽 = (PORTRAIT_COMPACT.slot - PORTRAIT_COMPACT.ringStroke * 2) / 2

    expect(링_안쪽).toBeGreaterThan(PORTRAIT_COMPACT.faceSize / 2)
  })

  // 헤더 높이 64px(12 + 40 + 12)의 재료다. 슬롯이 커지면 헤더가 커진다.
  it('슬롯이 40 이라 아코디언 헤더가 64px 로 선다', () => {
    expect(PORTRAIT_COMPACT.slot).toBe(40)
  })
})
