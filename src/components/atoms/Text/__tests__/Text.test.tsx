// 글자 atom 이 **실제로 배수를 곱해 내보내는가**. 산수는 옆 파일(`font-scaling.test.ts`)이 보고,
// 여기서는 배선만 본다. 계산이 맞아도 atom 이 `className` 의 크기를 못 읽으면 화면은 그대로다.
//
// ## 시스템 배수는 `Dimensions.get('window')` 로 흘려 넣는다
//
// `useWindowDimensions` 는 초기값을 그 호출에서 얻으므로, 그 하나만 목으로 덮으면 **시스템 글자 크기를
// 이렇게 둔 기기** 를 만들 수 있다. atom 이 그 값을 안 읽는다는 것을 보려면 기기 쪽 값이 있어야 한다.
import { act } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { __resetTextScaleForTest, setTextScale } from '../../../../theme/text-scale'
import { Text } from '../Text'

/** 시스템 글자 크기가 `fontScale` 로 설정된 기기. */
function 시스템_글자배수(fontScale: number): void {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale })
}

afterEach(() => {
  jest.restoreAllMocks()
  __resetTextScaleForTest()
})

describe('Text: 시스템 글자 크기를 따르지 않는다', () => {
  it.each([0.823, 1, 3.571])('시스템 배수 %p 에서도 스케일링을 끈다', async (fontScale) => {
    시스템_글자배수(fontScale)
    const { getByText } = await renderAtom(<Text className="text-sm">보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(false)
  })
})

describe('Text: `maxScale` 은 고정 칸의 글자 배수를 제한한다', () => {
  const 넓은화면 = (): void => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 466, height: 678, scale: 3, fontScale: 1 })
  }

  it('지금 배수가 더 크면 `maxScale` 까지만 크기와 줄 높이에 곱한다', async () => {
    넓은화면()
    setTextScale(1.2)
    const { getByText } = await renderAtom(
      <Text className="text-sm" maxScale={1.05}>
        보스
      </Text>,
    )

    const style = flattenStyle(getByText('보스').props.style)
    expect(style.fontSize).toBeCloseTo(14 * 1.05)
    expect(style.lineHeight).toBeCloseTo(20 * 1.05)
  })

  it('지금 배수가 더 작으면 지금 배수를 그대로 쓴다', async () => {
    넓은화면()
    setTextScale(0.9)
    const { getByText } = await renderAtom(
      <Text className="text-sm" maxScale={1.05}>
        보스
      </Text>,
    )

    expect(flattenStyle(getByText('보스').props.style).fontSize).toBeCloseTo(14 * 0.9)
  })
})

describe('Text: 앱 글자 배수를 크기와 줄 높이에 곱한다', () => {
  it('좁은 화면에서는 화면 폭 ÷ 360 까지만 곱한다', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 320, height: 640, scale: 3, fontScale: 1 })
    setTextScale(1.2)
    const { getByText } = await renderAtom(<Text className="text-sm">보스</Text>)

    expect(flattenStyle(getByText('보스').props.style).fontSize).toBeCloseTo((14 * 320) / 360)
  })

  it('className 으로 준 크기와 줄 높이에 곱한다', async () => {
    setTextScale(1.2)
    const { getByText } = await renderAtom(<Text className="text-sm font-semibold">보스</Text>)

    expect(flattenStyle(getByText('보스').props.style)).toMatchObject({
      fontSize: 14 * 1.2,
      lineHeight: 20 * 1.2,
      fontWeight: '600',
    })
  })

  it('style 로 준 크기에도 곱한다', async () => {
    setTextScale(0.9)
    const { getByText } = await renderAtom(<Text style={{ fontSize: 20 }}>73</Text>)

    expect(flattenStyle(getByText('73').props.style).fontSize).toBeCloseTo(18)
  })

  it('크기가 없는 안쪽 글자는 바깥 크기를 물려받도록 비워 둔다', async () => {
    setTextScale(1.2)
    const { getByText } = await renderAtom(
      <Text className="text-sm">
        바깥<Text className="font-bold">안쪽</Text>
      </Text>,
    )

    expect(flattenStyle(getByText('안쪽').props.style)).not.toHaveProperty('fontSize')
  })

  it('단계를 바꾸면 그려진 글자가 새 크기로 다시 그려진다', async () => {
    const { getByText } = await renderAtom(<Text className="text-10">보스</Text>)
    expect(flattenStyle(getByText('보스').props.style).fontSize).toBe(10)

    await act(async () => setTextScale(1.1))

    expect(flattenStyle(getByText('보스').props.style).fontSize).toBeCloseTo(11)
  })
})
