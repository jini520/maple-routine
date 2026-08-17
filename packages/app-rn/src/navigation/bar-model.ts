/**
 * 하단바의 «층과 뒤로가기» 규칙 — [[ADR-132]] 결정 2~6·9 의 실행 가능한 명세.
 *
 * ## 왜 순수 함수인가
 *
 * 이 규칙은 화면이 아니라 **판정**이다(지금 어느 층인가 · ← 가 서는가 · 무엇을 적는가). 컴포넌트
 * 안에 두면 그 판정을 물으려면 렌더가 필요해지고, 렌더가 필요해지면 «사용자가 준 예시 셋» 을
 * 테스트로 못 박는 일이 화면 조작으로 바뀐다. 규칙은 여기, 배선은 `BottomBar.tsx`, 저장은
 * `bar-store.ts` 가 갖는다.
 *
 * ## 지금 페이지는 여기 «상태» 가 아니다
 *
 * `BarState.page` 는 이 모듈이 소유하는 값이 아니라 **react-navigation 이 알려 주는 값**이다
 * (`BottomBar` 가 탭 상태의 focused route 를 그대로 넘긴다). 우리가 진짜로 드는 것은 `history` ·
 * `showGroups` · `lastSub` 셋뿐이고, 그래서 페이지의 진실 공급원이 둘로 갈리지 않는다.
 * 리듀서가 `page` 를 함께 돌려주는 것은 **호출부가 그리로 이동시키라는 지시**다.
 */

import type { TabRouteName } from './routes'

export type GroupId = 'today' | 'schedule' | 'ledger' | 'utility' | 'settings'

export interface BarSub {
  readonly page: TabRouteName
  readonly label: string
}

export interface BarGroup {
  readonly id: GroupId
  readonly label: string
  /** 하위 페이지. 비어 있으면 그룹 자신이 페이지다. */
  readonly subs: readonly BarSub[]
  /** 하위가 **없는** 그룹의 페이지. 하위가 있으면 `null` — 둘 중 하나만 산다(테스트가 고정한다). */
  readonly page: TabRouteName | null
}

/**
 * 그룹 다섯. **순서가 곧 바의 순서다**([[ADR-132]] 결정 1).
 *
 * 라벨이 여기 있는 이유는 바가 라벨을 **두 층**에서 쓰기 때문이다 — 그룹 행에서는 그룹 이름,
 * 하위 행에서는 하위 이름. `routes.ts` 에도 두면 같은 문구가 두 벌이 된다.
 *
 * `today` 만 라틴 문자인 것은 사용자 판정이다(2026-08-13).
 */
export const BAR_GROUPS: readonly BarGroup[] = [
  { id: 'today', label: 'today', subs: [], page: 'Today' },
  {
    id: 'schedule',
    label: '스케줄',
    page: null,
    subs: [
      { page: 'Content', label: '컨텐츠' },
      { page: 'Boss', label: '보스' },
      // 헤더 버튼으로만 열리던 하위 페이지가 셋째 하위가 됐다([[ADR-145]] 결정 1). 순서는 «보던
      // 화면 → 그 화면을 편집하는 자리» 라 보스 뒤다.
      { page: 'BossManage', label: '보스 관리' },
    ],
  },
  {
    id: 'ledger',
    label: '가계부',
    page: null,
    subs: [
      { page: 'Profit', label: '보스 수익' },
      { page: 'HuntingProfit', label: '사냥 수익' },
      { page: 'Spend', label: '지출' },
    ],
  },
  { id: 'utility', label: '유틸리티', subs: [], page: 'Utility' },
  { id: 'settings', label: '설정', subs: [], page: 'Settings' },
]

export interface BarState {
  /** react-navigation 이 알려 주는 지금 화면. 이 모듈이 소유하지 않는다(위 머리말). */
  readonly page: TabRouteName
  /** 한 층 내려올 때 적은 «온 자리». 마지막이 가장 최근이다. */
  readonly history: readonly TabRouteName[]
  /** 기록 없는 ← 로 **페이지는 그대로 둔 채** 그룹 행만 올린 상태(결정 5). */
  readonly showGroups: boolean
  /** 그룹마다 마지막으로 보던 하위. 다시 들어갈 때 그 자리로 돌아간다. */
  readonly lastSub: Readonly<Partial<Record<GroupId, TabRouteName>>>
}

export function initialBarState(): BarState {
  return { page: 'Today', history: [], showGroups: false, lastSub: {} }
}

export function groupById(id: GroupId): BarGroup {
  const group = BAR_GROUPS.find((candidate) => candidate.id === id)
  // 표에 없는 그룹을 물었다는 것은 호출부가 문자열을 지어냈다는 뜻이라 폴백을 두지 않는다.
  if (group === undefined) throw new Error(`알 수 없는 그룹: ${id}`)
  return group
}

export function groupOfPage(page: TabRouteName): BarGroup {
  const group = BAR_GROUPS.find(
    (candidate) => candidate.page === page || candidate.subs.some((sub) => sub.page === page),
  )
  if (group === undefined) throw new Error(`어느 그룹에도 속하지 않는 페이지: ${page}`)
  return group
}

/**
 * 지금 그려야 하는 층(결정 2) — **토글이 아니라 페이지가 정한다.**
 *
 * 예외는 `showGroups` 하나뿐이고, 그것을 세우는 자리는 결정 5(기록 없는 ←) 한 곳이다.
 */
export function barLayer(state: BarState): 'group' | 'sub' {
  if (state.showGroups) return 'group'
  return groupOfPage(state.page).subs.length > 0 ? 'sub' : 'group'
}

/** ← 는 하위 행에만 선다(결정 3). 그룹 행에는 나갈 문이 필요 없다 — 다섯이 이미 다 보인다. */
export function canGoBack(state: BarState): boolean {
  return barLayer(state) === 'sub'
}

/** 지금 하위 행이 보여 줄 항목. 그룹 행이면 빈 배열이다. */
export function visibleSubs(state: BarState): readonly BarSub[] {
  return barLayer(state) === 'sub' ? groupOfPage(state.page).subs : []
}

/**
 * 그룹을 눌렀을 때(결정 4).
 *
 * - **같은 그룹** — 하위 행으로 되돌아가되 기록하지 않는다(결정 5 의 `showGroups` 를 내리는 자리).
 * - **하위가 있는 그룹** — 한 층 내려간다 → 온 자리를 적는다.
 * - **하위가 없는 그룹** — 같은 층의 옆걸음이다 → 적지 않고, 기록을 **비운다**(위층에 왔으니
 *   돌아갈 자리가 없다). 사용자 예시 셋 중 *"유틸리티 → 설정"* 이 이 갈래다.
 */
export function pressGroup(state: BarState, id: GroupId): BarState {
  const group = groupById(id)
  if (group.id === groupOfPage(state.page).id) return { ...state, showGroups: false }

  if (group.page !== null) {
    return { ...state, page: group.page, history: [], showGroups: false }
  }

  const target = state.lastSub[group.id] ?? group.subs[0].page
  return { ...state, page: target, history: [...state.history, state.page], showGroups: false }
}

/** 하위를 눌렀을 때 — 같은 층의 옆걸음이라 **쌓지 않는다**(결정 4). */
export function pressSub(state: BarState, page: TabRouteName): BarState {
  if (page === state.page) return state
  const group = groupOfPage(page)
  return {
    ...state,
    page,
    showGroups: false,
    lastSub: { ...state.lastSub, [group.id]: page },
  }
}

/**
 * ← 를 눌렀을 때(결정 3~5).
 *
 * 하위 행이 아니면 아무 일도 하지 않는다 — 그 상태에서는 ← 가 그려지지도 않지만, 시스템
 * 뒤로가기가 같은 함수를 부르므로(`use-root-back`) 판정을 여기서도 한 번 더 한다.
 */
export function pressBack(state: BarState): BarState {
  if (!canGoBack(state)) return state

  const previous = state.history.at(-1)
  if (previous === undefined) return { ...state, showGroups: true }

  const group = groupOfPage(previous)
  return {
    page: previous,
    history: state.history.slice(0, -1),
    showGroups: false,
    lastSub: group.page === null ? { ...state.lastSub, [group.id]: previous } : state.lastSub,
  }
}

/** 바에서 일어날 수 있는 조작 셋. 광고 게이트가 **무엇을 눌렀는가**까지 봐야 해서 이름이 필요하다. */
export type BarAction = 'group' | 'sub' | 'back'

/**
 * 광고 게이트를 태울 이동인가(결정 9 — [[ADR-090]] 결정 3 축소).
 *
 * **상태 비교만으로는 못 가린다.** 뒤로가기도 그룹을 바꾸기 때문이다(가계부에서 ← 를 누르면
 * 유틸리티로 나간다) — 처음에 상태 델타만 보는 함수로 썼다가 테스트가 그것을 잡았다. 그래서
 * 판정에 **조작**이 들어간다: 그룹을 눌러서, 그룹이 실제로 바뀌었을 때만 참이다.
 *
 * 하위 이동·뒤로가기·같은 그룹 재탭이 전부 거짓이라, 게이트가 불리는 빈도가 옛 탭바와 같은 자리에
 * 남는다(그때도 «다른 탭을 누른 경우» 하나였다).
 */
export function shouldGateAd(action: BarAction, before: BarState, after: BarState): boolean {
  if (action !== 'group') return false
  return groupOfPage(before.page).id !== groupOfPage(after.page).id
}
