/** 오래 걸리는 작업의 진행률 모달. 배지 · 제목 · 단위 · 단계는 작업이 주고, 막대 · 건수 · 퍼센트는 부품이 갖는다. */
import { findAllOfType, renderOverlay, type TreeNode } from '../../../__tests__/render-atom'
import { CrownIcon, UsersIcon } from '../../../atoms'
import { TaskProgressModal } from '../TaskProgressModal'

function progressValue(tree: unknown): number | undefined {
  const track = findAllOfType(tree, 'View').find((node: TreeNode) => node.props.accessibilityRole === 'progressbar')
  return (track?.props.accessibilityValue as { now?: number } | undefined)?.now
}

describe('TaskProgressModal', () => {
  it('제목과 건수 · 퍼센트를 보이고 막대가 그 퍼센트다', async () => {
    const view = await renderOverlay(
      <TaskProgressModal icon={CrownIcon} title="지난 기록에 수수료를 적용하고 있어요" done={812} total={1240} />,
    )

    expect(view.getByText('지난 기록에 수수료를 적용하고 있어요')).toBeTruthy()
    expect(view.getByText('812 / 1,240건')).toBeTruthy()
    expect(view.getByText('65%')).toBeTruthy()
    expect(progressValue(view.toJSON())).toBe(65)
  })

  it('단계가 둘 이상이면 단계마다 상태와 건수가 선다', async () => {
    const view = await renderOverlay(
      <TaskProgressModal
        icon={CrownIcon}
        title="앱 데이터를 업데이트하고 있어요"
        done={3742}
        total={6346}
        steps={[
          { label: '가계부 기록', state: 'done', done: 1532, total: 1532 },
          { label: '보스 수익 기록', sub: '결정석', state: 'run', done: 2210, total: 4108 },
          { label: '드롭 기록', state: 'wait', done: 0, total: 706 },
        ]}
      />,
    )

    expect(view.getByTestId('task-step-done')).toHaveTextContent('가계부 기록1,532건')
    expect(view.getByTestId('task-step-run')).toHaveTextContent('보스 수익 기록결정석2,210 / 4,108건')
    expect(view.getByTestId('task-step-wait')).toHaveTextContent('드롭 기록대기')
  })

  it('단계가 하나면 목록을 안 세운다', async () => {
    const view = await renderOverlay(
      <TaskProgressModal
        icon={CrownIcon}
        title="자동 수수료를 다시 계산하고 있어요"
        done={1}
        total={3}
        steps={[{ label: '판매 기록', state: 'run', done: 1, total: 3 }]}
      />,
    )

    expect(view.queryByTestId('task-step-run')).toBeNull()
  })

  it('단위를 받는다', async () => {
    const view = await renderOverlay(
      <TaskProgressModal icon={UsersIcon} title="캐릭터 정보를 저장하고 있어요" done={2} total={5} unit="개" />,
    )

    expect(view.getByText('2 / 5개')).toBeTruthy()
  })

  it('총수가 0 이면 0% 다', async () => {
    const view = await renderOverlay(<TaskProgressModal icon={CrownIcon} title="작업" done={0} total={0} />)

    expect(progressValue(view.toJSON())).toBe(0)
  })
})
