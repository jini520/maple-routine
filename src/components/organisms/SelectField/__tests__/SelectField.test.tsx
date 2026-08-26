/**
 * 라벨–값 줄 모양의 커스텀 드롭다운([[ADR-173]] 결정 14).
 *
 * **jest 는 레이아웃을 안 잰다** — `measureInWindow` 도 `onLayout` 도 안 오므로 목록은 늘
 * `opacity: 0` 이다(`AccountSelect` 테스트와 같은 사정). 여기서 지키는 것은 **내용과 배선**이고,
 * 어디에 앉는지는 `place-dropdown` 의 순수 함수 테스트가 든다.
 */
import { act, fireEvent } from '@testing-library/react-native'

import { renderOverlay } from '../../../__tests__/render-atom'
import { SelectField } from '../SelectField'

const 보기 = [
  { value: null, label: '선택 안함' },
  { value: 'ocid-1', label: '루디' },
  { value: 'ocid-2', label: '아델' },
] as const

async function 그리기(selected: string | null = null, onSelect = jest.fn()) {
  const view = await renderOverlay(
    <SelectField
      label="캐릭터"
      options={보기}
      selected={selected}
      onSelect={onSelect}
      testID="pick"
    />,
  )
  return { view, onSelect }
}

async function 누르기(view: Awaited<ReturnType<typeof renderOverlay>>, testID: string) {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID))
  })
}

describe('SelectField', () => {
  it('고른 것을 줄에 적는다 — 안 골랐으면 그 라벨이 곧 값이다', async () => {
    const { view } = await 그리기(null)

    expect(view.getByTestId('pick-trigger')).toHaveTextContent('캐릭터선택 안함')
  })

  it('고른 값이 있으면 그것을 적는다', async () => {
    const { view } = await 그리기('ocid-2')

    expect(view.getByTestId('pick-trigger')).toHaveTextContent('캐릭터아델')
  })

  // 좁은 글자 하나가 아니라 **줄 전체**가 눌린다.
  it('줄을 누르면 목록이 열린다', async () => {
    const { view } = await 그리기()

    expect(view.queryByTestId('pick-list')).toBeNull()

    await 누르기(view, 'pick-trigger')

    expect(view.getByTestId('pick-list')).toBeTruthy()
    expect(view.getByTestId('pick-trigger').props.accessibilityState?.expanded).toBe(true)
  })

  it('고르면 그 값을 주고 닫는다', async () => {
    const { view, onSelect } = await 그리기()
    await 누르기(view, 'pick-trigger')

    await 누르기(view, 'pick-option-ocid-1')

    expect(onSelect).toHaveBeenCalledWith('ocid-1')
    expect(view.queryByTestId('pick-list')).toBeNull()
  })

  // `null` 도 키가 되어야 한다 — 목록의 첫 칸이 대개 그것이다.
  it('«안 고름» 도 고를 수 있다', async () => {
    const { view, onSelect } = await 그리기('ocid-1')
    await 누르기(view, 'pick-trigger')

    await 누르기(view, 'pick-option-')

    expect(onSelect).toHaveBeenCalledWith(null)
  })

  // 스크림이 없다 — 잡기만 한다([[ADR-144]] 결정 6 ①).
  it('바깥을 누르면 닫힌다', async () => {
    const { view } = await 그리기()
    await 누르기(view, 'pick-trigger')

    await 누르기(view, 'pick-backdrop')

    expect(view.queryByTestId('pick-list')).toBeNull()
  })

  // 목록이 갱신되는 순간 고른 값이 사라질 수 있다 — 렌더 중에 던지지 않는다([[ADR-127]]).
  it('고른 값이 목록에 없어도 안 죽는다', async () => {
    const { view } = await 그리기('사라진-ocid')

    expect(view.getByTestId('pick-trigger')).toHaveTextContent('캐릭터선택 안함')
  })
})
