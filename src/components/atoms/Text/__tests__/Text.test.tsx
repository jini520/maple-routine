// 글자 atom 이 **실제로 그 프롭을 달고 나가는가**([[ADR-152]] 결정 4). 산수는 옆 파일
// (`font-scaling.test.ts`)이 보고, 여기서는 배선만 본다 — 계산이 맞아도 프롭이 안 붙으면
// 화면은 그대로 옛 동작이다.
//
// ## 배수는 `Dimensions.get('window')` 를 통해 흘려 넣는다
//
// `useWindowDimensions()` 는 초기값을 그 호출에서 얻으므로(`useWindowDimensions.js`), 그 하나만
// 목으로 덮으면 «시스템 글자 크기가 이렇게 설정된 기기» 를 만들 수 있다. 훅 자체를 목으로 덮지
// 않는 이유는 `react-native` 의 export 가 게터라 `jest.spyOn` 이 안 걸리기 때문이고, 무엇보다
// 이렇게 두면 **컴포넌트가 무엇을 읽는지** 를 테스트가 안 정해도 된다.
import { Dimensions } from 'react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { FONT_SCALE_MAX } from '../font-scaling'
import { Text } from '../Text'

/** 시스템 글자 크기가 `fontScale` 로 설정된 기기를 만든다. */
function 시스템_글자배수(fontScale: number): void {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Text — 시스템 글자 배수를 [1.0, 1.235] 로 자른다 ([[ADR-152]])', () => {
  it('기본(1.0)에서는 스케일링을 켜고 상한만 건다', async () => {
    시스템_글자배수(1)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(true)
    expect(getByText('보스').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })

  it('작게 설정한 기기(0.823)에서는 스케일링을 끈다 — 하한 1.0', async () => {
    시스템_글자배수(0.823)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(false)
  })

  it('접근성 최대(3.571)에서도 상한은 1.235 다', async () => {
    시스템_글자배수(3.571)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(true)
    expect(getByText('보스').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })

  it('fixed 는 배수와 무관하게 끈다 — 칸에 묶인 글자(결정 5)', async () => {
    시스템_글자배수(3.571)
    const { getByText } = await renderAtom(<Text fixed>73</Text>)

    expect(getByText('73').props.allowFontScaling).toBe(false)
  })

  it('className 은 그대로 스타일로 풀린다 — 래퍼가 NativeWind 를 가리지 않는다', async () => {
    시스템_글자배수(1)
    const { getByText } = await renderAtom(<Text className="text-sm font-semibold">보스</Text>)

    expect(flattenStyle(getByText('보스').props.style)).toMatchObject({
      fontSize: 14,
      fontWeight: '600',
    })
  })

  it('나머지 Text 프롭은 그대로 통과한다', async () => {
    시스템_글자배수(1)
    const { getByTestId } = await renderAtom(
      <Text testID="라벨" numberOfLines={1}>
        보스
      </Text>,
    )

    expect(getByTestId('라벨').props.numberOfLines).toBe(1)
  })
})
