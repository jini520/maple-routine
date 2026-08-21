// 웹판의 열둘을 옮겼다. `pathLength` 정규화가 없어(컴포넌트 주석 ①) **드로잉 단언이 300 기준에서
// 실측 둘레 기준으로** 바뀌었고 — 지키는 것은 같다: *남은 호가 남은 거리다*([[ADR-074]] 결정 3).
//
// 이 파일이 지키는 계약은 `RefreshControl` 로 **대체할 수 없는 부분**이기도 하다(컴포넌트 주석) —
// 마크의 형태·연속성·크기가 곧 [[ADR-074]] 다.
import { PULL_THRESHOLD_PX } from '../../../../lib/pull-to-refresh'

import { findAllOfType, flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { MAPLE_LEAF_PATH_LENGTH } from '../../../mapleLeafPath'
import { PullToRefreshIndicator } from '../PullToRefreshIndicator'

const HIDDEN = { includeHiddenElements: true } as const

/** 당김 구간 링의 `<path>` — RNTL 쿼리로는 SVG 안쪽에 닿지 않는다(`render-atom.tsx`). */
function ringPath(rendered: Awaited<ReturnType<typeof renderAtom>>): Record<string, unknown> {
  return findAllOfType(rendered.toJSON(), 'RNSVGPath')[0].props
}

describe('PullToRefreshIndicator', () => {
  it('당김이 없으면(idle) 트리에 아무것도 남기지 않는다', async () => {
    const rendered = await renderAtom(<PullToRefreshIndicator distance={0} phase="idle" />)

    expect(rendered.queryByTestId('pull-to-refresh-indicator', HIDDEN)).toBeNull()
  })

  // [[ADR-074]] 결정 1 — 마크 하나가 진행률과 대기를 모두 말하므로 문구는 잉여다.
  // 옛 3상태 문구가 되살아나면 여기서 잡힌다.
  it.each([['pulling'], ['ready'], ['refreshing']] as const)(
    '%s 단계에서도 문구를 렌더하지 않는다',
    async (phase) => {
      const rendered = await renderAtom(<PullToRefreshIndicator distance={30} phase={phase} />)

      for (const message of ['당겨서 새로고침', '놓으면 새로고침', '새로고침하고 있어요']) {
        expect(rendered.queryByText(message, HIDDEN)).toBeNull()
      }
      expect(findAllOfType(rendered.toJSON(), 'Text')).toHaveLength(0)
    },
  )

  // [[ADR-074]] 결정 7 — 문구가 없으면 role="status" 는 읽을 것이 없는 빈 라이브 리전이다.
  it('접근성 트리에서 숨기고 role·aria-live 를 두지 않는다', async () => {
    const { getByTestId } = await renderAtom(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const indicator = getByTestId('pull-to-refresh-indicator', HIDDEN)
    expect(indicator.props['aria-hidden']).toBe(true)
    expect(indicator.props.role).toBeUndefined()
    expect(indicator.props['aria-live']).toBeUndefined()
  })

  // [[ADR-074]] 결정 2 — 채움 잎이 아니라 외곽선 링이다(채움으로의 회귀 가드).
  it('당김 구간의 마크는 채움이 아니라 외곽선 링이다', async () => {
    const path = ringPath(await renderAtom(<PullToRefreshIndicator distance={30} phase="pulling" />))

    expect(path.fill).toBeNull() // fill="none"
    expect(path.strokeWidth).toBe(9)
    expect(path.strokeLinecap).toBe(1) // "round"
    expect(path.strokeDasharray).toEqual([MAPLE_LEAF_PATH_LENGTH, MAPLE_LEAF_PATH_LENGTH])
  })

  // [[ADR-074]] 결정 3 — 남은 호가 그대로 남은 거리다. 회전이 아니라 드로잉으로 진행률을 말한다.
  // 웹은 `pathLength=300` 정규화 위의 300/150/0 이었고, RN 은 같은 비율의 실측 둘레다.
  it.each([
    [0, 1],
    [PULL_THRESHOLD_PX / 2, 0.5],
    [PULL_THRESHOLD_PX, 0],
  ])('당김 %s px 에서 남은 호가 둘레의 %s 배다', async (distance, remaining) => {
    const path = ringPath(await renderAtom(<PullToRefreshIndicator distance={distance} phase="pulling" />))

    // `react-native-svg` 는 오프셋 0 을 `null`(= 속성 없음)로 정규화한다 — 그리는 값은 같다.
    expect((path.strokeDashoffset ?? 0) as number).toBeCloseTo(MAPLE_LEAF_PATH_LENGTH * remaining, 6)
  })

  it('임계값을 넘겨 더 당겨도 링이 완성 상태를 넘지 않는다', async () => {
    const path = ringPath(
      await renderAtom(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX * 2} phase="ready" />),
    )

    expect(path.strokeDashoffset ?? 0).toBe(0)
  })

  // [[ADR-074]] 결정 4·5 — 같은 링이 그대로 돈다. 스윕 스피너는 이 자리에서 쓰지 않는다.
  it('재조회 구간은 트레일 링 스피너이고 스윕 스피너가 아니다', async () => {
    const refreshing = await renderAtom(<PullToRefreshIndicator distance={0} phase="refreshing" />)
    expect(refreshing.getByTestId('maple-spinner', HIDDEN)).toBeTruthy()
    expect(refreshing.queryByTestId('maple-sweep-spinner', HIDDEN)).toBeNull()
    expect(refreshing.queryByTestId('pull-to-refresh-leaf', HIDDEN)).toBeNull()

    const pulling = await renderAtom(<PullToRefreshIndicator distance={20} phase="pulling" />)
    expect(pulling.queryByTestId('maple-spinner', HIDDEN)).toBeNull()
    expect(pulling.queryByTestId('maple-sweep-spinner', HIDDEN)).toBeNull()
  })

  // [[ADR-074]] 결정 6 — 손을 떼는 순간 마크가 커지거나 작아지면 한 동작이 두 개로 끊겨 보인다.
  it('당김 구간과 재조회 구간의 마크 크기가 같다', async () => {
    const pulling = await renderAtom(<PullToRefreshIndicator distance={PULL_THRESHOLD_PX} phase="ready" />)
    const leaf = pulling.getByTestId('pull-to-refresh-leaf', HIDDEN)

    const refreshing = await renderAtom(<PullToRefreshIndicator distance={0} phase="refreshing" />)
    const spinner = refreshing.getByTestId('maple-spinner', HIDDEN)

    expect([leaf.props.width, leaf.props.height]).toEqual([spinner.props.width, spinner.props.height])
    expect(leaf.props.width).toBe(28)
  })

  // 손을 떼면 distance가 0으로 돌아간다 — 그때 틈이 닫히면 재조회 표시가 사라지고,
  // 목록도 제자리로 갔다 다시 내려간다([[ADR-073]] 결정 5의 정착 위치).
  it('재조회 중에는 distance가 0이어도 높이가 임계값과 같다', async () => {
    const { getByTestId } = await renderAtom(<PullToRefreshIndicator distance={0} phase="refreshing" />)

    expect(flattenStyle(getByTestId('pull-to-refresh-indicator', HIDDEN).props.style).height).toBe(
      PULL_THRESHOLD_PX,
    )
  })

  it.each([[20], [40]])('당김이 깊어질수록 벌어진 틈의 높이가 커진다 (%s px)', async (distance) => {
    const { getByTestId } = await renderAtom(<PullToRefreshIndicator distance={distance} phase="pulling" />)

    expect(flattenStyle(getByTestId('pull-to-refresh-indicator', HIDDEN).props.style).height).toBe(distance)
  })

  // [[ADR-073]] 결정 7 — 목록이 내려가 생긴 틈은 이미 페이지 배경이라 덮을 것이 없다.
  // 불투명 면을 다시 깔면 경계선이 두 겹으로 보인다(옛 배너로의 회귀 가드).
  it('루트는 흐름 밖 절대 배치이고, 배경·테두리 없이 터치도 가로채지 않는다', async () => {
    const { getByTestId } = await renderAtom(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const style = flattenStyle(getByTestId('pull-to-refresh-indicator', HIDDEN).props.style)
    expect(style).toMatchObject({
      position: 'absolute',
      left: 0,
      right: 0,
      top: '100%',
      zIndex: 1,
      overflow: 'hidden',
      pointerEvents: 'none',
    })
    expect(style.backgroundColor).toBeUndefined()
    expect(style.borderBottomWidth).toBeUndefined()
  })

  // [[ADR-073]] 결정 7 — 마크는 "현재 벌어진 틈"의 세로 중앙에 있어야 틈이 커질수록 함께 내려온다.
  // 고정 h-14 는 위에서부터 드러내던 옛 배너의 어법이다.
  it('내용은 고정 높이가 아니라 틈 전체(h-full)의 중앙에 놓인다', async () => {
    const { getByTestId } = await renderAtom(<PullToRefreshIndicator distance={30} phase="pulling" />)

    const [content] = getByTestId('pull-to-refresh-indicator', HIDDEN).children as {
      props: Record<string, unknown>
    }[]
    expect(flattenStyle(content.props.style)).toMatchObject({
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    })
  })

})
