// **재생을 보는 케이스는 이 파일이 아니라 `drop-effect-player.test.ts` 에 있다.** 웹판은 그 로직이
// `useEffect` 클로저 + DOM 변이와 한 덩어리라 단위로 검사할 수 없었는데, RN 으로 옮기며 상태 전이를
// 순수 함수로 떼어내면서 **시간을 인자로 받는 검사**가 가능해졌다(8프레임 등장·pre→loop·end 종료…).
//
// 여기 남는 것은 **렌더가 아니면 못 보는 것들**이다 — 레이어 순서, 가산 합성이 걸린 자리, 닫기 배선.
// 프레임 «그림» 은 여기서 못 본다: jest 의 에셋 대역이 크기를 안 줘서 좌표가 안 잡히고, 그러면
// `frame-layout.ts` 계약대로 아예 안 그린다.
//
// 남는 것은 웹의 정정 둘이 다루던 자리와 구조·레이어·닫기 계약이다. 그 정정 둘은 **RN 에 없는
// 문제**라(Radix `dismissable-layer` 가 만든 웹 전용 결함) 케이스도 뒤집힌다 — `pointer-events-auto`
// 와 `data-sheet-keep-open` 대신 **네이티브 윈도우로 뜬다**를 지킨다.
import { fireEvent } from '@testing-library/react-native'

import { DROP_EFFECT_FRAMES } from '../../../../lib/drop-effect-frames'
import { screenEffectScale } from '../../../../lib/drop-effect-layout'

import { renderOverlay } from '../../../__tests__/render-atom'
import { DropEffectOverlay } from '../DropEffectOverlay'

const noop = (): void => {}

describe('DropEffectOverlay — 구조', () => {
  it('전체 화면 오버레이로 뜬다 — 시트 위에 서는 것을 네이티브 윈도우가 보장한다', async () => {
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    const modal = getByTestId('drop-effect-overlay-modal', { includeHiddenElements: true })
    expect(modal.props.transparent).toBe(true)
    expect(modal.props.statusBarTranslucent).toBe(true)
  })

  it('안내 문구를 보여준다', async () => {
    const { getByText } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(getByText('화면을 터치하면 닫힙니다')).toBeTruthy()
  })

  // 레이어 순서: 배경 → 기둥(2) → 아이템(3) → 버스트(4) → 문구(5).
  it('기둥과 버스트 레이어의 쌓임 순서가 정해져 있다', async () => {
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(getByTestId('drop-effect-pillar').props.style).toMatchObject({ zIndex: 2 })
    expect(getByTestId('drop-effect-screen').props.style).toMatchObject({ zIndex: 4 })
  })

  // ★ 회귀 가드 — **블렌드는 `zIndex` 를 가진 앵커가 져야 한다.**
  //
  // 안쪽(프레임 상자) View 에 걸면 그 `zIndex` 가 만든 스태킹 컨텍스트에 블렌드가 갇혀, 스프라이트의
  // 검은 배경이 **순검정 사각형으로 그대로 보인다**(2026-08-13 실측). 눈으로만 잡히는 종류라 값이
  // 아니라 **어디에 걸렸는지**를 고정한다.
  it('가산 합성은 zIndex 를 가진 앵커에 걸린다 — 안쪽에 걸면 스태킹 컨텍스트에 갇힌다', async () => {
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(getByTestId('drop-effect-pillar').props.style).toMatchObject({ mixBlendMode: 'screen' })
    expect(getByTestId('drop-effect-screen').props.style).toMatchObject({ mixBlendMode: 'screen' })
  })

  // 중앙 아이템은 **엔진이 8프레임 시점에 켠다**([[ADR-103]] 결정 3). 마운트 직후에는 아직 꺼져
  // 있고, 매핑 없는 아이템은 웹과 같은 분기로 영영 안 그려진다.
  it('중앙 아이템은 마운트 직후엔 그리지 않는다 — 엔진이 8프레임에 켠다', async () => {
    const { queryByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(queryByTestId('drop-effect-item')).toBeNull()
  })

  // 탭하면 닫힌다 — **다만 «언제»는 여기서 안 본다.**
  //
  // 엔진이 붙은 뒤로 첫 탭은 `end` 재생을 시작하고 그것이 끝나야 `onClose` 가 온다(웹과 같다).
  // 그 두 단계를 이 렌더 테스트로 재려 했더니 jest 의 `requestAnimationFrame` 이 한 flush 안에서
  // 재생을 통째로 흘려보내 첫 탭에 이미 닫혀 있었다 — **시간을 통제하지 않는 곳에서 시간에 기댄
  // 단언**이라 신뢰할 수 없다. 순서(탭 → end → 끝, 두 번째 탭은 건너뛰기)는 시간을 인자로 받는
  // `drop-effect-player.test.ts` 가 정확히 본다. 여기서는 **닫히기는 하는가**만 남긴다.
  it('화면을 탭하면 닫힌다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={onClose} />,
    )

    await fireEvent.press(getByTestId('drop-effect-overlay'))
    await fireEvent.press(getByTestId('drop-effect-overlay'))

    expect(onClose).toHaveBeenCalled()
  })

  it('안드로이드 뒤로가기도 같은 자리로 이어진다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={onClose} />,
    )

    const modal = getByTestId('drop-effect-overlay-modal', { includeHiddenElements: true })
    ;(modal.props.onRequestClose as () => void)()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('트리 스냅샷', async () => {
    const { toJSON } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(toJSON()).toMatchSnapshot()
  })

  // **엔진이 붙었다.** 다만 이 렌더 테스트가 프레임 그림을 볼 수는 없다 — jest 의 에셋 대역은
  // `{ testUri }` 뿐이라 `Image.resolveAssetSource` 가 크기를 안 준다. 크기를 모르면 아예 안 그리는
  // 것이 `frame-layout.ts` 의 계약이므로(크기 없이 그리면 프레임마다 최대 26px 튄다, [[ADR-048]])
  // 여기서는 **자리와 계약**만 보고, 재생 순서는 `drop-effect-player.test.ts` 가 본다.
  it('프레임 에셋이 네 단계 다 있고, 기둥·ScreenEff 자리가 서 있다', async () => {
    expect(DROP_EFFECT_FRAMES.screen.length).toBeGreaterThan(0)
    expect(DROP_EFFECT_FRAMES.loop.length).toBeGreaterThan(0)
    expect(DROP_EFFECT_FRAMES.end.length).toBeGreaterThan(0)

    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="흑옥의 보스 반지 상자" onClose={noop} />,
    )

    expect(getByTestId('drop-effect-pillar')).toBeTruthy()
    expect(getByTestId('drop-effect-screen')).toBeTruthy()
  })
})

// 배율 계산 자체는 core 에 있고 프레임과 무관하게 산다([[ADR-048]] 결정 5) — 웹판 두 케이스 그대로.
describe('screenEffectScale', () => {
  const REF = { w: 1146, h: 685 }

  it('세로가 긴 뷰포트는 높이 기준으로 덮는다', () => {
    expect(screenEffectScale(390, 844)).toBeCloseTo(844 / REF.h, 3)
  })

  it('가로가 긴 뷰포트는 너비 기준으로 덮는다', () => {
    expect(screenEffectScale(1600, 500)).toBeCloseTo(1600 / REF.w, 3)
  })
})
