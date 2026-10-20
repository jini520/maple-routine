// 목록 카드 · 선택 줄에서 캐릭터 묶음 왼쪽에 서는 얼굴과 이름(정정 18).
import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { CharacterGroupLabel } from '../CharacterGroupLabel'

describe('CharacterGroupLabel', () => {
  it('열 폭은 40 으로 묶음마다 같다', async () => {
    const view = await renderAtom(<CharacterGroupLabel name="아주긴캐릭터이름" imageUrl={null} />)

    expect(flattenStyle(view.getByTestId('character-group-label').props.style).width).toBe(40)
  })
})
