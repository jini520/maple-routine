/** 계정 관리 목록과 계정 상세. 스토어는 `setState` 로 몰고, 추가 · 변경 · 삭제 · 이름 저장은 불렸는가와 무엇을 그리는가만 본다. */
import { useState } from 'react'
import { Pressable } from 'react-native'
import { fireEvent, waitFor, within } from '@testing-library/react-native'

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  // `useFocusEffect` 는 내비게이션 컨텍스트를 요구한다. 마운트를 첫 포커스로 흉내 낸다.
  useFocusEffect: (callback: () => void | (() => void)) => {
    const react = require('react') as typeof import('react')
    react.useEffect(callback, [callback])
  },
}))
jest.mock('../../../hooks/useSettingsNavigation', () => ({
  __esModule: true,
  useSettingsNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}))
jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))
jest.mock('../../../storage/maple-id-names', () => ({
  getMapleIdNames: jest.fn(async () => ({})),
  setMapleIdNames: jest.fn(async () => undefined),
}))

var mockNavigate: jest.Mock
var mockGoBack: jest.Mock
mockNavigate = jest.fn()
mockGoBack = jest.fn()

import { renderOverlay } from '../../../components/__tests__/render-atom'
import type { AccountManageView, ManagedAccount } from '../../../features/account-manage/accounts'
import { useAccountManageStore } from '../../../features/account-manage/store'
import { useMapleIdNamesStore } from '../../../features/maple-id/names'
import { SettingsAccountDetailScreen } from '../SettingsAccountDetailScreen'
import { SettingsAccountsScreen } from '../SettingsAccountsScreen'

const 넥슨ID: ManagedAccount = {
  key: 'login-1',
  kind: 'login',
  label: '넥슨 ID 계정',
  apiKey: null,
  server: null,
  mapleIds: [{ accountId: 'da9b2f21aa', representative: '낮잠자는곰' }],
  mapleIdHashes: ['h-main'],
}

const 부계정: ManagedAccount = {
  key: 'k-sub',
  kind: 'subKey',
  label: 'API 키 1 계정',
  apiKey: { type: 'key', id: 'k-sub', label: '', value: '부-키', loginId: 'login-1' },
  server: { apiKeyHashes: ['s'], mapleIds: ['h-sub'] },
  mapleIds: [{ accountId: '4f1c08abbb', representative: '리프한도적' }],
  mapleIdHashes: ['h-sub'],
}

const 키없는계정: ManagedAccount = {
  key: 'server:h-far',
  kind: 'subKey',
  label: 'API 키 2 계정',
  apiKey: null,
  server: { apiKeyHashes: ['x'], mapleIds: ['h-far'] },
  mapleIds: [],
  mapleIdHashes: ['h-far'],
}

const 메인키: ManagedAccount = { ...부계정, key: 'k-main', kind: 'mainKey', label: 'API 키 계정' }

let load: jest.Mock
let addKey: jest.Mock
let changeKey: jest.Mock
let removeAccount: jest.Mock

function 보기(view: Partial<AccountManageView>): void {
  useAccountManageStore.setState({ view: { hasLogin: true, accounts: [넥슨ID], canAdd: true, ...view } })
}

beforeEach(() => {
  jest.clearAllMocks()
  load = jest.fn(async () => undefined)
  addKey = jest.fn(async () => ({ outcome: 'saved' }))
  changeKey = jest.fn(async () => ({ outcome: 'saved' }))
  removeAccount = jest.fn(async () => 'removed')
  useAccountManageStore.setState({ view: null, load, addKey, changeKey, removeAccount })
  useMapleIdNamesStore.setState({ names: {} })
})

describe('SettingsAccountsScreen', () => {
  it('넥슨 ID 계정 · API 키 추가 · API 키 계정 차례로 서고, 계정 행 아래에 메이플 ID 이름과 대표 캐릭터를 적는다', async () => {
    보기({ accounts: [넥슨ID, 부계정, 키없는계정] })
    const view = await renderOverlay(<SettingsAccountsScreen />)

    expect(load).toHaveBeenCalled()
    expect(view.getByText('넥슨 ID 계정 설정')).toBeTruthy()
    expect(view.getByText('메이플ID-da9b2f21')).toBeTruthy()
    expect(view.getByText('낮잠자는곰')).toBeTruthy()
    expect(view.getByText('API 키 1 계정 설정')).toBeTruthy()
    expect(view.getByText('API 키 추가')).toBeTruthy()
    // 이 기기에 키가 없는 계정만 표시를 단다.
    expect(view.getAllByText('이 기기에 키 없음')).toHaveLength(1)

    await fireEvent.press(view.getByText('API 키 2 계정 설정'))
    expect(mockNavigate).toHaveBeenCalledWith('SettingsAccountDetail', { accountKey: 'server:h-far' })
  })

  it('바꾼 이름이 있으면 그 이름을 적는다', async () => {
    보기({})
    useMapleIdNamesStore.setState({ names: { da9b2f21aa: '본캐' } })
    const view = await renderOverlay(<SettingsAccountsScreen />)

    expect(view.getByText('본캐')).toBeTruthy()
    expect(view.queryByText('메이플ID-da9b2f21')).toBeNull()
  })

  it('API 키가 없으면 빈 상태 카드를 두고, 카드 안에 추가 버튼을 두지 않는다', async () => {
    보기({})
    const view = await renderOverlay(<SettingsAccountsScreen />)

    expect(view.getByText('등록한 API 키가 없어요')).toBeTruthy()
    expect(view.getAllByText('API 키 추가')).toHaveLength(1)
  })

  it('API 키 추가는 키 시트를 열고, 저장되면 닫는다. 검증에 걸리면 시트를 둔 채 모달로 알린다', async () => {
    보기({})
    const view = await renderOverlay(<SettingsAccountsScreen />)

    await fireEvent.press(view.getByText('API 키 추가'))
    expect(view.getByTestId('api-key-sheet')).toBeTruthy()

    addKey.mockResolvedValueOnce({ outcome: 'rejected', reason: 'alreadyRegistered' })
    await fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), '겹친-키')
    await fireEvent.press(view.getByText('확인'))
    await waitFor(() => expect(view.getByText('등록할 수 없는 키예요')).toBeTruthy())
    expect(view.getByText('이미 등록된 넥슨 계정의 키예요. 같은 넥슨 계정은 한 번만 등록할 수 있어요.')).toBeTruthy()
    expect(view.getByTestId('api-key-sheet')).toBeTruthy()

    await fireEvent.press(view.getByText('다시 입력하기'))
    await fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), '새-키')
    await fireEvent.press(view.getByText('확인'))
    await waitFor(() => expect(addKey).toHaveBeenLastCalledWith('새-키'))
    await waitFor(() => expect(view.queryByTestId('api-key-sheet')).toBeNull())
  })

  // 버튼을 숨기면 왜 추가할 수 없는지 보이지 않는다.
  it('넥슨 계정이 5개면 API 키 추가가 시트 대신 상한 모달을 띄운다', async () => {
    보기({ canAdd: false, accounts: [넥슨ID, 부계정] })
    const view = await renderOverlay(<SettingsAccountsScreen />)

    await fireEvent.press(view.getByText('API 키 추가'))

    expect(view.queryByTestId('api-key-sheet')).toBeNull()
    expect(view.getByText('더 추가할 수 없어요')).toBeTruthy()
    expect(view.getByText('넥슨 계정은 넥슨 ID 를 포함해 5개까지 등록할 수 있어요.')).toBeTruthy()
  })

  it('넥슨 로그인을 하지 않은 사용자는 로그인 블록과 키 계정 카드만 보고, API 키 추가가 없다', async () => {
    보기({ hasLogin: false, canAdd: false, accounts: [메인키] })
    const view = await renderOverlay(<SettingsAccountsScreen />)

    expect(view.getByText('부계정을 추가하려면 넥슨 로그인이 필요해요.')).toBeTruthy()
    expect(view.getByText('API 키 계정 설정')).toBeTruthy()
    expect(view.queryByText('API 키 추가')).toBeNull()
  })
})

describe('SettingsAccountDetailScreen', () => {
  function 상세(account: ManagedAccount, openKeySheet = false) {
    보기({ accounts: [넥슨ID, account] })
    return renderOverlay(<SettingsAccountDetailScreen route={{ params: { accountKey: account.key, openKeySheet } }} />)
  }

  it('메이플 ID 이름 칸 위에 대표 캐릭터를 적고, 부계정은 API 키 변경 · 삭제를 둔다', async () => {
    const view = await 상세(부계정)

    expect(view.getByText('API 키 1 계정 설정')).toBeTruthy()
    expect(view.getByText('대표 캐릭터 리프한도적')).toBeTruthy()
    expect(view.getByDisplayValue('메이플ID-4f1c08ab')).toBeTruthy()
    expect(view.getByText('API 키 변경')).toBeTruthy()
    expect(view.getByText('API 키 삭제')).toBeTruthy()
  })

  it('넥슨 ID 계정은 이름 칸만 있고 API 키 카드가 없다', async () => {
    보기({})
    const view = await renderOverlay(<SettingsAccountDetailScreen route={{ params: { accountKey: 'login-1' } }} />)

    expect(view.getByText('메이플 ID 이름')).toBeTruthy()
    expect(view.queryByText('API 키')).toBeNull()
  })

  it('이 기기에 키가 없고 메이플 ID 도 모르는 계정은 이름 칸 없이 안내와 API 키 입력 · 삭제만 둔다', async () => {
    const view = await 상세(키없는계정)

    expect(view.queryByText('메이플 ID 이름')).toBeNull()
    expect(view.getByText('이 기기에는 이 계정의 API 키가 없어요. 키를 넣어야 이 계정의 캐릭터를 불러올 수 있어요.')).toBeTruthy()
    expect(view.getByText('API 키 입력')).toBeTruthy()
    expect(view.getByText('API 키 삭제')).toBeTruthy()
  })

  // 이 키가 유일한 수단이라 지우면 로그아웃과 같다. 키를 떼는 것은 로그아웃이 맡는다.
  it('로그인하지 않은 사용자의 키 계정은 API 키 변경만 둔다', async () => {
    const view = await 상세(메인키)

    expect(view.getByText('API 키 변경')).toBeTruthy()
    expect(view.queryByText('API 키 삭제')).toBeNull()
  })

  it('저장은 고친 이름만 넘기고, 칸을 비우면 빈 값으로 넘겨 기본 이름으로 돌린다', async () => {
    const save = jest.fn(async () => undefined)
    useMapleIdNamesStore.setState({ names: { '4f1c08abbb': '부캐' }, save })
    const view = await 상세(부계정)

    await fireEvent.changeText(view.getByDisplayValue('부캐'), '')
    await fireEvent.press(view.getByText('저장'))

    expect(save).toHaveBeenCalledWith({ '4f1c08abbb': '' })
  })

  it('저장하지 않고 나간 뒤 다시 열면 저장된 이름에서 시작한다', async () => {
    보기({ accounts: [넥슨ID, 부계정] })
    // 상세를 닫았다가 다시 연다. `unmount` 는 뒤 테스트의 오버레이 뿌리까지 걷어서 안에서 화면을 내렸다 올린다.
    function DetailToggle(): React.JSX.Element {
      const [open, setOpen] = useState(true)
      return (
        <>
          <Pressable testID="toggle-detail" onPress={() => setOpen((current) => !current)} />
          {open && <SettingsAccountDetailScreen route={{ params: { accountKey: 부계정.key } }} />}
        </>
      )
    }
    const view = await renderOverlay(<DetailToggle />)
    await fireEvent.changeText(view.getByDisplayValue('메이플ID-4f1c08ab'), '고친이름')
    expect(view.getByDisplayValue('고친이름')).toBeTruthy()

    await fireEvent.press(view.getByTestId('toggle-detail'))
    await fireEvent.press(view.getByTestId('toggle-detail'))
    expect(view.getByDisplayValue('메이플ID-4f1c08ab')).toBeTruthy()
    expect(view.queryByDisplayValue('고친이름')).toBeNull()
  })

  it('API 키 삭제는 확인 모달을 거쳐 지우고, 지우면 목록으로 돌아간다', async () => {
    const view = await 상세(부계정)

    await fireEvent.press(view.getByText('API 키 삭제'))
    expect(view.getByText('API 키를 삭제할까요?')).toBeTruthy()
    expect(removeAccount).not.toHaveBeenCalled()

    // 모달의 빨간 글자 버튼이다. 같은 이름의 행이 뒤에 깔려 있다.
    await fireEvent.press(view.getAllByText('API 키 삭제').at(-1)!)
    await waitFor(() => expect(removeAccount).toHaveBeenCalledWith('k-sub'))
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
  })

  it('429 모달에서 들어오면 API 키 변경 시트가 열린 채 서고, 새 키를 그 계정으로 바꾼다', async () => {
    const view = await 상세(부계정, true)

    expect(within(view.getByTestId('api-key-sheet')).getByText('API 키 변경')).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), '새-부-키')
    await fireEvent.press(view.getByText('확인'))

    await waitFor(() => expect(changeKey).toHaveBeenCalledWith('k-sub', '새-부-키'))
  })
})
