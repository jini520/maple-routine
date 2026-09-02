// **탭 층도 벽지를 들어야 한다** (의 짝).
//
// 안드로이드는 화면을 **불투명**하게 칠하고(전환 중 아래 화면이 비치는 것을 막으려고) 벽지를
// 화면마다 들려 보낸다. 그 «화면» 은 **자기 컨테이너를 칠하는 내비게이터마다** 생긴다 — 불투명
// 배경은 `NavigationContainer` 테마라 **모든** 내비게이터에 걸리는데, 벽지는 `screenLayout` 을 준
// 내비게이터에만 걸리기 때문이다.
//
//  이 탭 위에 층 스택을 새로 끼우면서 `screenLayout` 을 그 **스택에만** 뒀고, 그 안의
// 탭 내비게이터 셋이 자기 화면을 불투명하게 칠해 **층이 깐 벽지를 덮었다.** 1.0.7 에서 테마 배경이
// 안드로이드에서만 사라진 것이 그것이다(1.0.6 에서는 나왔다 — 사용자 확인).
//
// 그래서 지키는 것은 «컴포넌트가 있는가» 가 아니라 **«화면을 칠하는 내비게이터가 그것을 두르는가»**
// 다. 짝이 다시 갈라지면 여기서 걸린다.
import { TAB_LAYER_PROPS } from '../tab-layer-props'

describe('탭 층이 벽지를 든다', () => {
  it('세 탭 내비게이터가 공유하는 props 가 `screenLayout` 을 든다', () => {
    expect(TAB_LAYER_PROPS).toHaveProperty('screenLayout')
    expect(typeof TAB_LAYER_PROPS.screenLayout).toBe('function')
  })

  // 층 스택에만 있으면 탭 화면의 불투명 배경이 그것을 덮는다 — 그 상태가 1.0.7 회귀였다.
  it('그 `screenLayout` 이 자식을 벽지로 감싼다', () => {
    const rendered = TAB_LAYER_PROPS.screenLayout({ children: null } as never)

    expect(rendered).toBeTruthy()
    expect(String((rendered as { type: { name?: string } }).type?.name)).toContain('ScreenBackdrop')
  })
})
