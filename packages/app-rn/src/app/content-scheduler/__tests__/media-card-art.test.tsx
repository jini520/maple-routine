// 일러스트 bleed 의 **기하와 값**을 지킨다.
//
// 웹에는 이 테스트의 짝이 없다 — 거기서는 크롭 값이 CSS 로 그대로 흘러가 브라우저가 해석했고,
// 검사할 변환이 존재하지 않았다. RN 에서는 우리가 그 해석을 대신하므로 **틀려도 에러가 안 나고
// 그림만 이상하게 잘린다.** 정확히 그 종류의 실패라 계약을 코드로 못 박는다.
//
// 값(필터·마스크·투명도)은 **core 의 상수에서 읽어 대조한다** — 여기 손으로 적으면 두 벌이 되고,
// 웹이 값을 바꿔도 이 테스트는 조용히 통과한다(`render-atom.tsx` 의 색 규칙과 같은 이유).
import { MEDIA_ART_FILTER, MEDIA_ART_MASK_CARD, MEDIA_ART_OPACITY } from '@core/lib/media-card'
import { processColor, View } from 'react-native'

import { 기본테마, flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { withAlpha } from '../../../lib/color-alpha'
import { MediaCard, MediaCardArt } from '../MediaCardArt'
import {
  MEDIA_ART_FILTER_STYLE,
  MEDIA_ART_VEIL_ALPHAS,
  MEDIA_ART_VEIL_LOCATIONS,
  mediaArtImageStyle,
  resolveMediaArtLayout,
} from '../media-card-art'

/** 실제 크롭 표에 있는 모양(`daily-quest-region-crops.json`) 하나. */
const CROP = { size: '220% auto', position: '60% 40%' }
const NATURAL = { width: 800, height: 400 }

describe('resolveMediaArtLayout — CSS 배경 크롭 → RN 배치', () => {
  it('`N% auto` 는 부모 폭 기준 폭 + 고유 종횡비가 된다', () => {
    const layout = resolveMediaArtLayout(CROP, NATURAL)

    expect(layout).toEqual({
      kind: 'sized',
      width: '220%',
      aspectRatio: 2,
      left: '60%',
      top: '40%',
      translateX: '-60%',
      translateY: '-40%',
    })
  })

  // CSS `background-position` 의 퍼센트는 **두 기준의 뺄셈**이다(부모 − 자기). 한쪽만 옮기면
  // 그림이 통째로 밀려 나가므로, 두 값이 부호만 다른 짝이라는 것이 계약이다.
  it('position 퍼센트는 부모 기준 오프셋과 자기 기준 역이동의 짝이다', () => {
    const layout = resolveMediaArtLayout({ size: '150% auto', position: '0% 100%' }, NATURAL)

    // `-0` 은 문자열이 되며 부호를 잃는다(`${-0}%` → `'0%'`) — 0 은 뺄 것이 없어 결과가 같다.
    expect(layout).toMatchObject({ left: '0%', translateX: '0%', top: '100%', translateY: '-100%' })
  })

  it('100% 를 넘는 position 도 그대로 통과한다 — 크롭 표에 실제로 있다', () => {
    expect(resolveMediaArtLayout({ size: '170% auto', position: '110% 100%' }, NATURAL)).toMatchObject({
      left: '110%',
      translateX: '-110%',
    })
  })

  it('고유 크기를 모르면 cover 로 떨어진다 — 그림을 안 그리는 것이 아니다', () => {
    expect(resolveMediaArtLayout(CROP, null)).toEqual({ kind: 'cover' })
    expect(resolveMediaArtLayout(CROP, { width: 0, height: 0 })).toEqual({ kind: 'cover' })
  })

  it('`cover`/`center` 기본 크롭도 cover 다', () => {
    expect(resolveMediaArtLayout({ size: 'cover', position: 'center' }, NATURAL)).toEqual({ kind: 'cover' })
  })
})

describe('mediaArtImageStyle', () => {
  it('cover 는 상자를 꽉 채운다', () => {
    expect(mediaArtImageStyle({ kind: 'cover' })).toEqual({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
  })

  it('sized 는 퍼센트 배치 + 역이동 transform 이다', () => {
    expect(mediaArtImageStyle(resolveMediaArtLayout(CROP, NATURAL))).toEqual({
      position: 'absolute',
      width: '220%',
      aspectRatio: 2,
      left: '60%',
      top: '40%',
      transform: [{ translateX: '-60%' }, { translateY: '-40%' }],
    })
  })
})

// ── 값이 웹과 같은가 ────────────────────────────────────────────────────────────────

describe('core 의 bleed 값과 대조', () => {
  it('필터는 웹의 `saturate(.85) brightness(.8)` 과 같은 값이다', () => {
    const parsed = [...MEDIA_ART_FILTER.matchAll(/(\w+)\(([\d.]+)\)/g)].map(([, name, value]) => ({
      [name]: Number(value),
    }))

    expect([...MEDIA_ART_FILTER_STYLE]).toEqual(parsed)
  })

  // 베일은 마스크를 **뒤집은** 것이다 — 마스크가 1(불투명 검정)인 구간에서 덧칠이 0이어야 한다.
  it('베일 정지점은 웹 마스크의 정지점을 뒤집은 것이다', () => {
    const stops = [...MEDIA_ART_MASK_CARD.matchAll(/(\d+)%/g)].map(([, value]) => Number(value) / 100)

    // 웹 마스크: #000 0% · #000 38% · transparent 76% → 알파 1, 1, 0
    expect(stops).toEqual([0, 0.38, 0.76])
    expect(MEDIA_ART_VEIL_LOCATIONS.slice(0, 3)).toEqual(stops)
    expect(MEDIA_ART_VEIL_ALPHAS.slice(0, 3)).toEqual([0, 0, 1])
    // 마지막 한 쌍은 웹에 없다 — CSS 마스크는 끝 값을 유지하지만 네이티브 그라데이션은 보간만 한다.
    expect(MEDIA_ART_VEIL_LOCATIONS[3]).toBe(1)
    expect(MEDIA_ART_VEIL_ALPHAS[3]).toBe(1)
  })
})

// ── 렌더 ────────────────────────────────────────────────────────────────────────────

// `aria-hidden` 이 붙어 있어 RNTL 기본 질의에서 **빠진다**(접근성 트리에서 숨긴 요소다) —
// 장식이라 그것이 옳고, 그래서 여기서는 숨은 요소까지 훑는다.
const HIDDEN = { includeHiddenElements: true } as const

describe('MediaCardArt', () => {
  it('그림이 없으면 아무것도 그리지 않는다 — 뷰가 늘지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<MediaCardArt source={null} crop={CROP} />)

    expect(queryByTestId('media-card-art', HIDDEN)).toBeNull()
    expect(queryByTestId('media-card-art-veil', HIDDEN)).toBeNull()
  })

  it('그림이 있으면 아트와 베일을 함께 그리고, 색 처리는 감싸는 뷰가 진다', async () => {
    const { getByTestId } = await renderAtom(<MediaCardArt source={7} crop={CROP} />)

    const art = flattenStyle(getByTestId('media-card-art', HIDDEN).props.style)
    expect(art.opacity).toBe(MEDIA_ART_OPACITY)
    expect(art.filter).toEqual([...MEDIA_ART_FILTER_STYLE])
    expect(getByTestId('media-card-art-veil', HIDDEN)).toBeTruthy()
  })

  // **하드코딩 검정이 아니라는 것이 요점이다.** 끝 색은 카드 표면색이고 시작은 **같은 색의 알파
  // 0** 이다 — `transparent`(투명 검정)로 두면 네이티브 보간에서 중간이 어두워진다(`PageHeader`
  // 의 경계 페이드와 같은 함정). 렌더 트리의 색은 이미 네이티브 정수라 같은 방식으로 만들어 견준다.
  it('베일은 카드 표면색의 알파 0 → 1 램프다', async () => {
    const { getByTestId } = await renderAtom(<MediaCardArt source={7} crop={CROP} />)

    const colors = getByTestId('media-card-art-veil', HIDDEN).props.colors as number[]

    expect(colors).toHaveLength(4)
    expect(colors[3]).toBe(processColor(withAlpha(기본테마.mediaSurface, 1)))
    expect(colors[0]).toBe(processColor(withAlpha(기본테마.mediaSurface, 0)))
  })
})

describe('MediaCard', () => {
  it('카드 토큰 위에서 `bg-surface` 가 카드 기준(`mediaSurface`)으로 풀린다', async () => {
    const { getByTestId } = await renderAtom(
      <>
        <View className="bg-surface" testID="page" />
        <MediaCard className="h-20" testID="card">
          <View className="bg-surface" testID="inside" />
        </MediaCard>
      </>,
    )

    expect(flattenStyle(getByTestId('page').props.style).backgroundColor).toBe(기본테마.surface)
    expect(flattenStyle(getByTestId('inside').props.style).backgroundColor).toBe(기본테마.mediaSurface)
    // 껍데기 자신도 카드 기준을 쓴다 — 웹에서 `.media-scope` 가 카드 루트에 함께 붙던 자리다.
    expect(flattenStyle(getByTestId('card').props.style).backgroundColor).toBe(기본테마.mediaSurface)
  })

  it('`Card` atom 의 라운딩을 그대로 쓴다 — 카드 토큰을 다시 적지 않았다', async () => {
    const { getByTestId } = await renderAtom(<MediaCard testID="card">{null}</MediaCard>)

    expect(flattenStyle(getByTestId('card').props.style).borderRadius).toBe(14)
  })
})
