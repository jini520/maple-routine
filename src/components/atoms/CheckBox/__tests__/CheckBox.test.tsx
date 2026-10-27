/** 체크박스 상자. 테두리 없이 채움으로 켜짐과 꺼짐을 가른다. */
import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { withAlpha } from '../../../../lib/color'
import { rnThemeAppearancePort } from '../../../../native/adapters/rn-theme-appearance'
import { __resetThemeAppearanceForTest } from '../../../../theme/appearance-store'
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { CheckBox } from '../CheckBox'

afterEach(__resetThemeAppearanceForTest)

// 꺼진 상자는 놓이는 바탕(화면 · 카드 · 칸 · 시트)을 가리지 않고 보여야 한다. card-inset 으로 채우면 라이트의 화면 바탕 위에서 묻힌다.
describe('CheckBox', () => {
  it.each(['머쉬맘', '혼테일'] as const)('%s: 꺼진 상자는 테두리 없이 글자색 반투명으로, 켜진 상자는 테마색으로 채운다', async (name) => {
    const definition = getThemeDefinition(name)
    rnThemeAppearancePort.apply(name, definition)

    const off = flattenStyle((await renderAtom(<CheckBox checked={false} />)).getByTestId('checkbox-box').props.style)
    const on = flattenStyle((await renderAtom(<CheckBox checked />)).getByTestId('checkbox-box').props.style)

    expect(off.borderWidth).toBeUndefined()
    expect(off.backgroundColor).toBe(withAlpha(definition.text, 0.14))
    expect(on.borderWidth).toBeUndefined()
    expect(on.backgroundColor).toBe(definition.primary)
  })
})
