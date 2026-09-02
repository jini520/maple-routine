// 이 배선이 끊기면 SVG atom 셋(`MapleSpinner`·`MapleSweepSpinner`·`ProfitIcon`)이 **크기도 색도 없이**
// 그려진다. 에러는 나지 않는다. `className` 이 그냥 모르는 프롭으로 흘러갈 뿐이라, 화면을 보기
// 전에는 아무도 모른다. 그래서 atom 별 테스트와 별개로 배선 자체를 여기서 못박는다.
//
// (`jest.setup.js` 가 컴파일된 `global.css` 를 주입하고 `ThemeProvider` 가 변수를 내려보내는 것까지가
//  전제다. 그 고리들은 `src/__tests__/nativewind-wiring.test.tsx` · `src/theme/__tests__` 가 지킨다.)
import { render } from '@testing-library/react-native'
import { getThemeDefinition } from '../theme/theme-registry'
import { Path } from 'react-native-svg'

import { ThemeProvider } from '../../theme/ThemeProvider'
import { LinearGradient, Svg } from '../nativewind-interop'

const 머쉬맘 = getThemeDefinition('머쉬맘')

/** `style` 프롭이 배열로도 오므로 평평하게 편다. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle)) as Record<string, unknown>
  }
  if (style !== null && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('NativeWind ↔ 써드파티 배선', () => {
  it('Svg — `text-*` 가 `color` 프롭이 되어 자식의 `currentColor` 를 채운다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Svg testID="svg" className="text-primary" viewBox="0 0 24 24">
          <Path d="M0 0h1" stroke="currentColor" />
        </Svg>
      </ThemeProvider>,
    )

    expect(getByTestId('svg').props.color).toBe(머쉬맘.primary)
  })

  it('Svg — 크기 유틸이 상자 크기가 된다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <Svg testID="svg" className="h-5 w-5" viewBox="0 0 24 24" />
      </ThemeProvider>,
    )

    expect(flattenStyle(getByTestId('svg').props.style)).toMatchObject({ width: 20, height: 20 })
  })

  it('LinearGradient — `className` 이 style 로 풀린다', async () => {
    const { getByTestId } = await render(
      <ThemeProvider>
        <LinearGradient testID="g" colors={['#000', '#fff']} className="h-5 rounded-full px-2.5" />
      </ThemeProvider>,
    )

    expect(flattenStyle(getByTestId('g').props.style)).toMatchObject({
      height: 20,
      borderRadius: 9999,
      paddingLeft: 10,
      paddingRight: 10,
    })
  })
})
