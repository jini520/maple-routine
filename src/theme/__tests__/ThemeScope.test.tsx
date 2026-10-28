// 테마 페이지가 고른 테마를 페이지 안에서만 보여 주는 자리.
//
// 기대 색은 손으로 적지 않고 `getThemeDefinition` 에서 읽는다(`ThemeProvider.test.tsx` 와 같다).
import { Text as RNText } from 'react-native'

import { THEME_NAMES, getThemeDefinition } from '../../lib/theme/theme-registry'

import { flattenStyle, renderAtom } from '../../components/__tests__/render-atom'
import { Text } from '../../components/atoms'
import { useThemeAppearance } from '../context'
import { ThemeScope } from '../ThemeScope'

const 바깥테마 = THEME_NAMES[0]
const 안쪽테마 = THEME_NAMES.find((name) => getThemeDefinition(name).mode !== getThemeDefinition(THEME_NAMES[0]).mode)
if (안쪽테마 === undefined) throw new Error('모드가 다른 테마가 없다')

function ThemeNameProbe(props: { testID: string }): React.JSX.Element {
  return <RNText testID={props.testID}>{useThemeAppearance().theme}</RNText>
}

describe('ThemeScope', () => {
  it('안쪽의 className 은 준 테마로, 바깥은 지금 테마로 풀린다', async () => {
    const view = await renderAtom(
      <>
        <Text testID="outside" className="text-text">바깥</Text>
        <ThemeScope theme={안쪽테마}>
          <Text testID="inside" className="text-text">안쪽</Text>
        </ThemeScope>
      </>,
    )

    expect(flattenStyle(view.getByTestId('outside').props.style).color).toBe(getThemeDefinition(바깥테마).text)
    expect(flattenStyle(view.getByTestId('inside').props.style).color).toBe(getThemeDefinition(안쪽테마).text)
  })

  it('안쪽의 테마 컨텍스트는 준 테마다', async () => {
    const view = await renderAtom(
      <>
        <ThemeNameProbe testID="outside" />
        <ThemeScope theme={안쪽테마}>
          <ThemeNameProbe testID="inside" />
        </ThemeScope>
      </>,
    )

    expect(view.getByTestId('outside').props.children).toBe(바깥테마)
    expect(view.getByTestId('inside').props.children).toBe(안쪽테마)
  })
})
