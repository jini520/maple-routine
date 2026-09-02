// 입력 atom 이 **실제로 그 프롭을 달고 나가는가**. 산수는 `Text/font-scaling.test.ts` 가 보고,
// 여기서는 배선만 본다. 계산이 맞아도 프롭이 안 붙으면 화면은 그대로 옛 동작이다.
//
// 시트 안에서의 초점 배선은 옆 파일(`TextInput.sheet.test.tsx`)이 본다.
//
// ## 배수는 `Dimensions.get('window')` 를 통해 흘려 넣는다
//
// `useWindowDimensions()` 는 초기값을 그 호출에서 얻으므로, 그 하나만 목으로 덮으면 시스템 글자
// 크기가 그렇게 설정된 기기를 만들 수 있다. 훅 자체를 목으로 안 덮는 것은 `react-native` 의
// export 가 게터라 `jest.spyOn` 이 안 걸리기 때문이다.
import { Dimensions } from 'react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { FONT_SCALE_MAX } from '../../Text/font-scaling'
import { TextInput } from '../TextInput'

/** 시스템 글자 크기가 `fontScale` 로 설정된 기기를 만든다. */
function 시스템_글자배수(fontScale: number): void {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('TextInput: 같은 클램프를 받는다', () => {
  it('작게 설정한 기기에서는 스케일링을 끈다', async () => {
    시스템_글자배수(0.823)
    const { getByTestId } = await renderAtom(<TextInput testID="키" value="" />)

    expect(getByTestId('키').props.allowFontScaling).toBe(false)
  })

  it('크게 설정한 기기에서는 상한을 건다', async () => {
    시스템_글자배수(2)
    const { getByTestId } = await renderAtom(<TextInput testID="키" value="" />)

    expect(getByTestId('키').props.allowFontScaling).toBe(true)
    expect(getByTestId('키').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })
})

/**
 * **조합이 도는 칸에는 앱이 글자를 되쓰지 않는다**.
 *
 * 한글은 IME 가 칸 안의 조합 중 구간을 갈아 끼우며 완성된다. 그 자리에 앱이 `value` 로 글자를
 * 되쓰면 모으던 자모가 그대로 확정된다. 안녕이 ㅇㅏㄴㄴㅕㅇ이 됐다(실기·에뮬레이터 양쪽).
 *
 * 계측으로 가른 갈림은 **`value` 프롭이 붙어 있는가** 하나였다. 그래서 아톰은 키보드로 갈라
 * 붙인다. 숫자 키패드는 조합이 없고 서식(`1,234`)을 위해 되쓰기가 **필요하다**.
 *
 * 여기서 프롭을 보는 이유는 늘 같다: 계산이 맞아도 프롭이 안 붙으면 화면은 옛 동작이다.
 */
describe('TextInput: 조합이 도는 칸은 value 를 씨앗으로만 받는다', () => {
  it('글자 칸은 defaultValue 로 심고 value 를 안 단다', async () => {
    const { getByTestId } = await renderAtom(<TextInput testID="이름" value="단풍" />)

    expect(getByTestId('이름').props.defaultValue).toBe('단풍')
    expect(getByTestId('이름').props.value).toBeUndefined()
  })

  it('숫자 키패드 칸은 종전대로 value 로 통제한다. 서식이 살아야 한다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="금액" value="1,234" keyboardType="number-pad" />,
    )

    expect(getByTestId('금액').props.value).toBe('1,234')
    expect(getByTestId('금액').props.defaultValue).toBeUndefined()
  })

  it('숫자 갈래 넷을 모두 통제한다', async () => {
    for (const keyboardType of ['number-pad', 'numeric', 'decimal-pad', 'phone-pad'] as const) {
      const { getByTestId } = await renderAtom(
        <TextInput testID="칸" value="7" keyboardType={keyboardType} />,
      )

      expect(getByTestId('칸').props.value).toBe('7')
    }
  })

  it('이메일처럼 글자를 치는 키보드는 조합이 도는 쪽이다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="메일" value="a@b.c" keyboardType="email-address" />,
    )

    expect(getByTestId('메일').props.defaultValue).toBe('a@b.c')
    expect(getByTestId('메일').props.value).toBeUndefined()
  })
})

/**
 * **칸의 상자는 두 플랫폼이 같아야 한다**.
 *
 * 치수를 안 주면 안드로이드는 EditText 기본 패딩 + 글꼴 패딩을 얹어 **41.14dp**, iOS 는 **20.00pt**
 * 였다(같은 시트·같은 칸 실측). 셋을 끄면 20.19dp 로 내려와 맞는다.
 *
 * 여기서 프롭을 보는 이유는 늘 같다. 계산이 맞아도 프롭이 안 붙으면 화면은 옛 동작이다.
 */
describe('TextInput: 플랫폼 기본 상자를 지운다', () => {
  it('패딩·글꼴 패딩을 끄고 글자를 가운데 세운다', async () => {
    const { getByTestId } = await renderAtom(<TextInput testID="칸" value="" />)

    expect(flattenStyle(getByTestId('칸').props.style)).toMatchObject({
      padding: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
    })
  })

  it('호출부가 준 치수가 이긴다. 기본값은 **앞**에 깔린다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="칸" value="" style={{ paddingVertical: 8 }} />,
    )

    expect(flattenStyle(getByTestId('칸').props.style)).toMatchObject({ paddingVertical: 8 })
  })
})

/**
 * 자리표시자 색.
 *
 * 안 주면 RN 이 플랫폼 기본값을 쓰는데, `app.json` 이 `userInterfaceStyle: "automatic"` 이라 그
 * 값이 **OS 외관**을 따른다. OS 가 라이트인 채 앱 테마만 다크면 iOS 가 `#1A1A1C`(대비 1.13)를
 * 그려 **안 보인다**(사용자 보고 2026-08-29). 테마와 무관하게 정해지는 값이 테마 위에 앉는 자리라
 * 아톰이 못 박는다.
 *
 * **`className` 이 아니라 프롭인 이유**: NativeWind 의 `placeholder:` 변형은 native 프리셋에서만
 * `placeholderTextColor` 로 컴파일되는데, jest 의 `globalSetup` 은 `NATIVEWIND_OS` 를 안 세워 web
 * 프리셋으로 돈다. 앱에서는 되지만 **여기서는 못 본다**(실측). 프롭이면 두 경로가 같다.
 *
 * 색을 손으로 적지 않는다. `job-themes.json` 에서 읽는다.
 */
describe('TextInput: 자리표시자 색을 아톰이 건다', () => {
  it('테마의 `text-disabled` 로 그린다. 힌트이지 값이 아니다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="칸" value="" placeholder="아이템 명" />,
    )

    expect(getByTestId('칸').props.placeholderTextColor).toBe(기본테마.textDisabled)
  })

  // 아톰이 안 걸면 그 자리만 조용히 플랫폼 기본값으로 남는다. 이 아톰이 존재하는 이유가 그것이다.
  it('자리표시자가 없는 칸에도 값이 붙는다. 빠지는 자리를 안 만든다', async () => {
    const { getByTestId } = await renderAtom(<TextInput testID="칸" value="" />)

    expect(getByTestId('칸').props.placeholderTextColor).toBe(기본테마.textDisabled)
  })

  it('호출부가 직접 주면 그쪽이 이긴다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="칸" value="" placeholderTextColor={기본테마.errorInk} />,
    )

    expect(getByTestId('칸').props.placeholderTextColor).toBe(기본테마.errorInk)
  })
})
