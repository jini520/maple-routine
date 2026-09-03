// 149줄의 **명세를 읽어 다시 쓴 것**이다. 그쪽은 jsdom·DOM 기준이라 그대로는 뜻이 없다.
// 각 케이스가 지키는 결정은 웹 주석 그대로이고, RN 에서 검사 수단이 갈린 자리만 여기 적는다.
//
// 갈린 것 다섯
// ① `getByLabelText(/API 키/)` → `getByLabelText('Nexon Open API 키')`(RN 에는 라벨-컨트롤 연결이
//    없어 `aria-label` 이 곧 접근성 이름이다).
// ② `type="password"` → **`secureTextEntry`** 프롭을 본다.
// ③ `getByRole('link', …)` + `href` → **`Linking.openURL` 이 무엇으로 불렸는가**. RN 에 `href` 가
//  없으므로 링크의 계약은 "그 주소로 나간다" 하나뿐이고 이 지키려는 것도 그것이다.
// ④ `toBeDisabled`·`aria-busy` 속성 대신 **`accessibilityState`** 를 본다. `Pressable` 이
//    `disabled`·`aria-busy` 를 호스트 뷰에 그대로 넘기지 않고 그 객체로 접는다.
// ⑤ Enter 제출 → `await fireEvent(input, 'submitEditing')`.
import { fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { renderAtom, type AtomElement } from '../../../components/__tests__/render-atom'
import { ApiKeyForm } from '../ApiKeyForm'

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)

afterEach(() => {
  jest.clearAllMocks()
})

type Rendered = Awaited<ReturnType<typeof renderAtom>>

/** 글자를 담은 `Text` 에서 위로 올라가 그것을 감싼 누름 요소를 찾는 도우미. */
function pressableOf(node: AtomElement, role: 'button' | 'link'): AtomElement {
  let current: AtomElement | null = node
  while (current !== null && current.props.role !== role) current = current.parent
  if (current === null) throw new Error(`${role} 을 찾지 못했다`)
  return current
}

function submitButton(view: Rendered): AtomElement {
  return pressableOf(view.getByText(/^확인( 중)?$/), 'button')
}

/**
 * `Pressable` 이 접어 넣는 접근성 상태. `disabled`·`aria-busy` 를 프롭으로 직접 읽을 수 없다
 * (호스트 `View` 로 그대로 넘기지 않고 `accessibilityState` 로 접는다).
 */
function stateOf(node: AtomElement): { disabled?: boolean; busy?: boolean } {
  return (node.props.accessibilityState ?? {}) as { disabled?: boolean; busy?: boolean }
}

describe('ApiKeyForm', () => {
  it('입력 후 제출하면 onSubmit이 입력값으로 호출된다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)

    await fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), 'test-api-key-123')
    await fireEvent.press(submitButton(view))

    expect(onSubmit).toHaveBeenCalledWith('test-api-key-123')
  })

  it('앞뒤 공백은 잘라내고, 값이 비면 제출하지 않는다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)
    const input = view.getByLabelText('Nexon Open API 키')

    await fireEvent.changeText(input, '   ')
    await fireEvent.press(submitButton(view))
    expect(onSubmit).not.toHaveBeenCalled()

    await fireEvent.changeText(input, '  test-api-key-123  ')
    await fireEvent.press(submitButton(view))
    expect(onSubmit).toHaveBeenCalledWith('test-api-key-123')
  })

  it('isSubmitting이면 제출 버튼이 비활성화된다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={true} onSubmit={jest.fn()} />)

    expect(stateOf(submitButton(view)).disabled).toBe(true)
  })

  it('isSubmitting이면 스피너가 라벨을 덮는다. 라벨은 폭과 스크린리더를 위해 남는다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={true} onSubmit={jest.fn()} />)

    // 라벨을 지우지 않고 가린다. 지우면 버튼 폭이 줄고 스크린리더가 읽을
    // 것이 없다.
    expect(view.getByText('확인')).toBeTruthy()
    expect(stateOf(submitButton(view)).busy).toBe(true)
    // 스피너는 `aria-hidden` 이라 기본 쿼리에 안 잡힌다.
    expect(view.getByTestId('maple-spinner', { includeHiddenElements: true })).toBeTruthy()
  })

  it('isSubmitting이면 키보드 완료 키로도 onSubmit이 다시 호출되지 않는다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<ApiKeyForm isSubmitting={true} onSubmit={onSubmit} />)
    const input = view.getByLabelText('Nexon Open API 키')

    await fireEvent.changeText(input, 'test-api-key-123')
    await fireEvent(input, 'submitEditing')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('키보드 완료 키로도 제출된다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)
    const input = view.getByLabelText('Nexon Open API 키')

    await fireEvent.changeText(input, 'test-api-key-123')
    await fireEvent(input, 'submitEditing')

    expect(onSubmit).toHaveBeenCalledWith('test-api-key-123')
  })

  //  후속: 발급 절차는 안내 사이트가 담당하고 앱은 링크만 준다. 처음 쓰는
  // 사용자를 넥슨 첫 화면에 떨궈 놓지 않도록 가이드가 1차 경로다.
  it('API 키 발급 가이드를 1차 경로로 제공한다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    await fireEvent.press(pressableOf(view.getByText('API 키 발급 방법 보기'), 'link'))

    expect(openURL).toHaveBeenCalledWith('https://mapleroutine.store/api-key')
  })

  // 이미 키를 발급받은 사용자에게 7단계 안내를 경유시키지 않는다. 가이드와 별개의 진입점.
  it('openapi.nexon.com 바로 가기도 함께 제공한다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    await fireEvent.press(pressableOf(view.getByText('openapi.nexon.com에서 확인'), 'link'))

    expect(openURL).toHaveBeenCalledWith('https://openapi.nexon.com')
  })

  // 갈림길 레이아웃: 가이드는 구분선 뒤에서 '누를 수 있는 크기'가 되지만 외부 URL로 나가는
  // 이동이라 시맨틱은 링크다. 시맨틱을 `role` 로 남긴다.
  it('두 진입점 모두 버튼이 아니라 링크 시맨틱이다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    expect(pressableOf(view.getByText('API 키 발급 방법 보기'), 'link').props.role).toBe('link')
    expect(pressableOf(view.getByText('openapi.nexon.com에서 확인'), 'link').props.role).toBe('link')
  })

  // 온보딩 단계 중 이 화면에만 제목이 없었다. `ContentCharacterStep` 과 같은 블록을 쓴다.
  it('제목과 보조문을 보여준다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    expect(view.getByText('넥슨 API 키를 입력해주세요')).toBeTruthy()
    expect(view.getByText('스케줄러 API를 사용하려면 개인 API 키가 필요해요')).toBeTruthy()
  })

  // 요청은 "수집하거나 저장하지 않는다"였으나 키는 기기에 저장된다(storage/api-key).
  // 사실인 것은 "우리가 수집하지 않는다"뿐이라 지킬 수 있는 약속만 적는다.
  it('키가 기기 밖으로 나가지 않는다는 안내를 보여준다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    expect(view.getByText('입력한 키는 이 기기에만 저장되고 넥슨 외 어디로도 전송되지 않아요')).toBeTruthy()
  })

  it('아직 키가 없는 사용자를 위한 구분선 안내를 보여준다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    expect(view.getByText('아직 API 키가 없나요?')).toBeTruthy()
    expect(view.getByText('넥슨 오픈 API에서 키를 받는 7단계 안내')).toBeTruthy()
  })

  // 키는 손으로 치는 값이 아니라 붙여넣는 긴 문자열이라, 가려 두면 잘못 붙여넣었는지 확인할
  // 방법이 없다(실패해도 401 토스트만 뜬다).
  it('기본은 키를 가리고, 토글하면 보여준다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)
    const input = view.getByLabelText('Nexon Open API 키')

    expect(input.props.secureTextEntry).toBe(true)

    await fireEvent.press(view.getByLabelText('키 표시'))
    expect(view.getByLabelText('Nexon Open API 키').props.secureTextEntry).toBe(false)

    await fireEvent.press(view.getByLabelText('키 숨기기'))
    expect(view.getByLabelText('Nexon Open API 키').props.secureTextEntry).toBe(true)
  })

  // type 이 text 가 되는 구간이 생기므로. 모바일 키보드가 첫 글자를 대문자로 바꾸면
  // 조용히 틀린 키가 된다.
  it('키 입력란은 자동 대문자·자동 수정·맞춤법 검사를 끈다', async () => {
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={jest.fn()} />)

    const input = view.getByLabelText('Nexon Open API 키')
    expect(input.props.autoCapitalize).toBe('none')
    expect(input.props.autoCorrect).toBe(false)
    expect(input.props.spellCheck).toBe(false)
  })

// 표시 토글이 제출을 일으키지 않아야 한다. RN 에는 폼도 submit 도 없지만, 토글이
  // 제출 경로를 건드리지 않는다는 사실은 그대로 지켜야 한다.
  it('표시 토글은 제출을 일으키지 않는다', async () => {
    const onSubmit = jest.fn()
    const view = await renderAtom(<ApiKeyForm isSubmitting={false} onSubmit={onSubmit} />)

    await fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), 'test-api-key-123')
    await fireEvent.press(view.getByLabelText('키 표시'))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})
