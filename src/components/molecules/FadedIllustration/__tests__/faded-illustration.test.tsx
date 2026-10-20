// 일러스트 bleed 의 **값**을 지킨다. 크롭 기하는 `lib/__tests__/image-crop.test.ts` 로 갈렸다.
//
// 값은 `FadedIllustration.tsx` 안에 있고 **안 내보낸다**(컴포넌트 파일이 값을 내보내면 fast refresh
// 가 깨진다). 그래서 상수끼리가 아니라 **그려진 결과**를 본다.
//
// 웹 CSS 와 같은지는 **한 번 확인하고 `docs/foundation/design-system.md` 에 적었다.** 웹 소스가
// 없어져 더 갈릴 원본이 없어서, 대조용 CSS 사본을 코드에 두지 않는다. 여기 적힌 수는
// 그 문서에 적힌 값이고, 고치려면 두 곳을 함께 고쳐야 한다.
import { processColor, View } from 'react-native'

import { 기본테마, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { withAlpha } from '../../../../lib/color'
import { IllustratedCard, FadedIllustration } from '../FadedIllustration'

/** 실제 크롭 표에 있는 모양(`daily-quest-region-crops.json`) 하나. */
const CROP = { size: '220% auto', position: '60% 40%' }

// `aria-hidden` 이 붙어 있어 RNTL 기본 질의에서 **빠진다**(접근성 트리에서 숨긴 요소다).
// 장식이라 그것이 옳고, 그래서 여기서는 숨은 요소까지 훑는다.
const HIDDEN = { includeHiddenElements: true } as const

describe('일러스트를 누르는 값', () => {
  /**
   * **하드코딩 검정이 아니라는 것이 요점이다.** 덮는 색은 카드 표면색이고 시작은 **같은 색의 알파 0**
   * 이다. `transparent`(투명 검정)로 두면 네이티브 보간에서 중간이 어두워진다(`PageHeader` 의 경계
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

// 렌더

describe('FadedIllustration', () => {
  it('그림이 없으면 아무것도 그리지 않는다. 뷰가 늘지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<FadedIllustration source={null} crop={CROP} />)

    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
    expect(queryByTestId('faded-illustration-veil', HIDDEN)).toBeNull()
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
// 껍데기 자신도 카드 기준을 쓴다. 스코프가 카드 루트에 함께 붙는 자리다.
    expect(flattenStyle(getByTestId('card').props.style).backgroundColor).toBe(기본테마.mediaSurface)
  })
})
