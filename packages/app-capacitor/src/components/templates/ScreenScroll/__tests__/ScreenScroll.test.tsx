// @vitest-environment jsdom
//
// ADR-099 — 화면 스크롤 셸. 이 테스트가 지키는 것은 **박스가 "실제로 보이는 영역"과 같다**는 것이다.
// 스크롤 인디케이터는 스크롤포트 위에 겹쳐 그려지므로, 상자가 화면 끝까지 닿으면 노치를 침범하고
// 탭바 뒤로 사라진다(둘 다 실기기에서 관측된 회귀다).
import '@testing-library/jest-dom/vitest'
import { createRef } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScreenScroll } from '../ScreenScroll'

afterEach(cleanup)

describe('ScreenScroll', () => {
  it('뷰포트 폭 전체를 쓰는 스크롤 컨테이너다', () => {
    render(<ScreenScroll>내용</ScreenScroll>)

    const scroller = screen.getByTestId('screen-scroll')
    expect(scroller).toHaveClass('fixed', 'inset-x-0', 'overflow-y-auto', 'overscroll-y-none')
  })

  it('스크롤포트 상단은 안전영역만큼, 하단은 탭바 실측만큼 인셋된다', () => {
    render(<ScreenScroll>내용</ScreenScroll>)

    const scroller = screen.getByTestId('screen-scroll')
    expect(scroller).toHaveClass('top-[var(--sa-top)]')
    // 탭바 높이는 가정(4rem)이 아니라 BottomTabBar 가 쓰는 실측값이다(결정 7).
    expect(scroller).toHaveClass('bottom-[var(--tab-bar-h)]')
  })

  it('안쪽 래퍼가 상단 인셋을 되돌려 콘텐츠 위치와 스크롤 범위를 보존한다', () => {
    render(<ScreenScroll>내용</ScreenScroll>)

    const wrapper = screen.getByTestId('screen-scroll').firstElementChild
    expect(wrapper).toHaveClass('-mt-[var(--sa-top)]', 'space-y-4')
    expect(wrapper).toHaveTextContent('내용')
  })

  it('배경색을 칠하지 않는다 — 불투명 배경은 테마 배경 이미지를 가린다(ADR-088)', () => {
    render(<ScreenScroll>내용</ScreenScroll>)

    expect(screen.getByTestId('screen-scroll').className).not.toMatch(/\bbg-/)
  })

  it('ref 를 주면 컨테이너에 연결한다 — 당김 판정이 이 요소의 scrollTop 을 읽는다', () => {
    const ref = createRef<HTMLDivElement>()
    render(<ScreenScroll ref={ref}>내용</ScreenScroll>)

    expect(ref.current).toBe(screen.getByTestId('screen-scroll'))
  })
})
