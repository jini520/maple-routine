// 웹판이 지키던 여섯을 그대로 옮겼다. 클래스 문자열은 트리에 안 남으므로 **풀린 값**을 본다
// (`atoms` 와 같은 규칙. `render-atom.tsx`).
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  it('대기 문구를 보여준다', async () => {
    const { getByText } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    expect(getByText('불러오고 있어요')).toBeTruthy()
  })

  it('보조기술에 진행 중임을 알린다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    const state = getByTestId('loading-state')
    expect(state.props.role).toBe('status')
    expect(state.props['aria-busy']).toBe(true)
  })

  // 로딩이 끝나면 그 자리를 채울 카드와 같은 껍데기(실선 surface)여야
  // 결과가 들어와도 배경이 바뀌지 않는다. RN 에서는 그 껍데기가 `Card` atom 이다.
  it('셸 승계 카드 껍데기를 두른다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    expect(flattenStyle(getByTestId('loading-state').props.style)).toMatchObject({
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 기본테마.border,
      backgroundColor: 기본테마.surface,
    })
  })

  // 점선은 빈 상태(EmptyState)의 어법이라 로딩이 쓰면 구분되지 않는다.
  it('점선 테두리를 쓰지 않는다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    expect(flattenStyle(getByTestId('loading-state').props.style).borderStyle).toBeUndefined()
  })

  it('기본(inline)은 24px 스피너를 쓴다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    expect(getByTestId('maple-sweep-spinner', { includeHiddenElements: true }).props.width).toBe(24)
  })

  it('page 변형은 32px 스피너로 커지고 최소 높이를 갖는다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" size="page" />)

    expect(getByTestId('maple-sweep-spinner', { includeHiddenElements: true }).props.width).toBe(32)
    expect(flattenStyle(getByTestId('loading-state').props.style).minHeight).toBe(132)
  })

})
