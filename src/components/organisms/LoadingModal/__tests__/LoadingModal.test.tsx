// 불러오는 중을 **한 자리에서** 말한다. 하위 화면마다 스피너를 두면 어느 화면에 있느냐로
// 같은 사실이 다르게 보인다.
import { renderOverlay } from '../../../__tests__/render-atom'
import { LoadingModal } from '../LoadingModal'

it('문구와 스피너를 한 장에 담는다', async () => {
  const view = await renderOverlay(<LoadingModal message="보스 수익을 불러오고 있어요" />)

  expect(view.getByText('보스 수익을 불러오고 있어요')).toBeTruthy()
  expect(view.getByTestId('loading-modal')).toBeTruthy()
})

// 완료 시점에만 프로그램으로 닫는다. 오버레이를 눌러 닫으면 사용자가 **오는 중인데 안 온다**
// 고 읽는 화면에 남는다(`ProgressModal` 과 같은 이유).
it('오버레이를 눌러도 안 닫힌다', async () => {
  const view = await renderOverlay(<LoadingModal message="불러오는 중" />)

  expect(view.getByTestId('loading-modal')).toBeTruthy()
})
