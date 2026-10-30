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

  // 줄 높이가 16 인 자리(today 공유 컨텐츠)에 18 을 넣으면 줄마다 높아져 타일이 길어진다.
  it('`sm` 은 14 상자이고 기본값은 18 이다', async () => {
    const sm = flattenStyle((await renderAtom(<CheckBox checked size="sm" />)).getByTestId('checkbox-box').props.style)
    const md = flattenStyle((await renderAtom(<CheckBox checked />)).getByTestId('checkbox-box').props.style)

    expect([sm.width, sm.height]).toEqual([14, 14])
    expect([md.width, md.height]).toEqual([18, 18])
  })
})
