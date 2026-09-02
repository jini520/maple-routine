// 하단바의 **층과 뒤로가기** 규칙 — 이 층의 소유자를 바꾼 뒤의 명세.
//
// **무엇이 달라졌나.** 예전에는 이 함수들이 새 `BarState` 를 만들었고 바가 그것을 적용했다. 층을
// 스택이 들면(결정 1) 상태는 react-navigation 것이므로, 같은 함수들이 **무엇을 할지(BarIntent)**
// 를 돌려준다. 규칙이 여전히 순수 함수라는 것 — 판정을 물으려고 렌더가 필요하지 않다는 것 —
// 은 그대로다(`bar-model.ts` 머리말).
//
// 사용자가 준 예시 셋이 그대로 남아 있다(`설정 → 스케줄러 → ← → 설정` ·
// `유틸리티 → 수익·지출 → ← → 유틸리티` · **`유틸리티 → 설정 → ← 은 안 된다`**). 셋째가 이
// 설계의 축이다 — 같은 층의 옆걸음은 쌓이지 않는다.
import { INITIAL_TAB_ROUTE, TAB_ROUTE_NAMES, LAYER_ROUTE_NAMES } from '../routes'
import {
  BAR_GROUPS,
  barLayer,
  canGoBack,
  groupById,
  groupOfPage,
  initialBarState,
  layerOfPage,
  openPage,
  pressBack,
  pressGroup,
  pressSub,
  rememberSub,
  visibleSubs,
  type BarState,
} from '../bar-model'

/** 테스트 가독성을 위한 조립기 — 기본은 앱을 막 켠 상태다. */
function at(page: BarState['page'], patch: Partial<BarState> = {}): BarState {
  return { ...initialBarState(), page, ...patch }
}

describe('그룹 표', () => {
  it('그룹은 다섯이고 순서가 곧 바의 순서다', () => {
    expect(BAR_GROUPS.map((group) => group.id)).toEqual([
      'today',
      'schedule',
      'ledger',
      'utility',
      'settings',
    ])
  })

  // 라벨을 여기서 고정하는 이유는 바가 그것을 **두 층에서** 쓰기 때문이다 — 그룹 행의 글자와
  // `accessibilityLabel`(`BottomBar` 의 `BarItem`).
  it('그룹 라벨 다섯을 고정한다', () => {
    expect(BAR_GROUPS.map((group) => group.label)).toEqual([
      'today',
      '스케줄러',
      '수익·지출',
      '유틸리티',
      '설정',
    ])
  })

  // 하위가 있으면 그룹 자신은 페이지가 아니고, 없으면 그룹이 곧 페이지다. 둘 다이거나 둘 다
  // 아닌 그룹이 생기면 **층** 판정이 답을 못 낸다.
  it('하위가 있는 그룹은 자기 페이지를 갖지 않는다 — 그 반대도 같다', () => {
    for (const group of BAR_GROUPS) {
      if (group.subs.length > 0) expect(group.page).toBeNull()
      else expect(group.page).not.toBeNull()
    }
  })

  // 하위를 가진 그룹만 자기 **층 화면** 을 갖는다. 이 둘이 짝이 아니면
  // 그룹을 눌렀을 때 push 할 자리가 없거나, 아무도 안 쓰는 층 화면이 생긴다.
  it('층 화면은 하위를 가진 그룹에만 있다 — 그리고 표의 이름과 일치한다', () => {
    for (const group of BAR_GROUPS) {
      if (group.subs.length > 0) expect(group.layer).not.toBeNull()
      else expect(group.layer).toBeNull()
    }

    const layers = BAR_GROUPS.flatMap((group) => (group.layer === null ? [] : [group.layer]))
    expect(layers).toEqual(['ScheduleSubs', 'LedgerSubs'])
    // 그룹 층까지 더하면 층 화면 표와 정확히 같다.
    expect(['Groups', ...layers]).toEqual([...LAYER_ROUTE_NAMES])
  })

  // 헤더 버튼으로만 열리던 화면이 컨텐츠·보스와 나란한 셋째 하위가 된다.
  it('스케줄러 하위는 컨텐츠·보스·보스 관리 셋이다', () => {
    expect(groupById('schedule').subs).toEqual([
      { page: 'Content', label: '컨텐츠' },
      { page: 'Boss', label: '보스' },
      { page: 'BossManage', label: '보스 관리' },
    ])
  })

  it('탭 화면 아홉이 표에 정확히 한 번씩 나온다', () => {
    const pages = BAR_GROUPS.flatMap((group) =>
      group.page === null ? group.subs.map((sub) => sub.page) : [group.page],
    )

    expect(new Set(pages).size).toBe(pages.length)
    expect(pages.slice().sort()).toEqual(TAB_ROUTE_NAMES.slice().sort())
  })

  it('첫 화면은 today 다 (결정 7)', () => {
    expect(INITIAL_TAB_ROUTE).toBe('Today')
    expect(initialBarState().page).toBe('Today')
    expect(groupOfPage('Today').id).toBe('today')
  })
})

// 어느 페이지가 어느 층 화면 안에 사는가 — 화면이 **탭으로 가고 싶다** 고 말할 때 그것을 중첩
// 이동으로 옮기는 유일한 표다(`use-open-tab.ts`).
describe('layerOfPage — 페이지가 사는 층 화면', () => {
  it('하위가 없는 그룹의 페이지는 그룹 층에 산다', () => {
    expect(layerOfPage('Today')).toBe('Groups')
    expect(layerOfPage('Utility')).toBe('Groups')
    expect(layerOfPage('Settings')).toBe('Groups')
  })

  it('하위는 자기 그룹의 층 화면에 산다', () => {
    expect(layerOfPage('Content')).toBe('ScheduleSubs')
    expect(layerOfPage('BossManage')).toBe('ScheduleSubs')
    expect(layerOfPage('Profit')).toBe('LedgerSubs')
    expect(layerOfPage('Cashbook')).toBe('LedgerSubs')
  })
})

describe('층은 **지금 페이지** 가 정한다 (결정 2)', () => {
  it('하위를 가진 그룹의 페이지에 있으면 하위 행이다', () => {
    expect(barLayer(at('Content'))).toBe('sub')
    expect(barLayer(at('Boss'))).toBe('sub')
    expect(barLayer(at('BossManage'))).toBe('sub')
    expect(barLayer(at('Profit'))).toBe('sub')
    expect(barLayer(at('Cashbook'))).toBe('sub')
  })

  it('하위가 없는 그룹의 페이지에 있으면 그룹 행이다', () => {
    expect(barLayer(at('Today'))).toBe('group')
    expect(barLayer(at('Utility'))).toBe('group')
    expect(barLayer(at('Settings'))).toBe('group')
  })

  it('하위 행이 보여 주는 항목은 그 그룹의 하위다 — 그룹 행이면 비어 있다', () => {
    expect(visibleSubs(at('Boss')).map((sub) => sub.page)).toEqual(['Content', 'Boss', 'BossManage'])
    expect(visibleSubs(at('Today'))).toEqual([])
  })
})

describe('← 는 하위 행에만 선다 (결정 3)', () => {
  it('그룹 행에서는 갈 곳이 없다', () => {
    expect(canGoBack(at('Today'))).toBe(false)
    expect(canGoBack(at('Utility'))).toBe(false)
    expect(canGoBack(at('Settings'))).toBe(false)
    expect(pressBack(at('Today'))).toEqual({ kind: 'none' })
  })

  // **`showGroups` 가 사라진 자리다**. 예전에는 **기록이 없는데 하위 행에
  // 있다** 는 상태가 가능해 ← 가 **페이지는 그대로 두고 그룹 행만 올리는** 안전망으로 떨어졌다.
  // 층이 스택이면 하위 행에 있다는 것이 곧 스택 깊이 ≥ 1 이라 그 상태가 만들어질 길이 없다.
  it('하위 행에서는 언제나 선다 — 되돌아갈 단이 반드시 있다', () => {
    expect(canGoBack(at('Content'))).toBe(true)
    expect(pressBack(at('Content'))).toEqual({ kind: 'back' })
  })
})

describe('그룹을 누르면 (결정 4 ·3)', () => {
  it('설정 → 스케줄러 는 한 층 내려간다 — 그 단이 곧 뒤로 갈 자리다', () => {
    expect(pressGroup(at('Settings'), 'schedule')).toEqual({
      kind: 'openSubs',
      layer: 'ScheduleSubs',
      page: 'Content',
    })
  })

  it('유틸리티 → 수익·지출 도 같다', () => {
    expect(pressGroup(at('Utility'), 'ledger')).toEqual({
      kind: 'openSubs',
      layer: 'LedgerSubs',
      page: 'Profit',
    })
  })

  // **이 설계의 축.** 둘 다 하위가 없어 같은 층이고, 도착지엔 ← 자체가 없다.
  it('유틸리티 → 설정 은 같은 층의 옆걸음이다 — 쌓이지 않고 ← 도 없다', () => {
    expect(pressGroup(at('Utility'), 'settings')).toEqual({
      kind: 'switchGroupPage',
      page: 'Settings',
    })
    expect(canGoBack(at('Settings'))).toBe(false)
  })

  // 하위 행에서 그룹 층 그룹을 누르면 **한 층 올라가면서** 옆걸음한다 — 적용부가 그룹 층으로
  // 되돌아가며 그 페이지를 연다(한 번의 이동이다).
  it('하위 행에서 하위 없는 그룹을 누르면 그룹 층으로 올라간다', () => {
    expect(pressGroup(at('Boss'), 'today')).toEqual({ kind: 'switchGroupPage', page: 'Today' })
  })

  it('같은 그룹을 다시 누르면 아무 일도 없다', () => {
    expect(pressGroup(at('Content'), 'schedule')).toEqual({ kind: 'none' })
    expect(pressGroup(at('Today'), 'today')).toEqual({ kind: 'none' })
  })

  it('마지막으로 보던 하위로 들어간다', () => {
    const remembered = at('Settings', { lastSub: { schedule: 'Boss' } })

    expect(pressGroup(remembered, 'schedule')).toMatchObject({ page: 'Boss' })
  })
})

describe('하위끼리는 같은 단 안의 옆걸음이다', () => {
  it('컨텐츠 → 보스 는 쌓지 않는다', () => {
    expect(pressSub(at('Content'), 'Boss')).toEqual({ kind: 'switchSub', page: 'Boss' })
  })

  it('같은 하위를 다시 누르면 아무 일도 없다', () => {
    expect(pressSub(at('Boss'), 'Boss')).toEqual({ kind: 'none' })
  })

  // 옆걸음을 몇 번 하든 ← 는 여전히 **그룹에 들어오기 전 자리** 로 나간다 — 스택이 안 자라기
  // 때문이다. 그 성질을 여기서는 **← 가 여전히 한 번이면 된다** 로 못 박는다.
  it('옆걸음 뒤에도 ← 는 한 단이다', () => {
    expect(canGoBack(at('Cashbook'))).toBe(true)
    expect(pressBack(at('Cashbook'))).toEqual({ kind: 'back' })
  })
})

describe('rememberSub — 다시 들어갈 자리', () => {
  // 그룹을 나가면 그 단이 언마운트되므로 **어느 하위였나** 는 우리가 기억해야 한다. `lastSub` 가
  // 스택으로 옮겨가지 못하고 남은 유일한 값이다.
  it('하위 페이지를 적는다', () => {
    expect(rememberSub({}, 'Boss')).toEqual({ schedule: 'Boss' })
    expect(rememberSub({ schedule: 'Boss' }, 'Cashbook')).toEqual({ schedule: 'Boss', ledger: 'Cashbook' })
  })

  it('그룹 층 페이지는 기억할 것이 없다 — 그대로 돌려준다', () => {
    const before = { schedule: 'Boss' } as const

    expect(rememberSub(before, 'Today')).toBe(before)
  })
})

describe('openPage — 바를 거치지 않은 이동', () => {
  // 증상이었던 것: today 위젯으로 보스 수익에 간 뒤 ← 를 누르면 today 가 아니라 **가계부가 활성인
  // 채로** 그룹 행만 열렸다. 기록을 **바를 눌러 내려갈 때만** 적었기 때문이다. 층이 스택이면 위젯
  // 타일도 그냥 한 단 내려가는 이동이라 그 갈래 자체가 없어진다 — 규칙이 `pressGroup` 과 같다.
  it('하위를 가진 그룹으로 가면 한 층 내려간다', () => {
    expect(openPage(initialBarState(), 'Profit')).toEqual({
      kind: 'openSubs',
      layer: 'LedgerSubs',
      page: 'Profit',
    })
  })

  it('그룹 층 페이지로 가면 옆걸음이다', () => {
    expect(openPage(at('Profit'), 'Settings')).toEqual({ kind: 'switchGroupPage', page: 'Settings' })
  })

  it('같은 그룹 안이면 하위 옆걸음이다', () => {
    expect(openPage(at('Profit'), 'Cashbook')).toEqual({
      kind: 'switchSub',
      page: 'Cashbook',
    })
  })

  it('같은 페이지면 아무 일도 없다', () => {
    expect(openPage(at('Profit'), 'Profit')).toEqual({ kind: 'none' })
  })

  // `pressGroup` 과 달리 **목적지를 지목한다** — `lastSub` 를 보지 않는다. 위젯은 **보스 수익** 처럼
  // 특정 페이지를 가리키기 때문이다(대가 의 CTA 와 같은 성질).
  it('기억된 하위가 있어도 지목한 페이지로 간다', () => {
    const remembered = at('Today', { lastSub: { ledger: 'Cashbook' } })

    expect(openPage(remembered, 'Profit')).toMatchObject({ page: 'Profit' })
  })
})
