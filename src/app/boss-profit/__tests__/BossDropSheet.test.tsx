// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakePreferences } from '@core/storage/__tests__/fake-preferences'
import { useDropEffectStore } from '../../../features/drop-effect/store'
import { BossDropSheet } from '../BossDropSheet'

// vitest globals 미설정이라 자동 cleanup이 없다 — 포털 시트가 body에 누적되지 않도록 수동 정리.
afterEach(cleanup)
// 연출 토글은 전역 스토어라 테스트 간 오염을 막기 위해 매번 기본값(연출 표시)으로 되돌린다.
// 토글은 저장소까지 내려가므로(storage/drop-effect) 포트도 함께 주입한다([[ADR-127]]).
beforeEach(() => {
  installFakePreferences()
  useDropEffectStore.setState({ enabled: true })
})

describe('BossDropSheet', () => {
  it('일반 아이템을 토글하고 추가 완료 시 onSave에 기록이 담긴다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()

    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    expect(screen.getByTestId('boss-drop-sheet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
    ])
    expect(onClose).toHaveBeenCalled()
  })

  it('반지 상자를 탭하면 드릴다운에서 등급+반지를 골라 기록한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    // 상자 탭 → 드릴다운
    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    // 드릴다운에는 제거 버튼이 없다(재탭 제거로 대체, ADR-040)
    expect(screen.queryByRole('button', { name: '제거' })).not.toBeInTheDocument()
    // 등급 + 반지 선택 전에는 기록 버튼 비활성
    const confirm = screen.getByRole('button', { name: '이 결과로 기록' })
    expect(confirm).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    // 다시 메인 → 추가 완료
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '리스트레인트 링',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
      },
    ])
  })

  // ADR-040
  it('결과가 지정된 상자를 다시 탭하면 드릴다운 없이 선택을 제거한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    // 상자 선택 → 드릴다운에서 결과 기록
    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    await user.click(screen.getByRole('button', { name: '이 결과로 기록' }))

    // 이제 타일은 지정된 반지를 표시 — 다시 탭하면 드릴다운이 열리지 않고 제거된다
    await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
    expect(screen.queryByRole('button', { name: '이 결과로 기록' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 완료/ }))
    expect(onSave).toHaveBeenCalledWith([])
  })

  // ADR-041: 백옥 밖 저가치 반지는 '기타'로 묶여 레벨과 함께 기록된다
  it("반지 상자에서 '기타'를 고르면 레벨과 함께 '기타'로 기록된다", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: '기타' }))
    await user.click(screen.getByRole('button', { name: '3레벨' }))
    await user.click(screen.getByRole('button', { name: '이 결과로 기록' }))
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '기타',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
      },
    ])
  })

  // ADR-041: 생명 상자의 연마석은 레벨이 없어 레벨 선택이 비활성이고 레벨 없이 기록된다
  it('연마석을 고르면 레벨 선택이 비활성이고 레벨 없이 기록 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="카링" difficulty="하드" isComplete initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /생명의 보스 반지 상자/ }))
    await user.click(screen.getByRole('button', { name: /생명의 연마석/ }))

    // 연마석은 레벨이 없어 레벨 버튼 비활성
    expect(screen.getByRole('button', { name: '3레벨' })).toBeDisabled()
    // 레벨 없이도 기록 가능
    const confirm = screen.getByRole('button', { name: '이 결과로 기록' })
    expect(confirm).toBeEnabled()
    await user.click(confirm)
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      {
        category: 'consumable',
        itemName: '생명의 연마석',
        boxOrigin: '생명의 보스 반지 상자',
        quantity: 1,
      },
    ])
  })

  it('고가 아이템(칠흑 세트)을 추가하면 드롭 이펙트 오버레이가 뜬다', async () => {
    const user = userEvent.setup()

    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    expect(screen.getByTestId('drop-effect-overlay')).toBeInTheDocument()
  })

  it('비고가 아이템은 이펙트를 띄우지 않는다', async () => {
    const user = userEvent.setup()

    // 데이브레이크 펜던트(여명 세트)는 비고가·비박스 일반 아이템
    render(
      <BossDropSheet boss="진 힐라" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /데이브레이크 펜던트/ }))
    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
  })

  // ADR-040
  it('고정 드롭은 읽기 전용이라 토글 버튼이 아니고 기록에 담기지 않는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={onSave} onClose={vi.fn()} />,
    )

    // 고정 아이템(주문의 흔적)은 아이콘으로만 표시되고 버튼(선택 대상)이 아니다
    expect(screen.getAllByRole('img', { name: '주문의 흔적' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /주문의 흔적/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /추가 완료/ }))
    expect(onSave).toHaveBeenCalledWith([])
  })

  it('아이템 타일에는 난이도 약자 칩을 표시하지 않는다 (단일 난이도 필터링)', () => {
    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    // 하드 뷰에서 루즈 컨트롤 타일은 익스트림 약자 칩('익')을 더 이상 달지 않는다
    const tile = screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ })
    expect(tile.textContent).not.toContain('익')
  })

  it('드롭 연출을 끄면(enabled=false) 고가 아이템을 추가해도 이펙트가 뜨지 않는다', async () => {
    const user = userEvent.setup()
    useDropEffectStore.setState({ enabled: false })

    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    expect(screen.queryByTestId('drop-effect-overlay')).not.toBeInTheDocument()
  })

  // ADR-040 정정 4(이슈 #162): 라벨은 긍정형 '드롭 연출'이고 스위치 활성 = 연출 표시다. 저장
  // 스키마는 positive 모델(enabled) 그대로이므로, UI가 그 값을 반전 없이 그리는지를 고정한다.
  it("'드롭 연출' 토글은 연출이 켜져 있을 때 켜짐 상태다(반전 회귀 방지)", () => {
    useDropEffectStore.setState({ enabled: true })
    const { rerender } = render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    // 연출 표시 중 → '드롭 연출'은 활성(체크)이어야 한다
    expect(screen.getByRole('switch', { name: '드롭 연출' })).toHaveAttribute('aria-checked', 'true')

    // 연출을 끄면(enabled=false) → '드롭 연출'이 비활성(미체크)이 된다
    useDropEffectStore.setState({ enabled: false })
    rerender(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('switch', { name: '드롭 연출' })).toHaveAttribute('aria-checked', 'false')
  })

  // 토글을 눌렀을 때 저장값이 "라벨이 말하는 대로" 움직이는지 — 켜져 있을 때 누르면 꺼진다.
  // 위 회귀 테스트가 표시 방향만 보므로, 쓰기 방향은 여기서 고정한다.
  it("'드롭 연출' 토글을 누르면 스토어 값이 반대로 뒤집힌다", async () => {
    const user = userEvent.setup()
    useDropEffectStore.setState({ enabled: true })
    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('switch', { name: '드롭 연출' }))
    expect(useDropEffectStore.getState().enabled).toBe(false)
  })

  // 하단 고정 바가 iOS 홈 인디케이터·Android 제스처 영역을 침범하지 않도록, 프로젝트 컨벤션인
  // var(--sa-bottom)(index.css)로 안전영역만큼 여백을 둔다. env() 직접 사용은 구형 Android WebView에서
  // 어긋나므로 금지.
  it('메인 "추가 완료" 바 하단에 안전영역 패딩이 적용된다', () => {
    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const footer = screen.getByRole('button', { name: /추가 완료/ }).parentElement
    expect(footer).toHaveClass('pb-[calc(0.75rem+var(--sa-bottom))]')
  })

  it('상자 드릴다운 "이 결과로 기록" 바 하단에 안전영역 패딩이 적용된다', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet boss="스우" difficulty="하드" isComplete initialDrops={[]} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
    const footer = screen.getByRole('button', { name: '이 결과로 기록' }).parentElement
    expect(footer).toHaveClass('pb-[calc(0.75rem+var(--sa-bottom))]')
  })

  // ── 난이도별 표시 ─────────────────────────────────────────────────────────
  describe('난이도별 드롭 표시', () => {
    it('기본 난이도(행 난이도)의 아이템만 표시한다 (스우 하드)', () => {
      render(
        <BossDropSheet
          boss="스우"
          difficulty="하드"
          isComplete
          initialDrops={[]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      // 하드 아이템은 보이고
      expect(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ })).toBeInTheDocument()
      // 다른 난이도 전용 아이템은 안 보인다
      expect(screen.queryByRole('button', { name: /컴플리트 언더컨트롤/ })).not.toBeInTheDocument() // 익스트림 전용
      expect(screen.queryByRole('button', { name: /녹옥의 보스 반지 상자/ })).not.toBeInTheDocument() // 노멀 전용
      expect(screen.queryByRole('button', { name: /백옥의 보스 반지 상자/ })).not.toBeInTheDocument() // 익스트림 전용
    })

    it('완료 시 난이도를 선택할 수 없고 완료 난이도 뱃지만 노출한다', () => {
      render(
        <BossDropSheet
          boss="스우"
          difficulty="하드"
          isComplete
          initialDrops={[]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      // 완료 난이도(하드) 뱃지는 선택 안내 라인에 있다
      const header = screen.getByText('획득한 아이템을 선택하세요').parentElement as HTMLElement
      expect(within(header).getByText('하드')).toBeInTheDocument()
      // 완료 뱃지도 안내 라인 오른쪽 끝으로 정렬(ml-auto 래퍼)
      expect(within(header).getByText('하드').parentElement?.className).toContain('ml-auto')
      // 다른 난이도 뱃지(노멀·익스트림)는 선택 버튼으로 노출되지 않는다
      expect(within(header).queryByRole('button', { name: /노멀/ })).not.toBeInTheDocument()
      expect(within(header).queryByRole('button', { name: /익스트림/ })).not.toBeInTheDocument()
    })

    it('미완료 시 드롭 테이블의 난이도 뱃지를 선택 버튼으로 나열하고, 선택 안 된 것은 흐림 처리한다', () => {
      render(
        <BossDropSheet
          boss="스우"
          difficulty="하드"
          isComplete={false}
          initialDrops={[]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      const header = screen.getByText('획득한 아이템을 선택하세요').parentElement as HTMLElement
      // 스우 드롭 테이블 난이도(노멀·하드·익스트림)가 선택 버튼으로 나열된다
      const normal = within(header).getByRole('button', { name: /노멀/ })
      const hard = within(header).getByRole('button', { name: /하드/ })
      const extreme = within(header).getByRole('button', { name: /익스트림/ })

      // 기본 선택 = 행 난이도(하드)
      expect(hard).toHaveAttribute('aria-pressed', 'true')
      expect(normal).toHaveAttribute('aria-pressed', 'false')
      expect(extreme).toHaveAttribute('aria-pressed', 'false')
      // 선택 안 된 뱃지는 흐림 처리
      expect(normal.className).toContain('opacity-40')
      expect(extreme.className).toContain('opacity-40')
      expect(hard.className).not.toContain('opacity-40')
      // 난이도 토글은 안내 라인 오른쪽 끝으로 정렬(ml-auto)
      expect(hard.parentElement?.className).toContain('ml-auto')
    })

    it('미완료에서 난이도를 바꾸면 해당 난이도의 아이템으로 갱신된다', async () => {
      const user = userEvent.setup()
      render(
        <BossDropSheet
          boss="스우"
          difficulty="하드"
          isComplete={false}
          initialDrops={[]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />,
      )

      const header = screen.getByText('획득한 아이템을 선택하세요').parentElement as HTMLElement
      await user.click(within(header).getByRole('button', { name: /익스트림/ }))

      // 익스트림 전용 아이템이 나타나고
      expect(screen.getByRole('button', { name: /컴플리트 언더컨트롤/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /백옥의 보스 반지 상자/ })).toBeInTheDocument()
      // 하드 전용 상자는 사라진다 (루즈 컨트롤은 하드+익스트림 공통이라 유지)
      expect(screen.queryByRole('button', { name: /홍옥의 보스 반지 상자/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ })).toBeInTheDocument()
    })

    it('난이도 변경 시 새 난이도에 있는 선택은 유지하고 없는 선택은 초기화한다', async () => {
      const user = userEvent.setup()
      const onSave = vi.fn()
      render(
        <BossDropSheet
          boss="스우"
          difficulty="하드"
          isComplete={false}
          initialDrops={[]}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      )

      // 하드에서: 루즈 컨트롤(하드+익스트림 공통) + 홍옥 상자(하드 전용) 선택
      await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
      await user.click(screen.getByRole('button', { name: /홍옥의 보스 반지 상자/ }))
      await user.click(screen.getByRole('button', { name: '3레벨' }))
      await user.click(screen.getByRole('button', { name: /리스트레인트 링/ }))
      await user.click(screen.getByRole('button', { name: '이 결과로 기록' }))

      // 익스트림으로 전환 → 홍옥(하드 전용) 선택은 초기화, 루즈 컨트롤은 유지
      const header = screen.getByText('획득한 아이템을 선택하세요').parentElement as HTMLElement
      await user.click(within(header).getByRole('button', { name: /익스트림/ }))
      await user.click(screen.getByRole('button', { name: /추가 완료/ }))

      expect(onSave).toHaveBeenCalledWith([
        { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
      ])
    })
  })
})

// [[ADR-124]] 결정 6 — 시트 안에서 `기록 → 확인 → (입력 →) 복귀`. 이 흐름이 실제로 배선됐는지.
describe('시트 안 가격 입력 (ADR-124 결정 6)', () => {
  const pricing = { defaultShare: 3, maxShare: 6, characterName: '지내우시' }

  function renderPricingSheet(): { onSave: ReturnType<typeof vi.fn> } {
    const onSave = vi.fn()
    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={onSave}
        onClose={vi.fn()}
        pricing={pricing}
      />,
    )
    return { onSave }
  }

  it('아이템을 기록하면 가격을 물어본다 — 기록 자체는 막지 않는다', async () => {
    const user = userEvent.setup()
    renderPricingSheet()

    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    expect(screen.getByTestId('drop-price-prompt')).toHaveTextContent('판매 가격을 입력할까요?')
    // 기록은 이미 끝났다 — 물음이 그것을 막지 않는다([[ADR-040]] 탭 즉시 기록).
    expect(screen.getByRole('button', { name: /추가 완료/ })).toHaveTextContent('1개')
  })

  it('"나중에" 를 누르면 물음만 사라지고 기록은 남는다', async () => {
    const user = userEvent.setup()
    renderPricingSheet()
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    await user.click(screen.getByRole('button', { name: '나중에' }))

    expect(screen.queryByTestId('drop-price-prompt')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /추가 완료/ })).toHaveTextContent('1개')
  })

  it('다른 아이템을 이어 찍으면 물음이 그쪽으로 갈아탄다 — 마지막 것만 입력되던 문제', async () => {
    const user = userEvent.setup()
    // 한 난이도에 선택 가능한 장비가 둘인 보스라야 이 경우를 만들 수 있다 — 스우 하드는
    // 장비가 하나뿐이다(컴플리트 언더컨트롤은 익스트림 전용).
    render(
      <BossDropSheet
        boss="더스크"
        difficulty="카오스"
        isComplete
        initialDrops={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        pricing={pricing}
      />,
    )
    await user.click(screen.getByRole('button', { name: /거대한 공포/ }))
    expect(screen.getByTestId('drop-price-prompt')).toHaveTextContent('거대한 공포')

    await user.click(screen.getByRole('button', { name: /에스텔라 이어링/ }))

    expect(screen.getByTestId('drop-price-prompt')).toHaveTextContent('에스텔라 이어링')
  })

  it('"가격 입력" 은 시트를 닫지 않고 키패드로 들어갔다가 그리드로 돌아온다', async () => {
    const user = userEvent.setup()
    renderPricingSheet()
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))

    // 드릴다운 — 시트는 살아 있고 내용만 갈렸다.
    expect(screen.getByTestId('drop-price-amount')).toBeInTheDocument()
    expect(screen.getByText('3인')).toBeInTheDocument() // 분배 기본값 = 파티원 수

    await user.click(screen.getByRole('button', { name: '+1억' }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    // 그리드로 복귀 — 하던 작업(다른 아이템 고르기)을 잇는다.
    expect(screen.queryByTestId('drop-price-amount')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '가격 입력됨' })).toBeInTheDocument()
  })

  it('값을 매긴 뒤 추가 완료하면 가격이 함께 저장된다', async () => {
    const user = userEvent.setup()
    const { onSave } = renderPricingSheet()
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))
    await user.click(screen.getByRole('button', { name: '+1억' }))
    await user.click(screen.getByRole('button', { name: '저장' }))
    await user.click(screen.getByRole('button', { name: /추가 완료/ }))

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({
        itemName: '루즈 컨트롤 머신 마크',
        priceState: 'entered',
        priceMeso: 100_000_000,
        priceShare: 3,
      }),
    ])
  })

  it('pricing 을 넘기지 않으면 물음도 배지도 뜨지 않는다 — 가격 개념이 없는 호출부 보호', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))

    expect(screen.queryByTestId('drop-price-prompt')).not.toBeInTheDocument()
  })
})

// 2026-08-10 — 대상이 바뀌면 값이 따라가야 한다. 시트 드릴다운은 컴포넌트를 언마운트하지 않는다.
describe('가격 키패드 — 대상 전환·초기화', () => {
  const pricing = { defaultShare: 3, maxShare: 6, characterName: '지내우시' }

  it('다른 아이템으로 넘어가면 치던 금액이 따라가지 않는다', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet
        boss="더스크"
        difficulty="카오스"
        isComplete
        initialDrops={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        pricing={pricing}
      />,
    )

    await user.click(screen.getByRole('button', { name: /거대한 공포/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))
    await user.click(screen.getByRole('button', { name: '+1억' }))
    expect(screen.getByTestId('drop-price-amount')).toHaveTextContent('100,000,000')
    await user.click(screen.getByRole('button', { name: '뒤로' }))

    // 두 번째 아이템 — 앞의 1억이 남아 있으면 안 된다.
    await user.click(screen.getByRole('button', { name: /에스텔라 이어링/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))

    expect(screen.getByTestId('drop-price-amount')).toHaveTextContent('0')
  })

  it('초기화 버튼이 금액만 0으로 되돌린다 — 분배 인원은 그대로', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        pricing={pricing}
      />,
    )
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))
    await user.click(screen.getByRole('button', { name: '+100억' }))
    await user.click(screen.getByRole('button', { name: '분배 인원 감소' }))

    await user.click(screen.getByRole('button', { name: '가격 초기화' }))

    expect(screen.getByTestId('drop-price-amount')).toHaveTextContent('0')
    expect(screen.getByText('2인')).toBeInTheDocument()
  })

  it('가격이 입력된 타일 배지는 수익 탭과 같은 아이콘이다', async () => {
    const user = userEvent.setup()
    render(
      <BossDropSheet
        boss="스우"
        difficulty="하드"
        isComplete
        initialDrops={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        pricing={pricing}
      />,
    )
    await user.click(screen.getByRole('button', { name: /루즈 컨트롤 머신 마크/ }))
    await user.click(screen.getByRole('button', { name: '가격 입력' }))
    await user.click(screen.getByRole('button', { name: '+1억' }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    const badge = screen.getByRole('img', { name: '가격 입력됨' })
    expect(badge.querySelector('[data-testid="profit-icon"]')).not.toBeNull()
  })
})
