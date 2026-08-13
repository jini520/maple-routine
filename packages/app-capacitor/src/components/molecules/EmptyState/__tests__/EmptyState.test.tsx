// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Swords } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmptyState } from '../EmptyState'
import { UnavailableNotice } from '../UnavailableNotice'

afterEach(() => {
  cleanup()
})

describe('EmptyState', () => {
  it('제목과 설명을 렌더링한다', () => {
    render(
      <EmptyState
        icon={Swords}
        title="추적할 주간 보스가 없습니다"
        description="보스 관리에서 이번 주에 잡을 보스를 골라주세요"
      />,
    )

    expect(screen.getByText('추적할 주간 보스가 없습니다')).toBeInTheDocument()
    expect(screen.getByText('보스 관리에서 이번 주에 잡을 보스를 골라주세요')).toBeInTheDocument()
  })

  it('action을 주면 CTA 버튼이 보이고 클릭 시 onClick이 호출된다', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <EmptyState
        icon={Swords}
        title="추적할 주간 보스가 없습니다"
        action={{ label: '보스 관리', onClick }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '보스 관리' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // 자동 모드("게임에서 등록해주세요")·보스 수익처럼 앱 안에 목적지가 없는 곳은 CTA를 만들지 않는다(ADR-060 결정 3).
  it('action이 없으면 버튼을 그리지 않는다', () => {
    render(<EmptyState icon={Swords} title="등록된 주간 보스가 없습니다" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('description이 없으면 설명 문단 자체가 없다', () => {
    render(<EmptyState icon={Swords} title="등록된 주간 보스가 없습니다" />)

    expect(screen.getByTestId('empty-state-title')).toBeInTheDocument()
    expect(screen.queryByTestId('empty-state-description')).not.toBeInTheDocument()
  })

  it('아이콘은 장식이므로 접근성 트리에서 숨긴다', () => {
    render(<EmptyState icon={Swords} title="등록된 주간 보스가 없습니다" />)

    expect(screen.getByTestId('empty-state-badge')).toHaveAttribute('aria-hidden', 'true')
  })

  // page(캐릭터 미선택 3곳)와 inline(목록 8곳)은 배지 크기·타이포만 다르고 구조는 같다(ADR-060 결정 1).
  it('기본은 inline 크기 — 56px 배지, 자체 박스를 가진다', () => {
    render(<EmptyState icon={Swords} title="추적할 주간 보스가 없습니다" />)

    expect(screen.getByTestId('empty-state-badge')).toHaveClass('h-14', 'w-14')
    expect(screen.getByTestId('empty-state')).toHaveClass('border', 'bg-surface')
    expect(screen.getByTestId('empty-state-title')).toHaveClass('text-sm')
  })

  // ADR-060 정정: 캐릭터 미선택(page) 3곳은 컨텍스트 아이콘이 아니라 브랜드 마크(단풍잎)를 쓴다.
  it('icon="leaf"면 lucide 아이콘 대신 단풍잎 마크를 그린다', () => {
    render(<EmptyState size="page" icon="leaf" title="표시할 캐릭터가 없습니다" />)

    expect(screen.getByTestId('empty-state-leaf')).toBeInTheDocument()
  })

  it('lucide 아이콘을 주면 단풍잎 마크는 그리지 않는다', () => {
    render(<EmptyState icon={Swords} title="추적할 주간 보스가 없습니다" />)

    expect(screen.queryByTestId('empty-state-leaf')).not.toBeInTheDocument()
  })

  it('size=page면 84px 배지에 큰 타이포, 자체 박스는 없다(화면이 감싼다)', () => {
    render(<EmptyState size="page" icon={Swords} title="표시할 캐릭터가 없습니다" />)

    expect(screen.getByTestId('empty-state-badge')).toHaveClass('h-[84px]', 'w-[84px]')
    expect(screen.getByTestId('empty-state')).not.toHaveClass('border')
    expect(screen.getByTestId('empty-state-title')).toHaveClass('text-base')
  })
})

describe('UnavailableNotice', () => {
  // "조회 불가"는 빈 상태가 아니라 확인 자체를 못 한 상태 — 디자인을 공유하면 "데이터가 없다"로 오해된다(ADR-060 결정 5).
  it('제목과 설명을 렌더링한다', () => {
    render(<UnavailableNotice />)

    expect(screen.getByText('이 기간은 조회할 수 없습니다')).toBeInTheDocument()
    expect(screen.getByTestId('unavailable-notice-description')).toHaveTextContent(
      '처치 기록이 없다는 뜻은 아닙니다',
    )
  })

  it('경고(error)가 아니라 정보 톤으로 그린다', () => {
    render(<UnavailableNotice />)

    expect(screen.getByTestId('unavailable-notice')).toHaveClass('bg-info-tint')
  })

  it('compact면 카드 안에 들어가도록 축소하고 설명을 생략한다', () => {
    render(<UnavailableNotice compact />)

    expect(screen.getByText('이 기간은 조회할 수 없습니다')).toBeInTheDocument()
    expect(screen.queryByTestId('unavailable-notice-description')).not.toBeInTheDocument()
  })
})
