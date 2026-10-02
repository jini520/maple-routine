// 목록 카드 · 선택 줄에서 캐릭터 묶음 왼쪽에 서는 얼굴과 이름(정정 18).
import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { CharacterGroupLabel } from '../CharacterGroupLabel'

describe('CharacterGroupLabel', () => {
  it('얼굴 24 아래에 이름을 한 줄로 적는다', async () => {
    const view = await renderAtom(<CharacterGroupLabel name="낟낟" imageUrl={null} />)

    expect(view.getByText('낟낟').props.numberOfLines).toBe(1)
    expect(flattenStyle(view.getByTestId('character-group-face').props.style).width).toBe(24)
  })

  it('열 폭은 40 으로 묶음마다 같다', async () => {
    const view = await renderAtom(<CharacterGroupLabel name="아주긴캐릭터이름" imageUrl={null} />)

    expect(flattenStyle(view.getByTestId('character-group-label').props.style).width).toBe(40)
  })
})
