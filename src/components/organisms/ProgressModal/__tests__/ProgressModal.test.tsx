// 웹판 셋을 그대로 옮겼다. `aria-valuenow` 를 보던 자리는 RN 의 `accessibilityValue.now` 다
// (`ProgressBar` atom 이 `role`·`aria-*` → `accessibilityRole`·`accessibilityValue` 로 옮겨 놨다).
import { findAllOfType, renderOverlay, type TreeNode } from '../../../__tests__/render-atom'
import { ProgressModal } from '../ProgressModal'

/** 진행률 바의 값 — `accessibilityRole="progressbar"` 를 가진 첫 노드에서 읽는다. */
function progressValue(tree: unknown): number | undefined {
  const track = findAllOfType(tree, 'View').find(
    (node: TreeNode) => node.props.accessibilityRole === 'progressbar',
  )
  return (track?.props.accessibilityValue as { now?: number } | undefined)?.now
}

describe('ProgressModal', () => {
  it('메시지와 진행률(N/M)을 함께 표시한다', async () => {
    const { getByText } = await renderOverlay(
      <ProgressModal message="캐릭터 정보를 저장하고 있어요" completed={2} total={5} />,
    )

    expect(getByText('캐릭터 정보를 저장하고 있어요 (2/5)')).toBeTruthy()
  })

  it('진행률 바의 값이 백분율(completed/total)로 설정된다', async () => {
    const { toJSON } = await renderOverlay(<ProgressModal message="저장 중" completed={2} total={5} />)

    expect(progressValue(toJSON())).toBe(40)
  })

  it('total 이 0이면 0%로 표시한다(0으로 나눔 방지)', async () => {
    const { toJSON } = await renderOverlay(<ProgressModal message="저장 중" completed={0} total={0} />)

    expect(progressValue(toJSON())).toBe(0)
  })

})
