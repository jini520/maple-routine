// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorState } from '../ErrorState'
import { StaleBanner } from '../StaleBanner'

afterEach(() => {
  cleanup()
})

describe('ErrorState', () => {
  it('제목과 설명을 렌더링한다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" description="네트워크 연결을 확인해주세요" />)

    expect(screen.getByText('캐릭터 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText('네트워크 연결을 확인해주세요')).toBeInTheDocument()
  })

  it('설명이 없으면 제목만 렌더링한다', () => {
    render(<ErrorState title="요청이 너무 많습니다" />)

    expect(screen.getByText('요청이 너무 많습니다')).toBeInTheDocument()
    expect(screen.queryByTestId('error-state-description')).not.toBeInTheDocument()
  })

  // ADR-116 결정 4: `action` 이 옵셔널인 것은 "액션이 없어도 된다"가 아니라 **그 자리의 진행
  // 경로를 다른 것(모달의 닫기·취소, 위에 덮이는 안내 모달)이 제공할 수 있다**는 뜻이다. 조건이
  // 지켜지는지는 이 컴포넌트가 알 수 없으므로 각 호출부 테스트가 본다(피커·온보딩·설정 계정 변경).
  it('액션이 없으면 버튼을 만들지 않는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = vi.fn()
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" action={{ label: '다시 시도', onClick }} />)

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // ADR-062 결정 1: 세 상태(조회 중 / 빈 상태 / 실패)가 구분 가능해야 한다. EmptyState는 아이콘을
  // 원형 배지로 감싸므로, ErrorState가 배지를 쓰지 않는 것이 그 구분의 시각적 근거다.
  it('아이콘을 배지로 감싸지 않는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.queryByTestId('empty-state-badge')).not.toBeInTheDocument()
  })

  it('스크린리더에 즉시 알리도록 role=alert 를 갖는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('StaleBanner', () => {
  it('문구와 액션 버튼을 렌더링한다', () => {
    render(<StaleBanner message="목록이 최신이 아닙니다" action={{ label: '다시 시도', onClick: () => {} }} />)

    expect(screen.getByText('목록이 최신이 아닙니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  // 라벨은 하드코딩된 "다시 시도"가 아니라 호출부가 넘긴 값이다 — 피커의 401은 "설정 열기"를
  // 받는다(ADR-114 결정 3).
  it('"다시 시도"가 아닌 라벨도 그대로 렌더링한다', () => {
    render(<StaleBanner message="API 키가 유효하지 않아 목록을 갱신하지 못했습니다" action={{ label: '설정 열기', onClick: () => {} }} />)

    expect(screen.getByRole('button', { name: '설정 열기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = vi.fn()
    render(<StaleBanner message="목록이 최신이 아닙니다" action={{ label: '다시 시도', onClick }} />)

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // ADR-114 결정 2·3: 재시도가 통하지 않는 실패(429·characterUnavailable·온보딩 401)에는 액션이
  // 없다. 배너는 목록이 남아 있는 자리라 액션이 없어도 막다른 길이 아니다.
  it('액션이 없으면 버튼을 만들지 않는다', () => {
    render(<StaleBanner message="호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요" />)

    expect(screen.getByText('호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('role=alert 를 갖는다', () => {
    render(<StaleBanner message="목록이 최신이 아닙니다" />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
