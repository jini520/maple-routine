// 진입 화면 셸의 하단. 판정은 `ScreenScroll` 과 같은 `bottom-inset.ts` 가 하고, 여기서는 그 값이 어느 프롭으로
// 나가는지를 본다.
//
// 안드로이드 3버튼 내비게이션 바는 투명하다. 스크롤 상자가 그 뒤까지 내려가 있으면 로그인 화면을 굴릴 때 글자가
// 버튼 사이로 비친다(#983). 버튼 줄이 있는 화면은 불투명한 버튼 줄이 그 자리를 덮으므로 상자를 올리지 않는다.
import { Platform, Text } from 'react-native'
import type { Metrics } from 'react-native-safe-area-context'

import { flattenStyle, renderOverlay, 테스트_안전영역 } from '../../../__tests__/render-atom'
import { EntryScroll } from '../EntryScroll'

const 원래플랫폼 = Platform.OS

function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
}

afterEach(() => {
  setPlatform(원래플랫폼)
})

/** 하단 인셋만 바꾼 안드로이드 기기. 3버튼은 48, 제스처는 15 안팎이다. */
function 안드로이드(insetBottomPx: number): Metrics {
  return {
    frame: 테스트_안전영역.frame,
    insets: { top: 24, left: 0, right: 0, bottom: insetBottomPx },
  }
}

/** 안드로이드 안전영역의 하한. `useBottomSafeAreaPx` 가 인셋보다 작게 주지 않는다. */
const 안드로이드_하한 = 34

const 본문 = <Text>본문</Text>

describe('버튼 줄이 없는 진입 화면(로그인)', () => {
  it('안드로이드 3버튼이면 스크롤 상자가 내비게이션 바 위에서 끝난다', async () => {
    setPlatform('android')
    const { getByTestId } = await renderOverlay(<EntryScroll>{본문}</EntryScroll>, 안드로이드(48))

    const scroller = getByTestId('entry-scroll')
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(48)
    // 하한(34)보다 인셋이 커서 콘텐츠 끝에 더 남길 것이 없다.
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(0)
  })

  // 하한이 더한 몫은 인셋이 아니라 여백이라 콘텐츠가 지나가도 된다. 그것까지 상자에서 빼면 제스처 기기 바닥의 띠가 커진다.
  it('안드로이드 제스처면 인셋만 상자에서 빼고 하한과의 차이는 콘텐츠 끝에 남긴다', async () => {
    setPlatform('android')
    const { getByTestId } = await renderOverlay(<EntryScroll>{본문}</EntryScroll>, 안드로이드(15))

    const scroller = getByTestId('entry-scroll')
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(15)
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(안드로이드_하한 - 15)
  })

  // 아이폰 인셋은 홈 인디케이터뿐이라 콘텐츠가 그 위를 지나가도 된다.
  it('iOS 는 상자를 올리지 않고 안전영역을 콘텐츠 끝에 남긴다', async () => {
    const { getByTestId } = await renderOverlay(<EntryScroll>{본문}</EntryScroll>)

    const scroller = getByTestId('entry-scroll')
    expect(flattenStyle(scroller.props.style).marginBottom).toBe(0)
    expect(flattenStyle(scroller.props.contentContainerStyle).paddingBottom).toBe(
      테스트_안전영역.insets.bottom,
    )
  })
})

describe('버튼 줄이 있는 진입 화면(캐릭터 설정 · MVP 등급)', () => {
  // 불투명한 버튼 줄이 내비게이션 바까지 덮는다. 상자를 올리면 버튼 줄 뒤로 지나가던 콘텐츠가 그만큼 일찍 잘린다.
  it('안드로이드 3버튼이어도 상자를 올리지 않는다. 콘텐츠는 버튼 줄 뒤로만 지나간다', async () => {
    setPlatform('android')
    const { getByTestId } = await renderOverlay(
      <EntryScroll footer={<Text>계속하기</Text>}>{본문}</EntryScroll>,
      안드로이드(48),
    )

    expect(flattenStyle(getByTestId('entry-scroll').props.style).marginBottom).toBe(0)
    expect(flattenStyle(getByTestId('entry-action-bar').props.style).paddingBottom).toBe(48 + 12)
  })
})
