// 지키던 여섯을 그대로 옮겼다. 클래스 문자열은 트리에 안 남으므로 **풀린 값**을 본다
// (`atoms` 와 같은 규칙. `render-atom.tsx`).
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  // 점선은 빈 상태(EmptyState)의 어법이라 로딩이 쓰면 구분되지 않는다.
  it('점선 테두리를 쓰지 않는다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" />)

    expect(flattenStyle(getByTestId('loading-state').props.style).borderStyle).toBeUndefined()
  })

  it('page 변형은 32px 스피너로 커지고 최소 높이를 갖는다', async () => {
    const { getByTestId } = await renderAtom(<LoadingState message="불러오고 있어요" size="page" />)

    expect(getByTestId('maple-sweep-spinner', { includeHiddenElements: true }).props.width).toBe(32)
    expect(flattenStyle(getByTestId('loading-state').props.style).minHeight).toBe(132)
  })

})
