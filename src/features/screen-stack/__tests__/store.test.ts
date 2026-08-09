import { beforeEach, describe, expect, it } from 'vitest'
import { useScreenStackStore } from '../store'

describe('useScreenStackStore', () => {
  beforeEach(() => {
    useScreenStackStore.setState({ depth: 0, progress: 1, isDragging: false, transitionMs: 0 })
  })

  it('닫혀 있을 때 진행률은 1이다 — 아래 화면에 transform 이 걸리지 않는 상태', () => {
    expect(useScreenStackStore.getState()).toMatchObject({
      depth: 0,
      progress: 1,
      isDragging: false,
    })
  })

  it('열면 화면 밖에서 시작한다 — 들어오는 연출이 1에서 0으로 갈 자리를 만든다', () => {
    useScreenStackStore.getState().open()

    expect(useScreenStackStore.getState().depth).toBe(1)
    expect(useScreenStackStore.getState().progress).toBe(1)
    // 배치만 하는 프레임이라 전환을 걸지 않는다 — 걸면 시작 상태가 커밋되기 전에 애니메이션이 돈다.
    expect(useScreenStackStore.getState().transitionMs).toBe(0)
  })

  it('2단으로 열 수 있다 (/settings/about/privacy)', () => {
    useScreenStackStore.getState().open()
    useScreenStackStore.getState().setProgress(0)
    useScreenStackStore.getState().open()

    expect(useScreenStackStore.getState().depth).toBe(2)
    // 새로 열린 최상단이 화면 밖이다. 아래 층은 자기 자리에 서 있어 값이 필요 없다.
    expect(useScreenStackStore.getState().progress).toBe(1)
  })

  it('한 층을 닫으면 남은 최상단은 다 들어와 있다', () => {
    useScreenStackStore.getState().open()
    useScreenStackStore.getState().open()
    useScreenStackStore.getState().setProgress(1)

    useScreenStackStore.getState().close()

    expect(useScreenStackStore.getState().depth).toBe(1)
    // 남은 층은 이미 화면을 덮고 있다 — 1로 두면 그 화면이 화면 밖에 있는 것으로 그려진다.
    expect(useScreenStackStore.getState().progress).toBe(0)
  })

  it('마지막 층을 닫으면 진행률이 1로 돌아간다 — 탭 레이어의 transform 이 사라지는 지점', () => {
    useScreenStackStore.getState().open()
    useScreenStackStore.getState().setProgress(0)

    useScreenStackStore.getState().close()

    expect(useScreenStackStore.getState().depth).toBe(0)
    expect(useScreenStackStore.getState().progress).toBe(1)
  })

  it('닫으면 드래그 상태까지 초기화한다', () => {
    // 끌던 도중 화면이 사라지면 touchend 가 오지 않아 isDragging 이 남는다.
    // 그대로면 다음 오버레이가 전환 없이 열린다.
    useScreenStackStore.getState().open()
    useScreenStackStore.getState().setDragging(true)

    useScreenStackStore.getState().close()

    expect(useScreenStackStore.getState().isDragging).toBe(false)
  })

  it('깊이는 0 아래로 내려가지 않는다', () => {
    useScreenStackStore.getState().close()
    expect(useScreenStackStore.getState().depth).toBe(0)
  })

  it('진행률은 0~1 밖으로 나가지 않는다', () => {
    // iOS 러버밴드에서 손가락이 시작점보다 왼쪽으로 가면 음수 delta 가 들어온다.
    useScreenStackStore.getState().setProgress(-0.5)
    expect(useScreenStackStore.getState().progress).toBe(0)

    useScreenStackStore.getState().setProgress(2.3)
    expect(useScreenStackStore.getState().progress).toBe(1)
  })
})
