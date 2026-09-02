// 일러스트 bleed 의 **값**을 지킨다. 크롭 기하는 `lib/__tests__/image-crop.test.ts` 로 갈렸다.
//
// 값(필터·마스크·투명도)은 **core 의 상수에서 읽어 대조한다** — 여기 손으로 적으면 두 벌이 되고,
// 웹이 값을 바꿔도 이 테스트는 조용히 통과한다(`render-atom.tsx` 의 색 규칙과 같은 이유).
//
// RN 쪽 값은 `FadedIllustration.tsx` 안에 있고 **안 내보낸다**(컴포넌트 파일이 값을 내보내면 fast
// refresh 가 깨진다 — [[ADR-198]] 결정 3). 그래서 상수끼리가 아니라 **그려진 결과**와 견준다.
import {
  ILLUSTRATION_FILTER,
  ILLUSTRATION_MASK_CARD,
  ILLUSTRATION_MASK_HERO,
  ILLUSTRATION_OPACITY,
} from '../../../../constants/style/illustration-card'
import { processColor, View } from 'react-native'

import { 기본테마, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { withAlpha } from '../../../../lib/color'
import { IllustratedCard, FadedIllustration } from '../FadedIllustration'

/** 실제 크롭 표에 있는 모양(`daily-quest-region-crops.json`) 하나. */
const CROP = { size: '220% auto', position: '60% 40%' }

// `aria-hidden` 이 붙어 있어 RNTL 기본 질의에서 **빠진다**(접근성 트리에서 숨긴 요소다) —
// 장식이라 그것이 옳고, 그래서 여기서는 숨은 요소까지 훑는다.
const HIDDEN = { includeHiddenElements: true } as const

/** 웹 마스크 문자열에서 정지점을 뽑는다. `#000 0% · #000 N% · transparent M%` 세 개다. */
function maskStops(mask: string): number[] {
  return [...mask.matchAll(/(\d+)%/g)].map(([, value]) => Number(value) / 100)
}

// ── 값이 웹과 같은가 ────────────────────────────────────────────────────────────────

describe('core 의 bleed 값과 대조', () => {
  it('필터는 웹의 `saturate(.85) brightness(.8)` 과 같은 값이다', async () => {
    const parsed = [...ILLUSTRATION_FILTER.matchAll(/(\w+)\(([\d.]+)\)/g)].map(([, name, value]) => ({
      [name]: Number(value),
    }))
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    expect(flattenStyle(getByTestId('faded-illustration', HIDDEN).props.style).filter).toEqual(parsed)
  })

  // 베일은 마스크를 **뒤집은** 것이다 — 마스크가 1(불투명 검정)인 구간에서 덧칠이 0이어야 한다.
  // 두 자리(카드·모달 히어로)가 **끝점만 다르다** — 같은 값을 쓰면 히어로에서 그림이 일찍 끊긴다.
  it.each([
    ['카드', ILLUSTRATION_MASK_CARD, undefined, [0, 0.38, 0.76]],
    ['모달 히어로', ILLUSTRATION_MASK_HERO, 'hero', [0, 0.42, 0.82]],
  ] as const)(
    '%s 베일 정지점은 웹 마스크의 정지점을 뒤집은 것이다',
    async (_label, mask, variant, expected) => {
      const stops = maskStops(mask)
      const { getByTestId } = await renderAtom(
        <FadedIllustration source={7} crop={CROP} variant={variant} />,
      )
      const veil = getByTestId('faded-illustration-veil', HIDDEN)
      const locations = veil.props.locations as number[]
      const colors = veil.props.colors as number[]

      expect(stops).toEqual(expected)
      expect(locations.slice(0, 3)).toEqual(stops)
      // 마스크 알파 1 인 구간이 덧칠 0 이다 — 앞의 둘이 투명, 셋째부터 불투명.
      expect(colors.slice(0, 3)).toEqual([
        processColor(withAlpha(기본테마.mediaSurface, 0)),
        processColor(withAlpha(기본테마.mediaSurface, 0)),
        processColor(withAlpha(기본테마.mediaSurface, 1)),
      ])
      // 마지막 한 쌍은 웹에 없다 — CSS 마스크는 끝 값을 유지하지만 네이티브 그라데이션은 보간만 한다.
      expect(locations[3]).toBe(1)
      expect(colors[3]).toBe(processColor(withAlpha(기본테마.mediaSurface, 1)))
    },
  )

  it('두 정지점이 실제로 다르다 — 한 벌로 합치면 히어로가 카드 끝점을 쓴다', () => {
    expect(maskStops(ILLUSTRATION_MASK_HERO)).not.toEqual(maskStops(ILLUSTRATION_MASK_CARD))
  })
})

// ── 렌더 ────────────────────────────────────────────────────────────────────────────

describe('FadedIllustration', () => {
  it('그림이 없으면 아무것도 그리지 않는다 — 뷰가 늘지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<FadedIllustration source={null} crop={CROP} />)

    expect(queryByTestId('faded-illustration', HIDDEN)).toBeNull()
    expect(queryByTestId('faded-illustration-veil', HIDDEN)).toBeNull()
  })

  it('그림이 있으면 아트와 베일을 함께 그리고, 색 처리는 감싸는 뷰가 진다', async () => {
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    const art = flattenStyle(getByTestId('faded-illustration', HIDDEN).props.style)
    expect(art.opacity).toBe(ILLUSTRATION_OPACITY)
    expect(getByTestId('faded-illustration-veil', HIDDEN)).toBeTruthy()
  })

  // **하드코딩 검정이 아니라는 것이 요점이다.** 끝 색은 카드 표면색이고 시작은 **같은 색의 알파
  // 0** 이다 — `transparent`(투명 검정)로 두면 네이티브 보간에서 중간이 어두워진다(`PageHeader`
  // 의 경계 페이드와 같은 함정). 렌더 트리의 색은 이미 네이티브 정수라 같은 방식으로 만들어 견준다.
  it('베일은 카드 표면색의 알파 0 → 1 램프다', async () => {
    const { getByTestId } = await renderAtom(<FadedIllustration source={7} crop={CROP} />)

    const colors = getByTestId('faded-illustration-veil', HIDDEN).props.colors as number[]

    expect(colors).toHaveLength(4)
    expect(colors[3]).toBe(processColor(withAlpha(기본테마.mediaSurface, 1)))
    expect(colors[0]).toBe(processColor(withAlpha(기본테마.mediaSurface, 0)))
  })

  // 두 정지점이 각각 웹 마스크와 맞는지는 위 대조가 본다. 여기서는 **기본이 카드**라는 것만 본다.
  it('variant 를 안 주면 카드 정지점이다', async () => {
    const 카드 = await renderAtom(<FadedIllustration source={7} crop={CROP} />)
    const 히어로 = await renderAtom(<FadedIllustration source={7} crop={CROP} variant="hero" />)

    expect(카드.getByTestId('faded-illustration-veil', HIDDEN).props.locations).not.toEqual(
      히어로.getByTestId('faded-illustration-veil', HIDDEN).props.locations,
    )
    expect(카드.getByTestId('faded-illustration-veil', HIDDEN).props.locations).toEqual(
      [...maskStops(ILLUSTRATION_MASK_CARD), 1],
    )
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
