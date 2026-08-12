// 웹판 열둘 중 **재생을 보는 아홉은 여기 없다.** 그 케이스들(프레임별 origin 정합·8프레임 등장·
// pre→loop 전환·1.5배속 팝인·픽셀 준비 전 좌표 고정)은 전부 프레임 에셋과 재생 엔진을 전제하는데,
// RN 에는 둘 다 아직 없다(`DropEffectOverlay.tsx` 파일 머리 ⓐ·ⓑ) — **step 7 이 그 엔진을 되살릴
// 때 함께 온다.** 지금 흉내 낸 단언을 적어 두면 "검사했다"고 읽히므로 적지 않는다.
//
// 남는 것은 웹의 정정 둘이 다루던 자리와 구조·레이어·닫기 계약이다. 그 정정 둘은 **RN 에 없는
// 문제**라(Radix `dismissable-layer` 가 만든 웹 전용 결함) 케이스도 뒤집힌다 — `pointer-events-auto`
// 와 `data-sheet-keep-open` 대신 **네이티브 윈도우로 뜬다**를 지킨다.
import { fireEvent } from '@testing-library/react-native'

import { DROP_EFFECT_FRAMES } from '@core/lib/drop-effect-frames'
import { screenEffectScale } from '@core/lib/drop-effect-layout'

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

  // 아이템 아이콘도 프레임과 같은 이유로 아직 없다 — 웹에서 매핑 없는 아이템이 타던 분기 그대로다.
  it('중앙 아이템은 아직 그리지 않는다 — 아이콘 에셋 몫', async () => {
    const { queryByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(queryByTestId('drop-effect-item')).toBeNull()
  })

  // 프레임이 없으면 재생할 것이 없다 — 웹도 `frames.end.length === 0` 이면 곧바로 닫는다.
  it('화면을 탭하면 닫힌다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={onClose} />,
    )

    await fireEvent.press(getByTestId('drop-effect-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
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

  // **아직 정적이라는 사실 자체를 계약으로 남긴다** — 에셋이 들어오면 이 단언이 깨지고, 그때
  // 엔진(step 7)이 없으면 그 사실이 드러난다.
  it('프레임 에셋이 아직 없다 — 연출은 정적이다', () => {
    expect(DROP_EFFECT_FRAMES.loop).toHaveLength(0)
    expect(DROP_EFFECT_FRAMES.end).toHaveLength(0)
  })

  it('트리 스냅샷', async () => {
    const { toJSON } = await renderOverlay(
      <DropEffectOverlay itemName="칠흑의 보스 반지 상자" onClose={noop} />,
    )

    expect(toJSON()).toMatchSnapshot()
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
