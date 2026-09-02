// 이 화면이 지키는 것을 적는다. 각 케이스가 지키는 결정은 웹 주석 그대로다.
//
// 갈린 것 셋
// ① `getByRole('button', { name })` → **글자에서 위로 올라가** 그 행을 잡는다. RN 은 자식 글자를
//    합쳐 하나의 접근성 이름으로 만들지 않는다(온보딩 테스트와 같은 헬퍼).
// ② `toHaveClass('text-error-ink')` → **컴파일된 스타일의 색**을 본다. 클래스는 스타일로 바뀌어
//  사라지므로, 기대값은 손으로 적지 않고 `job-themes.json` 에서 읽는다(`render-atom`).
// ③ `onClick` → `onPress`. 계약("누르면 한 번 불린다")은 그대로다.
import { fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'

import {
  flattenStyle,
  renderAtom,
  기본테마,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { SettingsRow } from '../SettingsRow'

type Rendered = Awaited<ReturnType<typeof renderAtom>>

function rowOf(view: Rendered, label: string): AtomElement {
  let node: AtomElement | null = view.getByText(label)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`행을 찾지 못했다: ${label}`)
  return node
}

describe('SettingsRow', () => {
  it('label을 렌더링하고 누르면 onPress가 호출된다', async () => {
    const onPress = jest.fn()
    const view = await renderAtom(<SettingsRow label="테마" onPress={onPress} />)

    fireEvent.press(rowOf(view, '테마'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('rightContent를 안 주면 기본 chevron 아이콘이 보인다', async () => {
    const view = await renderAtom(<SettingsRow label="테마" onPress={jest.fn()} />)

    expect(view.getByTestId('settings-row-chevron')).toBeTruthy()
  })

  // : 배타에서 병기로. 값이 있으면 화살표가 사라지던 옛 동작에서는 화살표가
  // "누르면 열린다"가 아니라 "값이 있는가"를 말했다.
  it('rightContent를 주면 그 내용과 chevron이 함께 보인다', async () => {
    const view = await renderAtom(
      <SettingsRow label="테마" onPress={jest.fn()} rightContent={<Text>렌</Text>} />,
    )

    expect(view.getByText('렌')).toBeTruthy()
    expect(view.getByTestId('settings-row-chevron')).toBeTruthy()
  })

  it('showChevron이 false면 rightContent만 남고 chevron은 없다', async () => {
    const view = await renderAtom(
      <SettingsRow
        label="캐시 데이터 삭제"
        onPress={jest.fn()}
        showChevron={false}
        rightContent={<Text>1.5MB</Text>}
      />,
    )

    expect(view.getByText('1.5MB')).toBeTruthy()
    expect(view.queryByTestId('settings-row-chevron')).toBeNull()
  })

  it('showChevron이 false이고 rightContent도 없으면 chevron이 보이지 않는다', async () => {
    const view = await renderAtom(
      <SettingsRow label="연결 해제" onPress={jest.fn()} showChevron={false} />,
    )

    expect(view.queryByTestId('settings-row-chevron')).toBeNull()
  })

  it('danger가 true면 label이 error 톤으로 렌더링된다', async () => {
    const view = await renderAtom(<SettingsRow label="연결 해제" onPress={jest.fn()} danger />)

    expect(flattenStyle(view.getByText('연결 해제').props.style).color).toBe(기본테마.errorInk)
  })

  it('danger가 아니면 기본 글자색이다', async () => {
    const view = await renderAtom(<SettingsRow label="테마" onPress={jest.fn()} />)

    expect(flattenStyle(view.getByText('테마').props.style).color).toBe(기본테마.text)
  })
})
