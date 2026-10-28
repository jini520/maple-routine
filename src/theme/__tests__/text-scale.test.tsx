// 글자 크기 페이지가 고른 배수를 페이지 안에서만 보여 주는 자리.
import { Dimensions } from 'react-native'

import { flattenStyle, renderAtom } from '../../components/__tests__/render-atom'
import { Text } from '../../components/atoms'
import { TEXT_REFERENCE_WIDTH } from '../../lib/text-size'
import { TextScaleScope, __resetTextScaleForTest, setTextScale } from '../text-scale'

/** 화면 폭. 넓으면 상한이 걸리지 않는다. */
function useWidth(width: number): void {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 844, scale: 3, fontScale: 1 })
}

async function renderPair(scale: number): Promise<{ outside: number; inside: number }> {
  const view = await renderAtom(
    <>
      <Text testID="outside" className="text-sm">바깥</Text>
      <TextScaleScope scale={scale}>
        <Text testID="inside" className="text-sm">안쪽</Text>
      </TextScaleScope>
    </>,
  )
  const sizeOf = (testID: string): number => flattenStyle(view.getByTestId(testID).props.style).fontSize as number
  return { outside: sizeOf('outside'), inside: sizeOf('inside') }
}

beforeEach(() => {
  __resetTextScaleForTest()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('TextScaleScope', () => {
  it('안쪽 글자만 준 배수를 받고 바깥은 지금 배수 그대로다', async () => {
    useWidth(TEXT_REFERENCE_WIDTH * 2)

    const { outside, inside } = await renderPair(1.2)

    expect(inside).toBeCloseTo(outside * 1.2)
  })

  it('지금 배수가 달라도 안쪽은 준 배수를 지킨다', async () => {
    useWidth(TEXT_REFERENCE_WIDTH * 2)
    setTextScale(0.9)

    const { outside, inside } = await renderPair(1)

    expect(outside).toBeCloseTo(inside * 0.9)
  })

  it('좁은 화면의 상한은 안쪽에도 걸린다', async () => {
    useWidth(TEXT_REFERENCE_WIDTH)

    const { outside, inside } = await renderPair(1.2)

    expect(inside).toBeCloseTo(outside)
  })
})
