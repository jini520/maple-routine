// 하단바의 «층과 뒤로가기» 규칙([[ADR-132]] 결정 2~6). **화면이 아니라 규칙**이 대상이라
// 순수 함수만 부른다 — 이 파일이 그 결정의 실행 가능한 명세다.
//
// 사용자가 준 예시 둘이 그대로 테스트로 있다(`설정 → 스케줄 → ← → 설정` ·
// `유틸리티 → 가계부 → ← → 유틸리티`). 그리고 **셋째 예시가 이 설계의 축**이다 —
// *"유틸리티 → 설정 → 뒤로가기 → 유틸리티로 적용되진 않아"*: 같은 층의 옆걸음은 안 쌓인다.
import { INITIAL_TAB_ROUTE, TAB_ROUTE_NAMES } from '../routes'
import {
  BAR_GROUPS,
  barLayer,
  canGoBack,
  groupById,
  groupOfPage,
  initialBarState,
  openPage,
  pressBack,
  pressGroup,
  pressSub,
  type BarState,
} from '../bar-model'

/** 테스트 가독성을 위한 조립기 — 기본은 앱을 막 켠 상태다. */
function at(page: BarState['page'], patch: Partial<BarState> = {}): BarState {
  return { ...initialBarState(), page, ...patch }
}

describe('그룹 표 ([[ADR-132]] 결정 1)', () => {
  it('그룹은 다섯이고 순서가 곧 바의 순서다', () => {
    expect(BAR_GROUPS.map((group) => group.id)).toEqual([
      'today',
      'schedule',
      'ledger',
      'utility',
      'settings',
    ])
  })

  // 하위가 있으면 그룹 자신은 페이지가 아니고, 없으면 그룹이 곧 페이지다. 둘 다이거나 둘 다
  // 아닌 그룹이 생기면 «층» 판정이 답을 못 낸다.
  it('하위가 있는 그룹은 자기 페이지를 갖지 않는다 — 그 반대도 같다', () => {
    for (const group of BAR_GROUPS) {
      if (group.subs.length > 0) expect(group.page).toBeNull()
      else expect(group.page).not.toBeNull()
    }
  })

  // [[ADR-145]] 결정 1 — 헤더 버튼으로만 열리던 화면이 컨텐츠·보스와 나란한 셋째 하위가 된다.
  // 순서까지 고정하는 이유는 그것이 곧 바에 그려지는 순서이기 때문이다.
  it('스케줄 하위는 컨텐츠·보스·보스 관리 셋이다', () => {
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

describe('층은 «지금 페이지» 가 정한다 (결정 2)', () => {
  it('하위를 가진 그룹의 페이지에 있으면 하위 행이다', () => {
    expect(barLayer(at('Content'))).toBe('sub')
    expect(barLayer(at('Boss'))).toBe('sub')
    expect(barLayer(at('BossManage'))).toBe('sub')
    expect(barLayer(at('Profit'))).toBe('sub')
    expect(barLayer(at('Spend'))).toBe('sub')
  })

  it('하위가 없는 그룹의 페이지에 있으면 그룹 행이다', () => {
    expect(barLayer(at('Today'))).toBe('group')
    expect(barLayer(at('Utility'))).toBe('group')
    expect(barLayer(at('Settings'))).toBe('group')
  })
})

describe('← 는 하위 행에만 선다 (결정 3)', () => {
  it('그룹 행에서는 갈 곳이 없다', () => {
    expect(canGoBack(at('Today'))).toBe(false)
    expect(canGoBack(at('Utility'))).toBe(false)
    expect(canGoBack(at('Settings'))).toBe(false)
  })

  it('하위 행에서는 기록이 없어도 선다 — 그룹 행을 여는 몫이 있다 (결정 5)', () => {
    expect(canGoBack(at('Content'))).toBe(true)
    expect(canGoBack(at('Content', { showGroups: true }))).toBe(false)
  })
})

describe('기록은 «한 층 내려갈 때»만 남는다 (결정 4)', () => {
  it('설정 → 스케줄 → ← → 설정', () => {
    const start = at('Settings')

    const inSchedule = pressGroup(start, 'schedule')
    expect(inSchedule.page).toBe('Content')
    expect(inSchedule.history).toEqual(['Settings'])
    expect(canGoBack(inSchedule)).toBe(true)

    const back = pressBack(inSchedule)
    expect(back.page).toBe('Settings')
    expect(back.history).toEqual([])
    expect(barLayer(back)).toBe('group')
  })

  it('유틸리티 → 가계부 → ← → 유틸리티', () => {
    const inLedger = pressGroup(at('Utility'), 'ledger')
    expect(inLedger.page).toBe('Profit')
    expect(inLedger.history).toEqual(['Utility'])

    expect(pressBack(inLedger).page).toBe('Utility')
  })

  // **이 설계의 축.** 둘 다 하위가 없어 같은 층이고, 도착지엔 ← 자체가 없다.
  it('유틸리티 → 설정 은 쌓이지 않는다 — 그리고 ← 도 없다', () => {
    const inSettings = pressGroup(at('Utility'), 'settings')

    expect(inSettings.page).toBe('Settings')
    expect(inSettings.history).toEqual([])
    expect(canGoBack(inSettings)).toBe(false)
    expect(pressBack(inSettings)).toEqual(inSettings)
  })

  it('하위끼리 이동은 쌓이지 않는다 — ← 는 그룹에 들어오기 전 자리로 나간다', () => {
    const inLedger = pressGroup(at('Utility'), 'ledger')

    const onHunting = pressSub(inLedger, 'HuntingProfit')
    const onSpend = pressSub(onHunting, 'Spend')

    expect(onSpend.page).toBe('Spend')
    expect(onSpend.history).toEqual(['Utility'])
    expect(pressBack(onSpend).page).toBe('Utility')
  })

  it('같은 그룹을 다시 눌러도 쌓이지 않는다', () => {
    const opened = pressGroup(at('Content', { showGroups: true }), 'schedule')

    expect(opened.page).toBe('Content')
    expect(opened.history).toEqual([])
    expect(barLayer(opened)).toBe('sub')
  })

  it('마지막으로 보던 하위를 기억한다', () => {
    const onBoss = pressSub(at('Content'), 'Boss')
    const away = pressGroup(onBoss, 'settings')

    expect(pressGroup(away, 'schedule').page).toBe('Boss')
  })
})

describe('기록이 없으면 ← 는 그룹 행을 연다 (결정 5)', () => {
  it('페이지는 그대로 두고 층만 올린다', () => {
    const opened = pressBack(at('Content'))

    expect(opened.page).toBe('Content')
    expect(opened.showGroups).toBe(true)
    expect(barLayer(opened)).toBe('group')
  })

  it('그 상태에서 다른 그룹으로 가면 «← 를 누른 시점의 자리» 가 적힌다', () => {
    const opened = pressBack(at('Content'))
    const inLedger = pressGroup(opened, 'ledger')

    expect(inLedger.history).toEqual(['Content'])
    expect(pressBack(inLedger).page).toBe('Content')
  })
})

// 결정 9 의 `shouldGateAd` 테스트 넷이 여기 있었다 — 그룹 이동만 참 · 하위/재탭 거짓 · **뒤로가기도
// 그룹을 바꾸므로 거짓**(그 기대가 «상태 델타가 아니라 조작을 본다» 는 설계를 끌어냈다).
// [[ADR-150]] 이 전면광고를 걷으며 함수와 함께 지웠다.

describe('openPage — 바를 거치지 않은 이동 ([[ADR-132]] 결정 4)', () => {
  // 증상: today 위젯으로 보스 수익에 간 뒤 ← 를 누르면 today 가 아니라 **가계부가 활성인 채로**
  // 그룹 행만 열렸다. 기록이 비어 있어 결정 5 의 안전망에 걸린 것이다.
  it('하위를 가진 그룹으로 내려가면 온 자리를 적는다 — ← 가 그리로 돌아간다', () => {
    const start = initialBarState()

    const opened = openPage(start, 'Profit')
    expect(opened.page).toBe('Profit')
    expect(opened.history).toEqual(['Today'])

    expect(pressBack(opened)).toMatchObject({ page: 'Today', history: [], showGroups: false })
  })

  it('하위가 없는 그룹으로 가면 같은 층의 옆걸음이라 기록을 비운다', () => {
    const withHistory = { ...initialBarState(), page: 'Profit' as const, history: ['Today' as const] }

    expect(openPage(withHistory, 'Settings')).toMatchObject({ page: 'Settings', history: [] })
  })

  it('같은 그룹 안의 이동은 쌓지 않는다 — 하위 옆걸음이다', () => {
    const inLedger = { ...initialBarState(), page: 'Profit' as const, history: ['Today' as const] }

    expect(openPage(inLedger, 'HuntingProfit')).toMatchObject({
      page: 'HuntingProfit',
      history: ['Today'],
    })
  })

  it('같은 페이지면 그룹 행만 닫는다', () => {
    const opened = { ...initialBarState(), page: 'Profit' as const, showGroups: true }

    expect(openPage(opened, 'Profit')).toMatchObject({ page: 'Profit', showGroups: false })
  })

  // 프로그램 이동이 «마지막으로 본 하위» 를 안 건드리는 것은 [[ADR-145]] 대가 · [[ADR-140]] 결정 1
  // 의 CTA 와 같은 성질이라 여기서 뒤집지 않는다 — 이 함수가 고치는 것은 뒤로 갈 자리 하나뿐이다.
  it('lastSub 는 건드리지 않는다', () => {
    const start = initialBarState()

    expect(openPage(start, 'Profit').lastSub).toEqual(start.lastSub)
  })
})
