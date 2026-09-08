// 최상단 이동의 과녁 표. 바는 화면 밖(`LayerStack` 의 `layout`)이라 스크롤 컨테이너를 직접
// 잡을 길이 없고, 라우트 이름으로 찾는다.
//
// 슬롯 하나로 두면 안 되는 이유가 이 파일이 지키는 것이다. 층 안의 화면은 탭이고 형제가 서로
// 언마운트하지 않아, 셋이 한 자리에 등록하면 마지막 등록자가 이긴다.
import {
  __resetScrollToTopForTest,
  registerScrollToTop,
  scrollPageToTop,
} from '../scroll-to-top'

beforeEach(__resetScrollToTopForTest)

describe('최상단 이동 과녁 표', () => {
  it('등록한 이름으로 부르면 그 화면만 움직인다', () => {
    const today = jest.fn()
    const boss = jest.fn()
    registerScrollToTop('Today', today)
    registerScrollToTop('Boss', boss)

    scrollPageToTop('Today')

    expect(today).toHaveBeenCalledTimes(1)
    expect(boss).not.toHaveBeenCalled()
  })

  it('등록되지 않은 이름은 조용히 넘어간다', () => {
    // 하위 페이지처럼 셸을 안 쓰는 화면이 있고, 그 자리에서 던지면 누름이 통째로 죽는다.
    expect(() => {
      scrollPageToTop('Today')
    }).not.toThrow()
  })

  it('해제하면 더는 안 불린다', () => {
    const today = jest.fn()
    const unregister = registerScrollToTop('Today', today)

    unregister()
    scrollPageToTop('Today')

    expect(today).not.toHaveBeenCalled()
  })

  it('같은 이름을 다시 등록하면 나중 것이 이긴다', () => {
    const old = jest.fn()
    const fresh = jest.fn()
    registerScrollToTop('Today', old)
    registerScrollToTop('Today', fresh)

    scrollPageToTop('Today')

    expect(old).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledTimes(1)
  })

  // 등록 → 재등록 → 옛 해제 순서가 실제로 온다(이펙트 의존성이 바뀔 때). 이름만 보고 지우면
  // 살아 있는 화면의 과녁이 사라져 그 탭에서만 조용히 안 먹는다.
  it('옛 등록을 해제해도 그 뒤에 등록한 것은 살아 있다', () => {
    const old = jest.fn()
    const fresh = jest.fn()
    const unregisterOld = registerScrollToTop('Today', old)
    registerScrollToTop('Today', fresh)

    unregisterOld()
    scrollPageToTop('Today')

    expect(fresh).toHaveBeenCalledTimes(1)
  })
})
