/** MVP 등급 명패. 일반은 그림이 없어 같은 높이의 글자 알약이다. */
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { MvpPlate } from '../MvpPlate'

describe('MvpPlate', () => {
  it('명패 그림을 등급 이름으로 읽어 준다', async () => {
    const view = await renderAtom(<MvpPlate grade="diamond" height={18} />)

    const image = view.getByLabelText('MVP 다이아')
    expect(flattenStyle(image.props.style).height).toBe(18)
  })

  it('일반은 그림 대신 같은 높이의 글자 알약이다', async () => {
    const view = await renderAtom(<MvpPlate grade="normal" height={18} />)

    expect(view.getByText('일반')).toBeTruthy()
    expect(flattenStyle(view.getByLabelText('MVP 일반').props.style).height).toBe(18)
  })
})
