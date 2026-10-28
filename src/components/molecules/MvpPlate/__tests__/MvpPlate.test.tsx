/** MVP 등급 명패. 일반은 그림이 없어 그림 명패와 같은 모양의 글자 판이다. */
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { MvpPlate } from '../MvpPlate'

describe('MvpPlate', () => {
  // 그림 명패와 판 모양이 다르면 이력 줄에서 일반만 다른 부품처럼 보인다.
  it('일반은 그림 명패와 같은 높이 · 폭 비율 · 모서리의 글자 판이다', async () => {
    const view = await renderAtom(<MvpPlate grade="normal" height={15} />)

    const plate = flattenStyle(view.getByLabelText('MVP 일반').props.style)
    expect(view.getByText('일반')).toBeTruthy()
    expect(plate.height).toBe(15)
    expect(plate.width).toBeCloseTo((15 * 243) / 50)
    expect(plate.borderRadius).toBe(4)
  })

  // 글자 줄이 판보다 높으면 판 안에서 글자가 눌린다(높이 14 에 줄 높이 16 이 들어가 찌그러졌다).
  it.each([15, 16, 18, 20])('높이 %i 에서 글자 줄이 판 높이를 넘지 않는다', async (height) => {
    const view = await renderAtom(<MvpPlate grade="normal" height={height} />)

    expect(Number(flattenStyle(view.getByText('일반').props.style).lineHeight)).toBeLessThanOrEqual(height)
  })
})
