// 불러오는 중을 **한 자리에서** 말한다. 하위 화면마다 스피너를 두면 어느 화면에 있느냐로
// 같은 사실이 다르게 보인다.
import { renderOverlay } from '../../../__tests__/render-atom'
import { LoadingModal } from '../LoadingModal'

it('문구와 스피너를 한 장에 담는다', async () => {
  const view = await renderOverlay(
    <LoadingModal title="보스 수익을 불러오고 있어요" detail="지난 13일치를 받는 중이에요" />,
  )

  expect(view.getByText('보스 수익을 불러오고 있어요')).toBeTruthy()
  expect(view.getByText('지난 13일치를 받는 중이에요')).toBeTruthy()
  expect(view.getByTestId('loading-modal')).toBeTruthy()
})

// **십수 초를 견디게 하는 것은 남은 양이 보이는 것**이다. 창이 그 수를 이미 안다.
it('진행을 주면 바와 수를 그린다', async () => {
  const view = await renderOverlay(
    <LoadingModal title="불러오는 중" detail="지난 13일치" done={32} total={84} />,
  )

  expect(view.getByText('32 / 84')).toBeTruthy()
  expect(view.getByText('38%')).toBeTruthy()
})

// 분모가 아직 안 정해진 순간이 있다(원장 읽는 몇십 밀리초). 그때 0/0 을 그리면 다 끝난 것처럼
// 보이거나 0으로 나눈다.
it('분모가 0 이면 바를 안 그린다', async () => {
  const view = await renderOverlay(<LoadingModal title="불러오는 중" done={0} total={0} />)

  expect(view.queryByTestId('loading-modal-progress')).toBeNull()
})

// 완료 시점에만 프로그램으로 닫는다. 오버레이를 눌러 닫으면 사용자가 **오는 중인데 안 온다**
// 고 읽는 화면에 남는다(`ProgressModal` 과 같은 이유).
it('오버레이를 눌러도 안 닫힌다', async () => {
  const view = await renderOverlay(<LoadingModal title="불러오는 중" />)

  expect(view.getByTestId('loading-modal')).toBeTruthy()
})
