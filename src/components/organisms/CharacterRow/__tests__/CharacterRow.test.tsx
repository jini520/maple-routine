// 두 층이 **같은 카드**를 쓴다는 것이 의 요점이라, 이 테스트가 묻는 것은
// `좌우 슬롯 말고 갈리는 것이 있는가`다 — 2줄 규칙 넷 · 조회 불가 · 이니셜 폴백 · 슬롯 유무.
//
// 별의 두 케이스(배경 없음 · 흐려도 눌린다)는 **금지사항** 을 그대로 옮긴 것이다: 배경 배지를 두면
// 같은 말을 두 번 하게 되고, `disabled` 로 만들면 대표를 바꿀 방법이 사라진다.
import { fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { AddMark } from '../AddMark'
import { CharacterRow } from '../CharacterRow'
import { DragHandle } from '../DragHandle'
import { RepresentativeStar } from '../RepresentativeStar'

const 기본 = {
  name: '내옆에최성일',
  level: 285,
  jobClass: '아크메이지(썬, 콜)',
  world: '스카니아',
  imageUrl: 'https://open.api.nexon.com/static/maplestory/character/look/abc',
}

describe('CharacterRow — 2줄 규칙', () => {
  it('레벨과 직업이 다 있으면 **Lv.285 아크메이지(썬, 콜)** 한 줄이다', async () => {
    const { getByText } = await renderAtom(<CharacterRow {...기본} />)

    expect(getByText('Lv.285 아크메이지(썬, 콜)')).toBeTruthy()
  })

  it('직업을 모르면 레벨만 선다 — 빈칸을 지어내지 않는다', async () => {
    const { getByText } = await renderAtom(<CharacterRow {...기본} jobClass={undefined} />)

    expect(getByText('Lv.285')).toBeTruthy()
  })

  it('레벨을 모르면 직업만 선다', async () => {
    const { getByText, queryByText } = await renderAtom(<CharacterRow {...기본} level={null} />)

    expect(getByText('아크메이지(썬, 콜)')).toBeTruthy()
    expect(queryByText(/Lv\./)).toBeNull()
  })

  it('둘 다 모르면 **2줄 자체가 없다** — 빈 줄을 남기지 않는다', async () => {
    const { queryByTestId } = await renderAtom(
      <CharacterRow {...기본} level={null} jobClass={undefined} />,
    )

    expect(queryByTestId('character-row-caption')).toBeNull()
  })

  it('조회 불가면 2줄이 그 사실로 바뀐다 — 레벨·직업보다 먼저 알아야 한다', async () => {
    const { getByText, queryByText } = await renderAtom(<CharacterRow {...기본} unavailable />)

    expect(getByText('조회할 수 없는 캐릭터')).toBeTruthy()
    expect(queryByText(/Lv\.285/)).toBeNull()
  })
})

describe('CharacterRow — 얼굴과 이름', () => {
  // 사용자 지정 2026-08-17 — 이름 첫 글자는 **이 캐릭터의 얼굴** 처럼 보여 **못 가져왔다** 를 말하지
  // 못했다. 주황 원 + `?` 는 그 자리가 **비어 있다는 사실**을 말한다.
  it('이미지가 없으면 이름 첫 글자가 아니라 주황 원 + ? 다', async () => {
    const { getByText, getByTestId, queryByTestId, queryByText } = await renderAtom(
      <CharacterRow {...기본} imageUrl={null} />,
    )

    expect(queryByTestId('character-row-face')).toBeNull()
    expect(queryByText('내')).toBeNull()
    expect(getByText('?')).toBeTruthy()
    // 그 원은 **테마 주황**이다 — 배경색이 실제로 칠해졌는지까지 본다(클래스 문자열은
    // NativeWind 가 스타일로 바꿔 없어지므로 flatten 한 값에서 읽는다).
    const fallback = flattenStyle(getByTestId('character-row-face-fallback').props.style)
    expect(fallback.backgroundColor).toBeTruthy()
  })

  it('월드를 모르면 엠블럼을 그리지 않는다', async () => {
    const { queryByTestId } = await renderAtom(<CharacterRow {...기본} world={undefined} />)

    expect(queryByTestId('character-row-emblem')).toBeNull()
  })

  it('onPress 를 주면 카드 전체가 버튼이다 (결정 3 — 누르는 것은 `＋` 가 아니다)', async () => {
    const onPress = jest.fn()
    const { getByRole } = await renderAtom(<CharacterRow {...기본} onPress={onPress} />)

    await fireEvent.press(getByRole('button'))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('onPress 가 없으면 버튼이 아니다 (위 층 행은 좌우 컨트롤로만 조작한다)', async () => {
    const { queryByRole } = await renderAtom(<CharacterRow {...기본} />)

    expect(queryByRole('button')).toBeNull()
  })
})

describe('CharacterRow — 좌우 슬롯', () => {
  it('leading 없이도 그려진다 (아래 층에는 핸들이 없다 — 결정 5)', async () => {
    const { getByText, queryByTestId } = await renderAtom(
      <CharacterRow {...기본} trailing={<AddMark />} />,
    )

    expect(queryByTestId('drag-handle')).toBeNull()
    expect(getByText('내옆에최성일')).toBeTruthy()
  })

  it('두 슬롯을 주면 둘 다 그린다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterRow
        {...기본}
        leading={<DragHandle />}
        trailing={<Text testID="슬롯-표식">★</Text>}
      />,
    )

    expect(getByTestId('drag-handle')).toBeTruthy()
    expect(getByTestId('슬롯-표식')).toBeTruthy()
  })

})

describe('RepresentativeStar', () => {
  it('채운 별에 배경도 테두리도 없다 — 채움 자체가 이미 **찬 것 vs 빈 것** 이다', async () => {
    const { getByRole } = await renderAtom(
      <RepresentativeStar label="내옆에최성일" filled onPress={jest.fn()} />,
    )

    const style = flattenStyle(getByRole('button').props.style)
    expect(style.backgroundColor).toBeUndefined()
    expect(style.borderWidth).toBeUndefined()
    expect(style.borderColor).toBeUndefined()
  })

  it('대표는 선택 상태로 알린다', async () => {
    const { getByRole } = await renderAtom(
      <RepresentativeStar label="내옆에최성일" filled onPress={jest.fn()} />,
    )

    expect(getByRole('button').props.accessibilityState.selected).toBe(true)
  })

  it('흐려도 눌린다 — 비활성이면 대표를 바꿀 방법이 없어진다', async () => {
    const onPress = jest.fn()
    const { getByRole } = await renderAtom(
      <RepresentativeStar label="밤샘메린" filled={false} dimmed onPress={onPress} />,
    )

    const star = getByRole('button')
    expect(star.props.accessibilityState.disabled).toBeFalsy()

    await fireEvent.press(star)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('흐림은 톤만 낮춘다', async () => {
    const dimmed = await renderAtom(
      <RepresentativeStar label="밤샘메린" filled={false} dimmed onPress={jest.fn()} />,
    )
    const plain = await renderAtom(
      <RepresentativeStar label="밤샘메린" filled={false} onPress={jest.fn()} />,
    )

    expect(flattenStyle(dimmed.getByRole('button').props.style).opacity as number).toBeCloseTo(0.4, 5)
    expect(flattenStyle(plain.getByRole('button').props.style).opacity).toBeUndefined()
  })
})

describe('DragHandle · AddMark', () => {
  it('핸들의 접근성 이름은 `순서 변경`이다 — 글리프 이름이 **메뉴** 라고 메뉴가 아니다', async () => {
    const { getByLabelText } = await renderAtom(<DragHandle />)

    expect(getByLabelText('순서 변경')).toBeTruthy()
  })

  it('`＋` 는 표시일 뿐이라 버튼이 아니다 (탭 영역은 행 전체다)', async () => {
    const { queryByRole, getByTestId } = await renderAtom(<AddMark />)

    expect(getByTestId('add-mark')).toBeTruthy()
    expect(queryByRole('button')).toBeNull()
  })
})
