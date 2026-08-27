// 글자 atom 이 **실제로 그 프롭을 달고 나가는가**([[ADR-152]] 결정 4). 산수는 옆 파일
// (`font-scaling.test.ts`)이 보고, 여기서는 배선만 본다 — 계산이 맞아도 프롭이 안 붙으면
// 화면은 그대로 옛 동작이다.
//
// ## 배수는 `Dimensions.get('window')` 를 통해 흘려 넣는다
//
// `useWindowDimensions()` 는 초기값을 그 호출에서 얻으므로(`useWindowDimensions.js`), 그 하나만
// 목으로 덮으면 «시스템 글자 크기가 이렇게 설정된 기기» 를 만들 수 있다. 훅 자체를 목으로 덮지
// 않는 이유는 `react-native` 의 export 가 게터라 `jest.spyOn` 이 안 걸리기 때문이고, 무엇보다
// 이렇게 두면 **컴포넌트가 무엇을 읽는지** 를 테스트가 안 정해도 된다.
import { Dimensions } from 'react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { FONT_SCALE_MAX } from '../font-scaling'
import { Text, TextInput } from '../Text'

/** 시스템 글자 크기가 `fontScale` 로 설정된 기기를 만든다. */
function 시스템_글자배수(fontScale: number): void {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 390, height: 844, scale: 3, fontScale })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Text — 시스템 글자 배수를 [1.0, 1.235] 로 자른다 ([[ADR-152]])', () => {
  it('기본(1.0)에서는 스케일링을 켜고 상한만 건다', async () => {
    시스템_글자배수(1)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(true)
    expect(getByText('보스').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })

  it('작게 설정한 기기(0.823)에서는 스케일링을 끈다 — 하한 1.0', async () => {
    시스템_글자배수(0.823)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(false)
  })

  it('접근성 최대(3.571)에서도 상한은 1.235 다', async () => {
    시스템_글자배수(3.571)
    const { getByText } = await renderAtom(<Text>보스</Text>)

    expect(getByText('보스').props.allowFontScaling).toBe(true)
    expect(getByText('보스').props.maxFontSizeMultiplier).toBe(FONT_SCALE_MAX)
  })

  it('fixed 는 배수와 무관하게 끈다 — 칸에 묶인 글자(결정 5)', async () => {
    시스템_글자배수(3.571)
    const { getByText } = await renderAtom(<Text fixed>73</Text>)

    expect(getByText('73').props.allowFontScaling).toBe(false)
  })

  it('className 은 그대로 스타일로 풀린다 — 래퍼가 NativeWind 를 가리지 않는다', async () => {
    시스템_글자배수(1)
    const { getByText } = await renderAtom(<Text className="text-sm font-semibold">보스</Text>)

    expect(flattenStyle(getByText('보스').props.style)).toMatchObject({
      fontSize: 14,
      fontWeight: '600',
    })
  })

  it('나머지 Text 프롭은 그대로 통과한다', async () => {
    시스템_글자배수(1)
    const { getByTestId } = await renderAtom(
      <Text testID="라벨" numberOfLines={1}>
        보스
      </Text>,
    )

    expect(getByTestId('라벨').props.numberOfLines).toBe(1)
  })
})

describe('TextInput — 같은 클램프를 받는다 ([[ADR-152]] 결정 4)', () => {
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
 * **조합이 도는 칸에는 앱이 글자를 되쓰지 않는다**([[ADR-170]] 정정 12).
 *
 * 한글은 IME 가 칸 안의 「조합 중」 구간을 갈아 끼우며 완성된다. 그 자리에 앱이 `value` 로 글자를
 * 되쓰면 모으던 자모가 그대로 확정된다 — 「안녕」이 「ㅇㅏㄴㄴㅕㅇ」이 됐다(실기·에뮬레이터 양쪽).
 *
 * 계측으로 가른 갈림은 **`value` 프롭이 붙어 있는가** 하나였다. 그래서 아톰은 키보드로 갈라
 * 붙인다 — 숫자 키패드는 조합이 없고 서식(`1,234`)을 위해 되쓰기가 **필요하다**.
 *
 * 여기서 프롭을 보는 이유는 늘 같다: 계산이 맞아도 프롭이 안 붙으면 화면은 옛 동작이다.
 */
describe('TextInput — 조합이 도는 칸은 value 를 씨앗으로만 받는다 ([[ADR-170]] 정정 12)', () => {
  it('글자 칸은 defaultValue 로 심고 value 를 안 단다', async () => {
    const { getByTestId } = await renderAtom(<TextInput testID="이름" value="단풍" />)

    expect(getByTestId('이름').props.defaultValue).toBe('단풍')
    expect(getByTestId('이름').props.value).toBeUndefined()
  })

  it('숫자 키패드 칸은 종전대로 value 로 통제한다 — 서식이 살아야 한다', async () => {
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
 * **칸의 상자는 두 플랫폼이 같아야 한다**([[ADR-170]] 정정 13).
 *
 * 치수를 안 주면 안드로이드는 EditText 기본 패딩 + 글꼴 패딩을 얹어 **41.14dp**, iOS 는 **20.00pt**
 * 였다(같은 시트·같은 칸 실측). 셋을 끄면 20.19dp 로 내려와 맞는다.
 *
 * 여기서 프롭을 보는 이유는 늘 같다 — 계산이 맞아도 프롭이 안 붙으면 화면은 옛 동작이다.
 */
describe('TextInput — 플랫폼 기본 상자를 지운다 ([[ADR-170]] 정정 13)', () => {
  it('패딩·글꼴 패딩을 끄고 글자를 가운데 세운다', async () => {
    const { getByTestId } = await renderAtom(<TextInput testID="칸" value="" />)

    expect(flattenStyle(getByTestId('칸').props.style)).toMatchObject({
      padding: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
    })
  })

  it('호출부가 준 치수가 이긴다 — 기본값은 **앞**에 깔린다', async () => {
    const { getByTestId } = await renderAtom(
      <TextInput testID="칸" value="" style={{ paddingVertical: 8 }} />,
    )

    expect(flattenStyle(getByTestId('칸').props.style)).toMatchObject({ paddingVertical: 8 })
  })
})
