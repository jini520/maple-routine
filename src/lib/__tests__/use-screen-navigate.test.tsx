// @vitest-environment jsdom
//
// ADR-098 결정 1 — 화면을 통째로 바꾸는 이동은 스크롤을 최상단으로 옮기고 **같은 태스크에서**
// 이동한다. 네 탭이 문서 전체 스크롤 하나를 공유하므로(ADR-072 결정 1), 그러지 않으면 새 화면이
// 비-0 오프셋으로 마운트되고 문서 높이가 다르면 클램프 프레임이 생긴다(계측: 보스 y=649 → 컨텐츠 y=289).
//
// **이동을 한 프레임 미루면 안 된다**(폐기 1) — `rAF` 로 미뤘더니 실기기 연속 프레임에서 그 프레임에
// 떠나는 화면이 최상단으로 올라간 모습이 그대로 찍혔다(2026-08-06 사용자 반려). 스크롤과 DOM 교체
// 사이에 페인트가 없어야 중간 상태가 화면에 안 나온다. 아래 "지연되지 않는다" 테스트가 그 가드다.
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScreenNavigate } from '../use-screen-navigate'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderHarness(): { events: string[] } {
  const events: string[] = []
  vi.spyOn(window, 'scrollTo').mockImplementation((...args: unknown[]) => {
    events.push(`scrollTo(${args.join(',')})`)
  })

  function Departure(): React.JSX.Element {
    const navigate = useScreenNavigate()
    return (
      <button type="button" onClick={() => navigate('/boss')}>
        보스로
      </button>
    )
  }

  function Arrival(): React.JSX.Element {
    events.push('arrived')
    return <h1>보스 스케줄러</h1>
  }

  render(
    <MemoryRouter initialEntries={['/content']}>
      <Routes>
        <Route path="/content" element={<Departure />} />
        <Route path="/boss" element={<Arrival />} />
      </Routes>
    </MemoryRouter>,
  )

  return { events }
}

describe('useScreenNavigate', () => {
  it('이동하기 전에 스크롤을 최상단으로 옮긴다', () => {
    const { events } = renderHarness()

    act(() => {
      screen.getByRole('button', { name: '보스로' }).click()
    })

    expect(events).toEqual(['scrollTo(0,0)', 'arrived'])
  })

  // 폐기 1 회귀 가드 — 이동이 다음 프레임으로 미뤄지면 그 프레임에 떠나는 화면이 최상단으로
  // 올라간 모습이 그려진다(실기기 관측). 클릭 처리가 끝난 시점에 이미 도착해 있어야 한다.
  it('이동을 다음 프레임으로 미루지 않는다 — 스크롤과 화면 교체 사이에 페인트가 없다', () => {
    renderHarness()

    act(() => {
      screen.getByRole('button', { name: '보스로' }).click()
    })

    expect(screen.getByRole('heading', { name: '보스 스케줄러' })).toBeInTheDocument()
  })
})
