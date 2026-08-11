// @vitest-environment jsdom
//
// ADR-094 2단계 — atoms 신설. ProgressBar 와 같은 원칙으로, 이 테스트가 지키는 것은
// **기존 호출부 16곳의 DOM 을 바꾸지 않는 것**이다(ADR-094 결정 4).
//
// atom 이 소유하는 범위를 클래스 단위로 못박는다 — **외형(디자인 결정)만 갖고 레이아웃은
// 호출부에 남긴다.** 실측에서 primary 9곳의 공통 토큰은 7개뿐이고 `flex`·`w-full`·`gap-2` 는
// 5~6곳에서만 쓰였다. 그것들은 "이 버튼이 어떻게 생겼나"가 아니라 "이 자리에 어떻게 놓이나"라
// atom 이 가지면 호출부마다 예외를 만들게 된다.
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'
import { BUTTON_VARIANT_CLASS } from '../variants'

afterEach(() => {
  cleanup()
})

// 실측한 공통 코어(변형별 전 호출부의 교집합).
const PRIMARY = 'rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5'
const TEXT = 'rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text'
const DANGER = 'rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error-ink hover:bg-error-tint'
const OUTLINE = 'rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text hover:bg-primary-tint'

describe('Button', () => {
  it('primary 변형의 클래스가 디자인 시스템 규정과 같다', () => {
    render(<Button variant="primary">확인</Button>)

    expect(screen.getByRole('button', { name: '확인' })).toHaveAttribute('class', PRIMARY)
  })

  it('text 변형 — 채움 없는 보조 동작', () => {
    render(<Button variant="text">취소</Button>)

    expect(screen.getByRole('button', { name: '취소' })).toHaveAttribute('class', TEXT)
  })

  it('danger 변형 — 파괴적 동작(연결 해제 등)', () => {
    render(<Button variant="danger">해제</Button>)

    expect(screen.getByRole('button', { name: '해제' })).toHaveAttribute('class', DANGER)
  })

  // 주 CTA 옆/아래에 서는 부 동작. danger 와 같은 테두리 pill 이되 색이 중립이라
  // 파괴적 동작과 헷갈리지 않는다(design-system.md 「기본 컴포넌트」).
  it('outline 변형 — 중립 테두리 pill', () => {
    render(<Button variant="outline">발급 방법 보기</Button>)

    expect(screen.getByRole('button', { name: '발급 방법 보기' })).toHaveAttribute('class', OUTLINE)
  })

  // 외부 URL로 나가는 이동은 <button> 이 아니라 <a> 여야 하므로(링크 시맨틱·target/rel),
  // 겉모습만 입힐 수 있게 변형 클래스를 별도 모듈(variants.ts)에 둔다 — 컴포넌트 파일이
  // 컴포넌트 아닌 값을 export 하면 fast refresh 가 깨진다. Button 자신도 같은 상수를 쓴다.
  it('변형 클래스를 별도 모듈로 빼 <a> 도 같은 외형을 입을 수 있다', () => {
    expect(BUTTON_VARIANT_CLASS.outline).toBe(OUTLINE)
    expect(BUTTON_VARIANT_CLASS.primary).toBe(PRIMARY)
  })

  it('className은 코어 뒤에 이어 붙는다 — 레이아웃은 호출부가 소유한다', () => {
    render(
      <Button variant="primary" className="flex w-full items-center justify-center gap-2">
        저장
      </Button>,
    )

    expect(screen.getByRole('button', { name: '저장' })).toHaveAttribute(
      'class',
      `${PRIMARY} flex w-full items-center justify-center gap-2`,
    )
  })

  it('type 기본값은 button이다 — 폼 안에서 의도치 않게 submit되지 않게', () => {
    render(<Button variant="primary">확인</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('type을 명시하면 그대로 쓴다', () => {
    render(
      <Button variant="primary" type="submit">
        전송
      </Button>,
    )

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('나머지 버튼 속성(onClick·disabled·aria)은 그대로 전달된다', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" onClick={onClick} disabled aria-label="저장하기">
        저장
      </Button>,
    )

    const button = screen.getByRole('button', { name: '저장하기' })
    expect(button).toBeDisabled()
    button.click()
    expect(onClick).not.toHaveBeenCalled()
  })
})
