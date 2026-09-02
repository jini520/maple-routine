// 층 스택의 상태에서 **지금 페이지** 를 뽑는 규칙 —.
//
// 바는 층 스택의 `layout` 이 그린다. 그래서 그 내비게이터의 **상태를 그대로 받는다**. 거기서
// 가장 안쪽 화면 이름을 뽑는 훑기가 이 파일의 대상이고, 순수 함수라 렌더 없이 못 박는다 —
// 페이지의 진실 공급원은 여전히 react-navigation 하나이고 우리는 읽기만 한다.

import { pageFromLayerState, type NavRouteLike, type NavStateLike } from '../current-page'

/** 층 스택 한 단짜리 상태. */
function layer(top: NavRouteLike): NavStateLike {
  return { index: 0, routes: [top] }
}

/** 중첩 상태가 붙은 라우트 조립기 — react-navigation 이 주는 모양 그대로다. */
function route(name: string, inner?: NavRouteLike, params?: Record<string, unknown>): NavRouteLike {
  return {
    name,
    params,
    state: inner === undefined ? undefined : { index: 0, routes: [inner] },
  }
}

describe('pageFromLayerState — 가장 안쪽 화면이 곧 지금 페이지다', () => {
  it('그룹 층의 화면을 읽는다', () => {
    expect(pageFromLayerState(layer(route('Groups', route('Today'))))).toBe('Today')
    expect(pageFromLayerState(layer(route('Groups', route('Settings'))))).toBe('Settings')
  })

  it('하위 층의 화면을 읽는다 — 한 단 더 깊어도 같다', () => {
    expect(pageFromLayerState(layer(route('ScheduleSubs', route('Boss'))))).toBe('Boss')
    expect(pageFromLayerState(layer(route('LedgerSubs', route('Cashbook'))))).toBe('Cashbook')
  })

  // 층 스택이 여러 단이면 **맨 위**가 지금이다. `index` 가 그것을 가리킨다.
  it('층이 쌓여 있으면 맨 위 단을 본다', () => {
    const stacked: NavStateLike = {
      index: 1,
      routes: [route('ScheduleSubs', route('Content')), route('LedgerSubs', route('Profit'))],
    }

    expect(pageFromLayerState(stacked)).toBe('Profit')
  })

  // 중첩 내비게이터는 첫 프레임에 아직 상태가 없을 수 있다. 그때는 이동에 실어 보낸 `screen`
  // 파라미터가 답을 갖고 있다. 우리는 언제나 그것을 명시해 이동한다.
  it('안쪽 상태가 아직 없으면 params.screen 을 읽는다', () => {
    const pending: NavStateLike = {
      index: 0,
      routes: [{ name: 'LedgerSubs', params: { screen: 'Cashbook' } }],
    }

    expect(pageFromLayerState(pending)).toBe('Cashbook')
  })

  // 마지막 안전망 — 둘 다 없으면 그 층의 첫 화면이다. 표에서 나오므로 지어낸 값이 아니다.
  it('상태도 파라미터도 없으면 그 층의 첫 화면이다', () => {
    const bare: NavStateLike = { index: 0, routes: [{ name: 'ScheduleSubs' }] }

    expect(pageFromLayerState(bare)).toBe('Content')
  })

  it('층 스택 자체가 아직 없으면 첫 화면(today)이다', () => {
    expect(pageFromLayerState(undefined)).toBe('Today')
    expect(pageFromLayerState({ index: 0, routes: [] })).toBe('Today')
  })

  // 알 수 없는 이름이 오면 지어내지 않고 첫 화면으로 떨어진다. 바가 던지면 앱이 통째로 죽는다.
  it('표에 없는 이름은 첫 화면으로 떨어진다', () => {
    expect(pageFromLayerState(layer(route('Groups', route('없는화면'))))).toBe('Today')
  })
})
