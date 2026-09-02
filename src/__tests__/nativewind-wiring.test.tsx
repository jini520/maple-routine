// NativeWind 배선 — 이 파일이 지키는 것은 **디자인이 아니라 배선**이다(3단계).
//
// 검사하는 고리는 넷이고, 하나만 끊겨도 증상이 똑같다("`className` 이 조용히 무시된다"):
//   ① babel 프리셋이 JSX 를 NativeWind 런타임으로 넘기는가
//      (`babel.config.js` — 안 되면 `className` 이 그냥 모르는 프롭이 된다)
//   ② `global.css` 가 Tailwind 로 컴파일돼 스타일 데이터에 들어왔는가
//      (`jest.global-setup.js` + `jest.setup.js`)
//   ③ `rem` 이 **웹과 같은 16px** 로 굳었는가 (`nativewind.config.js` — 기본값 14 면 전부 12.5% 작다)
//   ④ 웹의 Tailwind v4 에만 있던 계단이 RN(v3)에도 서는가
//      (`tailwind-v4-axes.cjs` — `h-22` 는 v3 기본 스케일에 없어 그냥 사라진다)
//
// ③·④ 는 스냅샷이 아니라 명시적 단언으로 둔다. 스냅샷은 "달라졌다"만 말하고 "무엇이 맞는지"는 안
// 말하는데, 이 값들은 맞는 값이 정해져 있다(웹이 내는 값).
//
// ── 렌더 트리 스냅샷은 걷었다 ────────────────────────────────────────
//
// step 3~6 이 화면을 옮기는 동안 각 컴포넌트 테스트에 **렌더 트리 전체** 스냅샷을 하나씩 뒀다.
// 그것이 답하던 질문은 *"앞으로 안 바뀌는가"* 하나였고 — 웹뷰 앱과의 대조가 아니었다(RN 트리는
// DOM 과 구조가 달라 애초에 대조가 불가능하다) — **그 앞으로 가 끝났다.** 전환이 끝난 뒤로는
// 46개 파일 36,826줄이 **무엇이 맞는지** 는 한 마디도 안 하면서 경로가 바뀔 때마다 함께 흔들렸다.
//
// 위 ③·④ 가 처음부터 스냅샷을 안 쓴 이유가 그것을 미리 말하고 있다: **맞는 값이 정해져 있으면
// 그 값을 적어라.** 이 파일에 남은 단언들이 그 방식이다.
import { render } from '@testing-library/react-native'
import { Text, View } from 'react-native'

/**
 * `className` 만 있는 최소 컴포넌트. 프로덕션 컴포넌트 이식은 step 3 부터다.
 *
 * `h-22` 는 일부러 골랐다 — 파티 인원 모달 히어로 높이(88)이고 **Tailwind v3 기본
 * 스케일에는 없는 계단**이라, 축 파생이 끊기면 이 한 줄만 조용히 사라진다.
 */
function Probe() {
  return (
    <View className="h-22 gap-2 p-4" testID="probe">
      <Text className="text-sm font-semibold">배선 확인</Text>
    </View>
  )
}

/** `style` 프롭이 배열로도 오므로 평평하게 편다. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle)) as Record<string, unknown>
  }
  if (style !== null && typeof style === 'object') return style as Record<string, unknown>
  return {}
}

describe('NativeWind 배선', () => {
  it('`className` 이 붙은 컴포넌트를 렌더해도 죽지 않는다', async () => {
    await expect(render(<Probe />)).resolves.toBeDefined()
  })

  it('`className` 이 실제 RN 스타일로 풀린다', async () => {
    const { getByTestId, getByText } = await render(<Probe />)

    // 1rem = 16px · 0.875rem = 14px · 0.5rem = 8px. **웹과 같은 값이어야 한다** — NativeWind 기본
    // rem 은 14 라 그대로 두면 16/14/8 이 아니라 14/12.25/7 이 나온다.
    // (`gap` 은 RN 에 없어 `rowGap`/`columnGap` 으로 갈린다 — 값이 아니라 이름만 바뀐다.)
    expect(flattenStyle(getByTestId('probe').props.style)).toMatchObject({
      padding: 16,
      rowGap: 8,
      columnGap: 8,
    })

    expect(flattenStyle(getByText('배선 확인').props.style)).toMatchObject({
      fontSize: 14,
      lineHeight: 20,
    })
  })

  it('웹(Tailwind v4)에만 있던 계단도 선다', async () => {
    const { getByTestId } = await render(<Probe />)

    // `h-22` = 5.5rem = 88px. v3 기본 스케일에는 22 가 없어, 축 파생이 끊기면 `height` 자체가
    // 없어진다(값이 틀리는 게 아니라 사라진다 — 그래서 존재까지 함께 본다).
    expect(flattenStyle(getByTestId('probe').props.style)).toMatchObject({ height: 88 })
  })

})
