// 지키는 것은 `호출부 16곳의 모습을 바꾸지 않는다` 다.
// 클래스 문자열은 트리에 남지 않으므로 **풀린 값**을 본다.
//
// 여기서 특히 지키는 것은 RN 으로 오며 갈라진 자리다. **상자와 글자가 두 벌**이라는 것
// (`variants.ts` 참고). 한 벌로 되돌리면 라벨이 색도 굵기도 없이 그려지는데, 그 실패는 조용하다.
import { Text } from 'react-native'

import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { Button } from '../Button'
import {
  BUTTON_SIZE_CLASS,
  BUTTON_VARIANT_CLASS,
  BUTTON_VARIANT_SPINNER_CLASS,
  BUTTON_VARIANT_TEXT_CLASS,
} from '../variants'

describe('Button', () => {
// 겉모습만 입혀야 하는 자리를 위해 변형 클래스를 별도 모듈에 둔다(컴포넌트
  // 파일이 컴포넌트 아닌 값을 export 하면 fast refresh 가 깨진다).
  it('변형 클래스가 상자·글자 두 벌로 모듈에 있다', () => {
    expect(Object.keys(BUTTON_VARIANT_CLASS)).toEqual(Object.keys(BUTTON_VARIANT_TEXT_CLASS))
    // 상자에 글자 유틸을 도로 넣으면 RN 에서 조용히 죽는다. 그 회귀를 여기서 막는다.
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

// 통과한 요소는 라벨 스타일을 안 받는다.
    expect(flattenStyle(getByTestId('icon-slot').props.style).color).toBeUndefined()
    expect(flattenStyle(getByText('저장').props.style).color).toBe(기본테마.onPrimary)
  })
})

// 라벨을 지우지 않고 **가린다**. 폭이 그대로 남고 스크린리더도 라벨을 그대로 읽는다.
describe('Button: busy', () => {
  it('라벨이 트리에 남는다. 지우면 폭이 줄고 스크린리더가 읽을 것이 없다', async () => {
    const { getByText, getByRole } = await renderAtom(
      <Button variant="primary" busy>
        확인
      </Button>,
    )

    expect(getByText('확인')).toBeTruthy()
    // RN 은 `aria-busy` 를 `accessibilityState.busy` 로 옮긴다.
    expect(getByRole('button').props.accessibilityState).toMatchObject({ busy: true })
  })

  it('라벨은 `opacity-0` 으로 가려진다. 크기와 두께는 대기 전과 같다', async () => {
    const 평소 = flattenStyle((await renderAtom(<Button variant="primary">확인</Button>)).getByText('확인').props.style)
    const 대기 = flattenStyle(
      (await renderAtom(
        <Button variant="primary" busy>
          확인
        </Button>,
      )).getByText('확인').props.style,
    )

    expect(평소.opacity).toBeUndefined()
    expect(대기.opacity).toBe(0)
    // 폭을 만드는 값들이 그대로여야 대기 전 폭이 유지된다.
    expect(대기.fontSize).toBe(평소.fontSize)
    expect(대기.fontWeight).toBe(평소.fontWeight)
  })

  // 호출부가 색을 안 주면 스피너가 검정으로 떨어진다.
  it('스피너 색이 variant 의 라벨 색과 같다', async () => {
    const cases = [
      ['primary', 기본테마.onPrimary],
      ['danger', 기본테마.errorInk],
      ['outline', 기본테마.text],
      ['text', 기본테마.textMuted],
    ] as const

    for (const [variant, color] of cases) {
      const tree = (
        await renderAtom(
          <Button variant={variant} busy>
            확인
          </Button>,
        )
      ).toJSON()
      const [spinner] = findAllOfType(tree, 'RNSVGSvgView')

      expect(spinner?.props.color).toBe(color)
    }
  })

  it('스피너 색 표가 라벨 색 표와 같은 토큰을 쓴다. 두 표가 갈리면 색이 어긋난다', () => {
    for (const variant of Object.keys(BUTTON_VARIANT_CLASS) as (keyof typeof BUTTON_VARIANT_CLASS)[]) {
      expect(BUTTON_VARIANT_TEXT_CLASS[variant].split(' ')).toContain(
        BUTTON_VARIANT_SPINNER_CLASS[variant],
      )
    }
  })

  it('sm: 상자가 14/6 으로 줄고 라벨이 13px 이 된다', async () => {
    const { getByRole, getByText } = await renderAtom(
      <Button variant="primary" size="sm">
        확인
      </Button>,
    )

    expect(flattenStyle(getByRole('button').props.style)).toMatchObject({
      paddingLeft: 14,
      paddingRight: 14,
      paddingTop: 6,
      paddingBottom: 6,
    })
    // 변형 표의 `text-sm` 을 실제로 이기는지 본다. 글자 크기는 덮이고 여백은 안 덮이는데,
    // 그 차이가 조용해서 여기서 값으로 못박는다.
    expect(flattenStyle(getByText('확인').props.style).fontSize).toBe(13)
  })

  it('크기 표에는 색도 글자 유틸도 없다', () => {
    for (const box of Object.values(BUTTON_SIZE_CLASS)) {
      expect(box).not.toMatch(/(^|\s)(bg-|border-|rounded-|font-)/)
    }
  })
})
