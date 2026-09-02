// 일러스트 bleed 의 **값**을 지킨다. 크롭 기하는 `lib/__tests__/image-crop.test.ts` 로 갈렸다.
//
// 값은 `FadedIllustration.tsx` 안에 있고 **안 내보낸다**(컴포넌트 파일이 값을 내보내면 fast refresh
// 가 깨진다 —). 그래서 상수끼리가 아니라 **그려진 결과**를 본다.
//
// 웹 CSS 와 같은지는 **한 번 확인하고 `docs/foundation/design-system.md` 에 적었다.** 웹 소스가
//  로 없어져 더 갈릴 원본이 없어서, 대조용 CSS 사본을 코드에 두지 않는다. 여기 적힌 수는
// 그 문서에 적힌 값이고, 고치려면 두 곳을 함께 고쳐야 한다.
import { processColor, View } from 'react-native'

import { 기본테마, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { withAlpha } from '../../../../lib/color'
import { IllustratedCard, FadedIllustration } from '../FadedIllustration'

/** 실제 크롭 표에 있는 모양(`daily-quest-region-crops.json`) 하나. */
const CROP = { size: '220% auto', position: '60% 40%' }

// `aria-hidden` 이 붙어 있어 RNTL 기본 질의에서 **빠진다**(접근성 트리에서 숨긴 요소다) —
// 장식이라 그것이 옳고, 그래서 여기서는 숨은 요소까지 훑는다.
const HIDDEN = { includeHiddenElements: true } as const

describe('일러스트를 누르는 값', () => {
  it('채도 .85 · 밝기 .8 · 투명도 .65 로 그린다', async () => {
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    const art = flattenStyle(getByTestId('faded-illustration', HIDDEN).props.style)

    expect(art.opacity).toBe(0.65)
    expect(art.filter).toEqual([{ saturate: 0.85 }, { brightness: 0.8 }])
  })

  // 베일은 웹 마스크를 **뒤집은** 것이다 — 마스크가 1(불투명 검정)인 구간에서 덧칠이 0이어야 한다.
  // 끝점이 자리마다 다르다: 카드 38/76, 히어로 42/82(모달이 넓고 낮아 더 뒤에서 끊는다).
  it.each([
    ['카드', undefined, [0, 0.38, 0.76, 1]],
    ['모달 히어로', 'hero', [0, 0.42, 0.82, 1]],
  ] as const)('%s 베일 정지점', async (_label, variant, expected) => {
    const { getByTestId } = await renderAtom(
      <FadedIllustration source={7} crop={CROP} variant={variant} />,
    )

    expect(getByTestId('faded-illustration-veil', HIDDEN).props.locations).toEqual(expected)
  })

  /**
   * **하드코딩 검정이 아니라는 것이 요점이다.** 덮는 색은 카드 표면색이고 시작은 **같은 색의 알파 0**
   * 이다 — `transparent`(투명 검정)로 두면 네이티브 보간에서 중간이 어두워진다(`PageHeader` 의 경계
   * 페이드와 같은 함정). 렌더 트리의 색은 이미 네이티브 정수라 같은 방식으로 만들어 견준다.
   */
  it('앞 둘이 투명하고 셋째부터 표면색으로 덮인다', async () => {
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    const colors = getByTestId('faded-illustration-veil', HIDDEN).props.colors as number[]
    const 투명 = processColor(withAlpha(기본테마.mediaSurface, 0))
    const 불투명 = processColor(withAlpha(기본테마.mediaSurface, 1))

    expect(colors).toEqual([투명, 투명, 불투명, 불투명])
  })
})

// ── 렌더 ────────────────────────────────────────────────────────────────────────────

describe('FadedIllustration', () => {
  it('그림이 없으면 아무것도 그리지 않는다 — 뷰가 늘지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<FadedIllustration source={null} crop={CROP} />)

    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
    expect(queryByTestId('faded-illustration-veil', HIDDEN)).toBeNull()
  })

  it('그림이 있으면 아트와 베일을 함께 그린다', async () => {
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    expect(getByTestId('faded-illustration', HIDDEN)).toBeTruthy()
    expect(getByTestId('faded-illustration-veil', HIDDEN)).toBeTruthy()
  })

})

describe('IllustratedCard', () => {
  it('카드 토큰 위에서 `bg-surface` 가 카드 기준(`mediaSurface`)으로 풀린다', async () => {
    const { getByTestId } = await renderAtom(
      <>
        <View className="bg-surface" testID="page" />
        <IllustratedCard className="h-20" testID="card">
          <View className="bg-surface" testID="inside" />
        </IllustratedCard>
      </>,
    )

    expect(flattenStyle(getByTestId('page').props.style).backgroundColor).toBe(기본테마.surface)
    expect(flattenStyle(getByTestId('inside').props.style).backgroundColor).toBe(기본테마.mediaSurface)
    // 껍데기 자신도 카드 기준을 쓴다 — 웹에서 `.media-scope` 가 카드 루트에 함께 붙던 자리다.
    expect(flattenStyle(getByTestId('card').props.style).backgroundColor).toBe(기본테마.mediaSurface)
  })

  it('`Card` atom 의 라운딩을 그대로 쓴다 — 카드 토큰을 다시 적지 않았다', async () => {
    const { getByTestId } = await renderAtom(<IllustratedCard testID="card">{null}</IllustratedCard>)

    expect(flattenStyle(getByTestId('card').props.style).borderRadius).toBe(14)
  })
})
