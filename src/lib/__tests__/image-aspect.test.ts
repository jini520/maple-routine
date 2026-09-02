// `한 축만 정하고 나머지는 그림이 정한다`의 계약.
//
// **이 테스트가 무엇을 못 하는지부터 적는다.** 렌더해서 **그림이 안 늘어났다** 를 볼 수는 없다.
// jest 프리셋이 `Image` 를 `mockComponent` 로 통째로 갈아 끼워(`@react-native/jest-preset` 의
// `jest/mocks/Image.js`) 실제 구현의 세 겹 스타일 병합이 아예 안 돈다. 이 병이 테스트 693개를
// 초록으로 통과한 이유가 그것이다.
//
// 그래서 묻는 것은 **두 축을 다 이름 불렀는가** 다. 값이 아니라 **키의 존재**를 묻는 이유는
// `toEqual` 이 `{width: undefined}` 와 `{}` 를 **같게 보기 때문**이다. 하필 그 둘의 차이가 이
// 결정의 전부다(전자만 앞 층의 고유 픽셀값을 덮는다).
import { Image } from 'react-native'

import { imageNaturalSize, naturalAspectStyle } from '../image-aspect'

/** 실제 에셋 크기들. 월드 엠블럼 46×50, 안내 이미지 746×274, 보스 초상 778×556. */
function 고유크기(width: number | undefined, height: number | undefined): void {
  jest
    .spyOn(Image, 'resolveAssetSource')
    .mockReturnValue({ uri: 'test', scale: 1, width, height } as never)
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('imageNaturalSize', () => {
  it('번들 에셋의 고유 픽셀 크기를 읽는다', () => {
    고유크기(46, 50)

    expect(imageNaturalSize(7 as never)).toEqual({ width: 46, height: 50 })
  })

  // `resolveImageCropLayout` 이 밟은 자리와 같다. `undefined <= 0` 은 false 라
  // 크기 없는 소스가 가드를 통과하면 `aspectRatio: NaN` 이 나간다. NaN 은 에러가 아니라
  // 레이아웃이 조용히 무너지는 값이다.
  it.each([
    ['둘 다 없음', undefined, undefined],
    ['높이만 없음', 800, undefined],
    ['0', 0, 400],
    ['NaN', Number.NaN, 400],
    ['무한대', 800, Number.POSITIVE_INFINITY],
  ])('크기가 숫자가 아니면(%s) null 이다', (_label, width, height) => {
    고유크기(width, height)

    expect(imageNaturalSize(7 as never)).toBeNull()
  })
})

describe('naturalAspectStyle: 나머지 축은 그림이 정한다', () => {
  it('높이를 주면 폭이 비율로 따라온다 (웹 `h-[17px] w-auto object-contain`)', () => {
    고유크기(46, 50)

    expect(naturalAspectStyle(7 as never, { height: 17 })).toEqual({
      height: 17,
      width: undefined,
      aspectRatio: 46 / 50,
    })
  })

  it('폭을 주면 높이가 비율로 따라온다 (웹 `w-full` + preflight `height: auto`)', () => {
    고유크기(746, 274)

    expect(naturalAspectStyle(7 as never, { width: '100%' })).toEqual({
      width: '100%',
      height: undefined,
      aspectRatio: 746 / 274,
    })
  })

  // **이 저장소에서 가장 조용한 실패다.** 안 적은 축에는 에셋의 고유 픽셀 크기가 남고, 두 축이
  // 다 정해지면 Yoga 가 `aspectRatio` 를 버린다. 에러 없이 그림만 늘어난다.
  it.each([
    ['높이를 준 쪽', { height: 17 } as const, 'width'],
    ['폭을 준 쪽', { width: '100%' } as const, 'height'],
  ])('%s 도 **두 축의 이름이 다 나온다**. 안 적은 축은 고유 크기가 살아남는다', (_label, given, 지운축) => {
    고유크기(778, 556)

    const style = naturalAspectStyle(7 as never, given)

    expect(Object.keys(style).sort()).toEqual(['aspectRatio', 'height', 'width'])
    expect(style[지운축 as 'width' | 'height']).toBeUndefined()
  })

  it('퍼센트 축도 그대로 통과한다. 부모를 재지 않는다', () => {
    고유크기(778, 556)

    expect(naturalAspectStyle(7 as never, { width: '220%' })).toMatchObject({ width: '220%' })
  })

  // 고유 크기를 모르면 **소스에도 크기가 없다**(그것이 `null` 인 이유다). 샐 것이 없으므로
  // 없는 값을 지우겠다고 `undefined` 를 적지 않는다. 그러면 무엇을 막고 있는지가 안 읽힌다.
  it('고유 크기를 모르면 준 축만 돌려준다. 지울 것이 없다', () => {
    고유크기(undefined, undefined)

    const style = naturalAspectStyle(7 as never, { height: 17 })

    expect(style).toEqual({ height: 17 })
    expect(Object.keys(style)).toEqual(['height'])
  })
})
