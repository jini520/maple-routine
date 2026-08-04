// @vitest-environment jsdom
//
// ADR-094 결정 4의 안전장치 — 화면 스냅샷(3화면 11케이스)이 **모달을 못 잡는 공백**을 메운다.
// 모달은 포털로 `document.body` 에 그려지므로 `render()` 가 돌려주는 container 밖에 있다.
// compound 전환(3단계)으로 패널이 호출부에서 오는 구조가 됐으니, 그 결과 DOM 을 고정한다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { domSnapshot } from '../../../__tests__/dom-snapshot.helper'
import { Modal } from '../Modal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

/**
 * 포털이라 container 가 아니라 `document.body` 를 본다 — 오버레이 **자신의** 클래스
 * (`items-start pt-[…]` vs `items-center`)까지 잡으려면 오버레이를 자식으로 두는 body 를
 * 기준으로 떠야 한다.
 */
function overlaySnapshot(): string {
  return domSnapshot(document.body)
}

describe('Modal DOM 스냅샷 (ADR-094 결정 4)', () => {
  it('Modal.Card 기본 — 상단 정렬·max-w-sm·p-6', () => {
    render(
      <Modal onClose={vi.fn()} testId="snap-overlay">
        <Modal.Card>
          <p>내용</p>
        </Modal.Card>
      </Modal>,
    )

    expect(overlaySnapshot()).toMatchSnapshot()
  })

  it('Modal.Card tight + 좁은 폭 + 중앙 정렬 — 업데이트 모달 구성', () => {
    render(
      <Modal onClose={vi.fn()} testId="snap-overlay" align="center">
        <Modal.Card maxWidth="max-w-xs" tight>
          <p>내용</p>
        </Modal.Card>
      </Modal>,
    )

    expect(overlaySnapshot()).toMatchSnapshot()
  })

  it('Modal.Panel — 껍데기 없는 위치 래퍼(계정 모달 구성)', () => {
    render(
      <Modal onClose={vi.fn()} testId="snap-overlay">
        <Modal.Panel>
          <p>내용</p>
        </Modal.Panel>
      </Modal>,
    )

    expect(overlaySnapshot()).toMatchSnapshot()
  })
})
