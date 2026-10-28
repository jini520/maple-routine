/**
 * 안쪽만 다른 테마로 그리는 스코프. 테마 페이지가 적용 전의 테마를 페이지 안에서만 보여 줄 때 쓴다.
 *
 * `ThemeProvider` 와 같은 두 가지를 다시 선언한다. 색 변수(`className` 이 읽는다)와 테마 컨텍스트(배경 그림 ·
 * 시트 스코프처럼 값을 읽는 쪽이 본다)다. 하나만 바꾸면 안쪽에서 색과 그림이 서로 다른 테마를 따른다.
 *
 * @example <ThemeScope theme={draft}><ThemeBackdrop />{page}</ThemeScope>
 */
import { useMemo, type ReactNode } from 'react'
import { vars } from 'nativewind'
import { View } from 'react-native'

import { getThemeDefinition } from '../lib/theme/theme-registry'
import type { ThemeName } from '../types/theme'

import { ThemeContext } from './context'
import { buildThemeVariables } from './theme-vars'

export function ThemeScope(props: { theme: ThemeName; children: ReactNode }): React.JSX.Element {
  const appearance = useMemo(() => ({ theme: props.theme, definition: getThemeDefinition(props.theme) }), [props.theme])

  return (
    <ThemeContext.Provider value={appearance}>
      <View
        className="flex-1"
        // 불투명해야 바깥 테마의 화면과 배경 그림을 덮는다.
        style={[{ backgroundColor: appearance.definition.bg }, vars(buildThemeVariables(appearance.definition))]}
      >
        {props.children}
      </View>
    </ThemeContext.Provider>
  )
}
