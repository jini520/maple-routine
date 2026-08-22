/**
 * 하단바의 «층과 뒤로가기» 규칙 — [[ADR-132]] 결정 2~4·6 을 [[ADR-167]] 이 다시 앉힌 자리.
 *
 * ## 층은 이제 이 모듈이 «기억» 하지 않는다
 *
 * 예전에는 여기가 `history` 와 `showGroups` 를 들고 뒤로가기를 손으로 만들었다. 그 이유는 하나였다 —
 * 그룹→하위 이동이 **형제 탭 전환**이라 되돌아갈 단이 없었기 때문이다. [[ADR-167]] 이 그 이동을
 * 진짜 스택 push 로 바꾸면서 **되돌아갈 단이 실재하게** 됐고, 그러자 두 값은 «합쳐진» 것이 아니라
 * **존재 이유를 잃었다**:
 *
 * - `history` → 스택이 든다.
 * - `showGroups` → 하위 행에 있다는 것이 곧 스택 깊이 ≥ 1 이라, 그 상태가 만들어질 길이 없다.
 * - `lastSub` → **남는다.** 그룹을 나가면 그 단이 언마운트되므로 다시 들어갈 자리는 우리 것이다.
 *
 * ## 왜 여전히 순수 함수인가
 *
 * 이 규칙은 화면이 아니라 **판정**이다(지금 어느 층인가 · ← 가 서는가 · 무엇을 눌렀을 때 어디로
 * 가는가). 컴포넌트 안에 두면 그 판정을 물으려면 렌더가 필요해지고, 렌더가 필요해지면 «사용자가 준
 * 예시 셋» 을 테스트로 못 박는 일이 화면 조작으로 바뀐다.
 *
 * 달라진 것은 **반환값**뿐이다. 상태가 react-navigation 것이므로 새 상태를 만들어 돌려줄 수 없고,
 * 대신 «무엇을 할지»(`BarIntent`)를 돌려준다. 그것을 이동으로 옮기는 일은 `BottomBar` 가 한다.
 *
 * ## 지금 페이지는 여기 «상태» 가 아니다
 *
 * `BarState.page` 는 이 모듈이 소유하는 값이 아니라 **react-navigation 이 알려 주는 값**이다
 * (`Main` 이 층 스택의 가장 안쪽 화면 이름을 읽어 넘긴다). 우리가 진짜로 드는 것은 `lastSub`
 * 하나뿐이고, 그래서 페이지의 진실 공급원이 둘로 갈리지 않는다.
 */

import type { LayerRouteName, TabRouteName } from './routes'

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
  /**
   * 하위가 **있는** 그룹이 push 할 층 화면([[ADR-167]] 결정 2). 하위가 없으면 `null` — 그런 그룹의
   * 페이지는 그룹 층(`Groups`) 안에 산다.
   *
   * `subs`/`page` 와 같은 배타 규칙을 따르고, 그것도 테스트가 고정한다. 짝이 어긋나면 그룹을
   * 눌렀을 때 push 할 자리가 없거나 아무도 안 쓰는 층 화면이 생긴다.
   */
  readonly layer: LayerRouteName | null
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
  { id: 'today', label: 'today', subs: [], page: 'Today', layer: null },
  {
    id: 'schedule',
    label: '스케줄러',
    page: null,
    layer: 'ScheduleSubs',
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
    label: '수익·지출',
    page: null,
    layer: 'LedgerSubs',
    subs: [
      { page: 'Profit', label: '보스 수익' },
      { page: 'HuntingProfit', label: '사냥 수익' },
      { page: 'Spend', label: '지출' },
    ],
  },
  { id: 'utility', label: '유틸리티', subs: [], page: 'Utility', layer: null },
  { id: 'settings', label: '설정', subs: [], page: 'Settings', layer: null },
]

/** 그룹마다 마지막으로 보던 하위. 다시 들어갈 때 그 자리로 돌아간다. */
export type LastSub = Readonly<Partial<Record<GroupId, TabRouteName>>>

export interface BarState {
  /** react-navigation 이 알려 주는 지금 화면. 이 모듈이 소유하지 않는다(위 머리말). */
  readonly page: TabRouteName
  readonly lastSub: LastSub
}

/**
 * 바를 눌렀을 때 **무엇을 할지**. 상태가 아니라 지시다([[ADR-167]] 결정 5).
 *
 * - `openSubs` — 한 층 내려간다. 적용부가 그 층 화면으로 이동하면 스택이 그것을 한 단으로 만든다.
 * - `switchSub` — 같은 단 안의 옆걸음. 스택이 자라지 않는다([[ADR-132]] 결정 4).
 * - `switchGroupPage` — 그룹 층의 옆걸음. 하위 행에서 눌렀다면 **올라가면서** 옆걸음한다(한 번의 이동).
 * - `back` — 한 단 올라간다(= pop). 가장자리 스와이프가 만드는 것과 같은 결과다.
 */
export type BarIntent =
  | { readonly kind: 'openSubs'; readonly layer: LayerRouteName; readonly page: TabRouteName }
  | { readonly kind: 'switchSub'; readonly page: TabRouteName }
  | { readonly kind: 'switchGroupPage'; readonly page: TabRouteName }
  | { readonly kind: 'back' }
  | { readonly kind: 'none' }

const NONE: BarIntent = { kind: 'none' }

export function initialBarState(): BarState {
  return { page: 'Today', lastSub: {} }
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
 * 그 페이지가 **어느 층 화면 안에 사는가**([[ADR-167]] 결정 2).
 *
 * 화면이 «저 탭으로 가고 싶다» 고 말할 때 그것을 중첩 이동으로 옮기는 유일한 표다
 * (`use-open-tab.ts`) — 화면이 층 구조를 직접 알면 구조를 바꿀 때마다 화면들이 함께 움직인다.
 */
export function layerOfPage(page: TabRouteName): LayerRouteName {
  return groupOfPage(page).layer ?? 'Groups'
}

/** 지금 그려야 하는 층(결정 2) — **토글이 아니라 페이지가 정한다.** 이제 예외가 하나도 없다. */
export function barLayer(state: BarState): 'group' | 'sub' {
  return groupOfPage(state.page).subs.length > 0 ? 'sub' : 'group'
}

/**
 * ← 는 하위 행에만 선다(결정 3). 그룹 행에는 나갈 문이 필요 없다 — 다섯이 이미 다 보인다.
 *
 * 하위 행이면 **언제나** 참인 것이 [[ADR-167]] 결정 4 다. 하위 행에 있다는 것이 곧 스택 깊이 ≥ 1
 * 이라, 예전의 «기록이 없어 되돌아갈 자리가 없는» 경우가 존재하지 않는다.
 */
export function canGoBack(state: BarState): boolean {
  return barLayer(state) === 'sub'
}

/** 지금 하위 행이 보여 줄 항목. 그룹 행이면 빈 배열이다. */
export function visibleSubs(state: BarState): readonly BarSub[] {
  return barLayer(state) === 'sub' ? groupOfPage(state.page).subs : []
}

/** 그룹의 목적지 — 기억된 하위가 있으면 그것, 없으면 첫 하위. */
function entryPageOf(group: BarGroup, lastSub: LastSub): TabRouteName {
  return lastSub[group.id] ?? group.subs[0].page
}

/**
 * 그룹을 눌렀을 때(결정 4).
 *
 * - **같은 그룹** — 이미 거기 있다. 예전에는 `showGroups` 를 내리는 자리였는데 그 상태가 없어졌다.
 * - **하위가 있는 그룹** — 한 층 내려간다.
 * - **하위가 없는 그룹** — 그룹 층의 옆걸음이다. 하위 행에서 눌렀다면 올라가면서 옆걸음한다.
 *   사용자 예시 셋 중 *"유틸리티 → 설정"* 이 이 갈래다.
 */
export function pressGroup(state: BarState, id: GroupId): BarIntent {
  const group = groupById(id)
  if (group.id === groupOfPage(state.page).id) return NONE

  if (group.page !== null) return { kind: 'switchGroupPage', page: group.page }

  // 하위가 있으면 `layer` 가 반드시 있다 — 표 테스트가 그 짝을 고정한다.
  return {
    kind: 'openSubs',
    layer: group.layer as LayerRouteName,
    page: entryPageOf(group, state.lastSub),
  }
}

/** 하위를 눌렀을 때 — 같은 층의 옆걸음이라 **쌓지 않는다**(결정 4). */
export function pressSub(state: BarState, page: TabRouteName): BarIntent {
  if (page === state.page) return NONE
  return { kind: 'switchSub', page }
}

/**
 * **바를 거치지 않은 이동** — today 위젯 타일처럼 화면이 직접 목적지를 정해 가는 경우.
 *
 * ## 이 함수의 결함이 구조에서 사라졌다
 *
 * 예전 구현은 [[ADR-132]] 결정 4(*"기록은 «한 층 내려갈 때»만 남는다"*)를 **«바를 눌러 내려갈
 * 때»만** 으로 좁혀 있었고, 그래서 위젯 타일로 보스 수익에 가면 기록이 빈 채로 하위 행에 도착해
 * ← 가 «가계부가 활성인 채 그룹 행만 열림» 으로 떨어졌다. 층을 스택이 들면 위젯 타일도 그냥 한 단
 * 내려가는 이동이라 **누가 적었는가라는 물음 자체가 없다.**
 *
 * `pressGroup` 과 무엇이 다른가: **목적지를 스스로 정하지 않는다.** `pressGroup` 은 `lastSub` 로
 * 가지만 위젯은 «보스 수익» 처럼 특정 페이지를 지목한다([[ADR-145]] 대가 · [[ADR-140]] 결정 1).
 */
export function openPage(state: BarState, target: TabRouteName): BarIntent {
  if (target === state.page) return NONE

  const group = groupOfPage(target)
  if (group.page !== null) return { kind: 'switchGroupPage', page: group.page }
  if (group.id === groupOfPage(state.page).id) return { kind: 'switchSub', page: target }

  return { kind: 'openSubs', layer: group.layer as LayerRouteName, page: target }
}

/** ← 를 눌렀을 때(결정 3) — 하위 행이 아니면 ← 가 그려지지도 않는다. */
export function pressBack(state: BarState): BarIntent {
  return canGoBack(state) ? { kind: 'back' } : NONE
}

/**
 * 다시 들어갈 자리를 적는다([[ADR-167]] 결정 4).
 *
 * 그룹 층 페이지는 기억할 것이 없으므로 **같은 객체를 그대로 돌려준다** — 새 객체를 만들면
 * `useSyncExternalStore` 가 매번 바뀐 것으로 보고 바를 다시 그린다.
 */
export function rememberSub(lastSub: LastSub, page: TabRouteName): LastSub {
  const group = groupOfPage(page)
  if (group.page !== null) return lastSub
  if (lastSub[group.id] === page) return lastSub
  return { ...lastSub, [group.id]: page }
}
