import { flattenStyle, renderAtom } from '../../../components/__tests__/render-atom'
import { StatsSection } from '../StatsSection'

describe('StatsSection', () => {
  it('페이지 좌우 여백 안에 선 테두리 없는 카드다', async () => {
    const { getByTestId } = await renderAtom(
      <StatsSection title="순 수익" testID="section">
        {null}
      </StatsSection>,
    )
    const style = flattenStyle(getByTestId('section').props.style)

    expect(style.borderRadius).toBe(14)
    expect(style.marginLeft ?? style.marginHorizontal).toBeUndefined()
    expect(style.borderWidth).toBeUndefined()
  })
})
