// 다른 사람으로 로그인할 때 앞 사람의 올리지 못한 기록을 버릴지 묻는 모달. 문구는 사용자가 골랐다.
import { act, fireEvent } from '@testing-library/react-native'

import { useUnsyncedPromptStore } from '../../../features/auth/unsynced-prompt'
import { renderOverlay } from '../../../components/__tests__/render-atom'
import { UnsyncedRecordsModal } from '../UnsyncedRecordsModal'

afterEach(async () => {
  await act(async () => useUnsyncedPromptStore.getState().answer(false))
})

it('묻지 않을 때는 그리지 않는다', async () => {
  const view = await renderOverlay(<UnsyncedRecordsModal />)

  expect(view.queryByTestId('unsynced-records-overlay')).toBeNull()
})

it('앞 사람의 대기 줄 수를 넣어 묻고, `버리고 로그인` 이면 버린다고 답한 뒤 닫는다', async () => {
  const view = await renderOverlay(<UnsyncedRecordsModal />)
  let asking: Promise<boolean> = Promise.resolve(false)
  await act(async () => {
    asking = useUnsyncedPromptStore.getState().ask(3)
  })

  expect(view.getByText('동기화하지 못한 기록이 있습니다')).toBeTruthy()
  expect(
    view.getByText('앞서 쓰던 계정의 기록 3건을 아직 서버에 올리지 못했습니다. 버리고 로그인하면 이 기기에서 지워지고 되살릴 수 없습니다.'),
  ).toBeTruthy()

  await act(async () => {
    fireEvent.press(view.getByText('버리고 로그인'))
  })

  await expect(asking).resolves.toBe(true)
  expect(view.queryByTestId('unsynced-records-overlay')).toBeNull()
})

it('`그만두기` 면 버리지 않는다고 답한다', async () => {
  const view = await renderOverlay(<UnsyncedRecordsModal />)
  let asking: Promise<boolean> = Promise.resolve(true)
  await act(async () => {
    asking = useUnsyncedPromptStore.getState().ask(1)
  })

  await act(async () => {
    fireEvent.press(view.getByText('그만두기'))
  })

  await expect(asking).resolves.toBe(false)
})
