// 불러오는 중을 **한 자리에서** 말한다. 하위 화면마다 스피너를 두면 어느 화면에 있느냐로
// 같은 사실이 다르게 보인다.
import { renderOverlay } from '../../../__tests__/render-atom'
import { LoadingModal } from '../LoadingModal'

it('문구와 스피너를 한 장에 담는다', async () => {
  const view = await renderOverlay(<LoadingModal title="기록을 불러오고 있어요" />)

  expect(view.getByText('기록을 불러오고 있어요')).toBeTruthy()
  expect(view.getByTestId('loading-modal')).toBeTruthy()
})

// **십수 초를 견디게 하는 것은 남은 양이 보이는 것**이다. 창이 그 수를 이미 안다.
it('진행을 주면 바와 수를 그린다', async () => {
  const view = await renderOverlay(
    <LoadingModal title="불러오는 중" done={32} total={84} />,
  )

  expect(view.getByText('32 / 84')).toBeTruthy()
  expect(view.getByText('38%')).toBeTruthy()
})

// 분모가 아직 안 정해진 순간이 있다(원장 읽는 몇십 밀리초). 그때 `0 / 0` 을 그리면 다 끝난 것처럼
// 보이거나 0으로 나눈다. 그렇다고 바를 빼면 **모달이 먼저 뜨고 바가 나중에 붙어 카드가 자란다**
// (사용자 보고). 자리는 잡아 두고 숫자만 비운다.
describe('분모가 아직 없을 때', () => {
  it('바는 그대로 서고 숫자만 `-` 다', async () => {
    const view = await renderOverlay(<LoadingModal title="불러오는 중" done={0} total={0} />)

    expect(view.getByTestId('loading-modal-progress')).toBeTruthy()
    expect(view.getByText('- / -')).toBeTruthy()
    expect(view.getByText('-')).toBeTruthy()
    expect(view.queryByText('0 / 0')).toBeNull()
    expect(view.queryByText('0%')).toBeNull()
  })

  // 0 을 주면 스크린리더가 **0% 로 확정해** 읽는다. 모르는 것과 0 인 것은 다르다.
  it('접근성 값을 안 준다', async () => {
    const view = await renderOverlay(<LoadingModal title="불러오는 중" done={0} total={0} />)

    expect(view.queryByRole('progressbar')).toBeNull()
  })

  // 분모가 오면 그 자리에 숫자가 들어찬다. 자리는 안 움직인다.
  it('분모가 오면 숫자로 바뀐다', async () => {
    const view = await renderOverlay(<LoadingModal title="불러오는 중" done={0} total={111} />)

    expect(view.getByText('0 / 111')).toBeTruthy()
    expect(view.getByText('0%')).toBeTruthy()
  })
})

// 완료 시점에만 프로그램으로 닫는다. 오버레이를 눌러 닫으면 사용자가 **오는 중인데 안 온다**
// 고 읽는 화면에 남는다(`ProgressModal` 과 같은 이유).
it('오버레이를 눌러도 안 닫힌다', async () => {
  const view = await renderOverlay(<LoadingModal title="불러오는 중" />)

  expect(view.getByTestId('loading-modal')).toBeTruthy()
})
