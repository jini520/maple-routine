/**
 * 화면을 맨 위로 되돌리는 함수를 라우트 이름으로 찾는 표.
 *
 * 하단바는 화면 밖에 산다(`LayerStack` 의 `layout` 이 그린다). 그래서 그 화면의 `ScrollView` 를
 * 직접 잡을 길이 없고, 지금 페이지 이름은 이미 프롭으로 받고 있다. 이름을 키로 두는 것이
 * 둘 사이를 잇는 가장 짧은 선이다.
 *
 * **슬롯 하나로는 안 된다.** 층 안의 화면은 탭이라 형제가 서로 언마운트하지 않아, 셋이 한
 * 자리에 등록하면 마지막 등록자가 이긴다. `ScreenScroll` 이 당겨서 새로고침을 프롭으로 받은
 * 것과 같은 이유이고, 다른 것은 여기서는 부르는 쪽이 목적지 이름을 안다는 점이다.
 *
 * 등록은 `hooks/useScrollToTop.ts` 를 거친다. 이 표를 직접 만지는 것은 화면 밖에 있어 라우트
 * 컨텍스트가 없는 하단바뿐이다.
 */

type ScrollToTop = () => void

const targets = new Map<string, ScrollToTop>()

/**
 * 이 화면을 맨 위로 되돌리는 함수를 표에 올린다.
 *
 * @param page 라우트 이름
 * @returns 해제 함수
 */
export function registerScrollToTop(page: string, scrollToTop: ScrollToTop): () => void {
  targets.set(page, scrollToTop)

  return () => {
    // 이름이 아니라 **그 함수인가**를 보고 지운다. 이펙트가 다시 도는 순서는 등록 → 재등록 →
    // 옛 해제라, 이름만 보면 방금 등록한 살아 있는 과녁이 사라진다.
    if (targets.get(page) === scrollToTop) targets.delete(page)
  }
}

/**
 * 그 화면을 맨 위로 되돌린다. 등록된 것이 없으면 아무 일도 안 한다.
 *
 * 셸을 안 쓰는 화면이 있고 그 자리에서 던지면 누름이 통째로 죽는다.
 */
export function scrollPageToTop(page: string): void {
  targets.get(page)?.()
}

/** 테스트 전용. 모듈 수준 상태라 테스트끼리 오염된다. `beforeEach` 에서 부른다. */
export function __resetScrollToTopForTest(): void {
  targets.clear()
}
