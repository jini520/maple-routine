// 웹판이 지키던 것("호출부 16곳의 모습을 바꾸지 않는다" — [[ADR-094]] 결정 4)을 RN 에서 다시 세운다.
// 클래스 문자열은 트리에 남지 않으므로 **풀린 값**을 본다.
//
// 여기서 특히 지키는 것은 RN 으로 오며 갈라진 자리다 — **상자와 글자가 두 벌**이라는 것
// (`variants.ts` 참고). 한 벌로 되돌리면 라벨이 색도 굵기도 없이 그려지는데, 그 실패는 조용하다.
import { Text } from 'react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { Button } from '../Button'
import { BUTTON_VARIANT_CLASS, BUTTON_VARIANT_TEXT_CLASS } from '../variants'

describe('Button', () => {
  it('primary — 채움 상자 + `on-primary` 글자(웹에서 상속으로 받던 16px)', async () => {
    const { getByRole, getByText } = await renderAtom(<Button variant="primary">확인</Button>)

    expect(flattenStyle(getByRole('button').props.style)).toMatchObject({
      borderRadius: 9999,
      backgroundColor: 기본테마.primary,
      paddingLeft: 20, // px-5
      paddingRight: 20,
      paddingTop: 10, // py-2.5
      paddingBottom: 10,
    })
    expect(flattenStyle(getByText('확인').props.style)).toMatchObject({
      color: 기본테마.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    })
  })

  it('text — 채움 없는 보조 동작', async () => {
    const { getByRole, getByText } = await renderAtom(<Button variant="text">취소</Button>)

    expect(flattenStyle(getByRole('button').props.style).backgroundColor).toBeUndefined()
    expect(flattenStyle(getByText('취소').props.style)).toMatchObject({
      color: 기본테마.textMuted,
      fontSize: 14,
      fontWeight: '500',
    })
  })

  it('danger — 파괴적 동작(연결 해제 등)', async () => {
    const { getByRole, getByText } = await renderAtom(<Button variant="danger">해제</Button>)

    expect(flattenStyle(getByRole('button').props.style)).toMatchObject({
      borderWidth: 1,
      borderColor: 기본테마.error,
    })
    expect(flattenStyle(getByText('해제').props.style).color).toBe(기본테마.errorInk)
  })

  // 주 CTA 옆/아래에 서는 부 동작. danger 와 같은 테두리 pill 이되 색이 중립이라
  // 파괴적 동작과 헷갈리지 않는다(design-system.md 「기본 컴포넌트」).
  it('outline — 중립 테두리 pill', async () => {
    const { getByRole, getByText } = await renderAtom(
      <Button variant="outline">발급 방법 보기</Button>,
    )

    expect(flattenStyle(getByRole('button').props.style)).toMatchObject({
      borderWidth: 1,
      borderColor: 기본테마.border,
    })
    expect(flattenStyle(getByText('발급 방법 보기').props.style).color).toBe(기본테마.text)
  })

  // 겉모습만 입혀야 하는 자리를 위해 변형 클래스를 별도 모듈에 둔다(웹과 같은 이유 — 컴포넌트
  // 파일이 컴포넌트 아닌 값을 export 하면 fast refresh 가 깨진다).
  it('변형 클래스가 상자·글자 두 벌로 모듈에 있다', () => {
    expect(Object.keys(BUTTON_VARIANT_CLASS)).toEqual(Object.keys(BUTTON_VARIANT_TEXT_CLASS))
    // 상자에 글자 유틸을 도로 넣으면 RN 에서 조용히 죽는다 — 그 회귀를 여기서 막는다.
    for (const box of Object.values(BUTTON_VARIANT_CLASS)) {
      expect(box).not.toMatch(/(^|\s)(text-|font-)/)
    }
  })

  it('className은 상자에, textClassName은 글자에 이어 붙는다', async () => {
    const { getByRole, getByText } = await renderAtom(
      <Button variant="primary" className="w-full items-center" textClassName="text-sm">
        저장
      </Button>,
    )

    expect(flattenStyle(getByRole('button').props.style)).toMatchObject({
      width: '100%',
      alignItems: 'center',
      backgroundColor: 기본테마.primary,
    })
    // 뒤에 붙은 `text-sm` 이 변형 기본값(16px)을 덮는다.
    expect(flattenStyle(getByText('저장').props.style).fontSize).toBe(14)
  })

  it('문자열 children만 Text 로 감싸고 요소 children 은 그대로 통과시킨다', async () => {
    const { getByTestId, getByText } = await renderAtom(
      <Button variant="primary">
        <Text testID="icon-slot">◎</Text>
        저장
      </Button>,
    )

    // 통과한 요소는 라벨 스타일을 안 받는다 — 웹에서 아이콘이 자기 스타일로 서던 것과 같다.
    expect(flattenStyle(getByTestId('icon-slot').props.style).color).toBeUndefined()
    expect(flattenStyle(getByText('저장').props.style).color).toBe(기본테마.onPrimary)
  })

  it('버튼 시맨틱과 핸들러·비활성이 그대로 전달된다', async () => {
    const onPress = jest.fn()
    const { getByRole } = await renderAtom(
      <Button variant="primary" onPress={onPress} disabled accessibilityLabel="저장하기">
        저장
      </Button>,
    )

    const button = getByRole('button', { name: '저장하기' })
    expect(button.props.accessibilityState).toMatchObject({ disabled: true })
  })

})
