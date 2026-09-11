// 토스트가 아니라 **내용 자리**에 서는 안내다. 그 실패는 사건이 아니라 그 캐릭터를 고르고 있는
// 동안 계속 참인 상태라, 토스트로 두면 고를 때마다 같은 문구가 다시 뜨고 사라진 뒤에는 화면이
// 아무 이유도 말하지 않는다.
import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { CharacterUnavailableNotice } from '../CharacterUnavailableNotice'

it('무슨 일인지와 무엇을 할 수 있는지를 함께 말한다', async () => {
  const { getByText } = await renderAtom(
    <CharacterUnavailableNotice onOpenCharacterManage={jest.fn()} />,
  )

  expect(getByText('이 캐릭터는 조회할 수 없습니다')).toBeTruthy()
  expect(getByText(/캐릭터 관리에서 추적을 해제하거나/)).toBeTruthy()
})

// 처방이 새로고침이 아니다. 이 실패는 영구라 사용자가 할 수 있는 일이 캐릭터 관리뿐이다.
it('캐릭터 관리로 가는 버튼을 누르면 호출부에 넘긴다', async () => {
  const onOpenCharacterManage = jest.fn()
  const { getByText } = await renderAtom(
    <CharacterUnavailableNotice onOpenCharacterManage={onOpenCharacterManage} />,
  )

  await act(async () => {
    fireEvent.press(getByText('캐릭터 관리로 이동하기'))
  })

  expect(onOpenCharacterManage).toHaveBeenCalledTimes(1)
})

// 다시 시도 는 눌러도 같은 400 이다. 그 버튼을 주면 화면이 두 말을 한다.
it('다시 시도를 주지 않는다', async () => {
  const { queryByText } = await renderAtom(
    <CharacterUnavailableNotice onOpenCharacterManage={jest.fn()} />,
  )

  expect(queryByText('다시 시도')).toBeNull()
})
