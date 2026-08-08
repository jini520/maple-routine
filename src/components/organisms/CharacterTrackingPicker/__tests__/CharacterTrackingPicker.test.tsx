// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CharacterTrackingPicker } from '../CharacterTrackingPicker'
import type { CharacterPickerEntry } from '../../../../types'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', world: '엘리시움' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null, world: '베라' },
  // 리부트는 world-emblems 매핑에 없어 엠블럼 폴백(생략)을 테스트한다
  { ocid: 'ocid-3', name: '테스트캐릭터', level: 165, imageUrl: null, world: '리부트' },
]

// ADR-053 결정 3: 로딩/실패는 호출부가 getCharacterPickerRoster의 Promise로 판정해 내려준다.
// ADR-062 결정 2: loadFailed(boolean)를 loadError(원인)로 바꿔 원인별 문구·액션을 그린다.
// 아래 기존 케이스는 모두 "조회 완료 + 성공" 상태를 전제한다.
const loaded = { isLoading: false, loadError: null, onRetry: vi.fn(), onOpenSettings: vi.fn() }

describe('CharacterTrackingPicker', () => {
  it('제목과 설명을 보여준다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('heading', { name: '캐릭터 관리' })).toBeInTheDocument()
    expect(
      screen.getByText('체크한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 명은 선택해주세요.'),
    ).toBeInTheDocument()
  })

  // ADR-086 결정 7: 0명은 화면을 빈 상태로 만들 뿐 어떤 사용자 의도도 표현하지 않는다.
  it('전부 해제하면 저장 버튼이 비활성이다 — 목록을 통째로 비울 수 없다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('trackedOcids에 포함된 캐릭터가 초기에 선택(즐겨찾기) 상태로 표시된다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1', 'ocid-3']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /낟낟/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /내옆에최성일/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /테스트캐릭터/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('카드를 클릭해도 즉시 onSave가 호출되지 않는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장 버튼 클릭 시 그 시점의 선택 상태로 onSave를 호출한다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))
    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(onSave).toHaveBeenCalledWith(['ocid-2'])
  })

  it('선택을 바꾸지 않으면 저장 버튼이 비활성이다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('캐릭터를 추가로 체크하면 저장 버튼이 활성화된다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))

    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('바꿨다가 원래 집합으로 되돌리면 저장 버튼이 다시 비활성이 된다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))
    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('선택 순서만 달라진 동일 집합에서도 저장 버튼이 비활성으로 유지된다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1', 'ocid-2']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // 해제 후 다시 선택하면 배열은 ['ocid-2', 'ocid-1'] 순서가 되지만 집합은 동일하다.
    await user.click(screen.getByRole('button', { name: /낟낟/ }))
    await user.click(screen.getByRole('button', { name: /낟낟/ }))

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('닫기 버튼 클릭 시 onSave 없이 onClose만 호출된다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))
    await user.click(screen.getByRole('button', { name: '닫기' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('오버레이(바깥 영역)를 클릭해도 닫히지 않는다 — 닫기 버튼으로만 닫는다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByTestId('character-tracking-picker-overlay'))

    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('각 캐릭터 카드에 서버(월드) 엠블럼을 표시한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const emblem = screen.getByAltText('엘리시움')
    expect(emblem.tagName).toBe('IMG')
    expect(emblem).toHaveAttribute('src')
  })

  it('매핑에 없는 월드는 엠블럼을 표시하지 않는다(폴백)', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByAltText('리부트')).not.toBeInTheDocument()
  })

  it('imageUrl이 있으면 캐릭터 이미지를 렌더링한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByRole('img', { name: '낟낟' })).toHaveAttribute('src', 'https://example.com/1.png')
  })

  it('imageUrl이 null이면 이미지 대신 플레이스홀더를 표시한다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    const card = screen.getByRole('button', { name: /내옆에최성일/ })
    // 아바타(캐릭터명 alt)는 없고 '?' 플레이스홀더. 서버 엠블럼(월드명 alt)은 별개로 존재할 수 있다.
    expect(within(card).queryByRole('img', { name: '내옆에최성일' })).not.toBeInTheDocument()
    expect(within(card).getByText('?')).toBeInTheDocument()
  })

  it('즐겨찾기한 캐릭터가 레벨이 낮아도 그룹 맨 앞으로 재정렬된다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))

    const buttons = screen.getAllByRole('button', { name: /낟낟|내옆에최성일|테스트캐릭터/ })
    expect(buttons[0]).toHaveTextContent('테스트캐릭터')
    expect(buttons[1]).toHaveTextContent('낟낟')
    expect(buttons[2]).toHaveTextContent('내옆에최성일')
  })

  it('즐겨찾기를 다시 해제하면 원래 순서(레벨 내림차순)로 되돌아간다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))
    await user.click(screen.getByRole('button', { name: /테스트캐릭터/ }))

    const buttons = screen.getAllByRole('button', { name: /낟낟|내옆에최성일|테스트캐릭터/ })
    expect(buttons[0]).toHaveTextContent('낟낟')
    expect(buttons[1]).toHaveTextContent('내옆에최성일')
    expect(buttons[2]).toHaveTextContent('테스트캐릭터')
  })

  it('열려 있는 동안 뒷 페이지(body) 스크롤을 막는다', () => {
    const { unmount } = render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(document.body.style.overflow).toBe('')
  })
})

// ADR-053 결정 3: 그리드에 보여줄 항목이 없을 때 "조회 중"·"활성 캐릭터 0명"·"조회 실패"를
// 서로 구분해 그린다(실패를 빈 상태로 위장하지 않는다 — error-resilience.md 원칙 1·2).
describe('CharacterTrackingPicker — 로딩/빈/실패 상태 (ADR-053 · ADR-062)', () => {
  it('조회 중이고 보여줄 항목이 없으면 스피너를 보여주고 그리드 항목은 없다', () => {
    render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        isLoading
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByTestId('maple-sweep-spinner')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('button', { name: /낟낟/ })).not.toBeInTheDocument()
  })

  it('조회 중이어도 캐시로 보여줄 항목이 있으면 스피너 대신 그리드를 그린다(ADR-016 캐시 우선 표시)', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        isLoading
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  it('조회가 끝났는데 항목이 없으면 빈 상태 안내를 보여준다(스피너 없음)', () => {
    render(
      <CharacterTrackingPicker entries={[]} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.getByText('표시할 캐릭터가 없어요')).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('항목 없이 실패하면 빈 상태와 구분되는 ErrorState를 보여준다', () => {
    render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('캐릭터 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).not.toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
  })

  it('실패 원인에 따라 문구가 달라진다 — 401은 무효 키를 말한다', () => {
    render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'invalidApiKey' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()
  })

  it('network 실패의 다시 시도를 누르면 onRetry가 호출된다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onRetry={onRetry}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // ADR-062 결정 3: 401에 재시도를 주는 것은 눌러도 실패하는 버튼을 주는 것이다.
  it('401 실패는 재시도가 아니라 설정 열기를 준다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onOpenSettings = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'invalidApiKey' }}
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '설정 열기' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  // ADR-062 결정 4: 캐시 stub이 네트워크보다 먼저 방출되므로(ADR-017 결정 6) 예열이 끝난
  // 정상 경로에서는 이쪽이 기본 분기다 — 배너가 없으면 실패의 대다수가 무음이 된다.
  it('보여줄 항목이 있는 채로 실패하면 그리드를 지우지 않고 스탈 배너를 얹는다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.getByText('목록이 최신이 아닙니다')).toBeInTheDocument()
    // 자리 전체를 차지하는 ErrorState는 그리지 않는다
    expect(screen.queryByText('캐릭터 목록을 불러오지 못했습니다')).not.toBeInTheDocument()
  })

  it('스탈 배너의 다시 시도를 누르면 onRetry가 호출된다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onRetry={onRetry}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // ADR-114 결정 3: 배너 문구·액션이 원인별로 갈린다. 액션을 뺄 수 있는 근거는 자리다 —
  // 배너 아래에 목록이 남아 있어 액션이 없어도 막다른 길이 아니다.
  // 모달에는 "닫기"·"저장"이 항상 있으므로 버튼 유무는 배너 안에서만 단언한다.
  it('429는 서비스 단계 키를 확인하라 말하고 액션을 주지 않는다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'rateLimited' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요')).toBeInTheDocument()
    // 눌러도 또 429인 버튼은 "고칠 수 있다"는 잘못된 신호다(ADR-114 결정 2).
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument()
    // 목록은 그대로 남는다 — 그것이 액션을 뺄 수 있는 근거다.
    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
  })

  it('401 배너는 재시도가 아니라 설정 열기를 준다', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onOpenSettings = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'invalidApiKey' }}
        onRetry={onRetry}
        onOpenSettings={onOpenSettings}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('API 키가 유효하지 않아 목록을 갱신하지 못했습니다')).toBeInTheDocument()
    expect(within(banner).queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()

    await user.click(within(banner).getByRole('button', { name: '설정 열기' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  // ADR-067 결정 1: 400 OPENAPI00003은 영구다 — 언제 눌러도 같은 400이라 액션을 주지 않는다.
  it('조회 불가(400)는 배너에 액션을 주지 않는다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'characterUnavailable' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const banner = screen.getByTestId('stale-banner')
    expect(within(banner).getByText('이 계정의 캐릭터를 조회할 수 없습니다')).toBeInTheDocument()
    expect(within(banner).queryByRole('button')).not.toBeInTheDocument()
  })

  it('조회가 끝나고 항목이 있으면 그리드만 보여준다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /낟낟/ })).toBeInTheDocument()
    expect(screen.queryByTestId('maple-sweep-spinner')).not.toBeInTheDocument()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // 사용자 보고 2026-07-30: 실패 상태의 액션 버튼이 아래 CTA에 붙어 보였다. 상태마다 높이가
  // 달라 CTA가 움직인 것이 원인이라, 본문 자리를 카드 3줄 높이로 못 박는다.
  // ADR-107 결정 2: 그 385px 는 모달에서 min() 으로 감싸진다 — 값은 같고, 385px 가 들어가지
  // 않는 짧은 기기에서만 양보한다(그대로 두면 min-height 가 카드 상한을 이겨 무효로 만든다).
  it.each([
    ['조회 중', { isLoading: true, loadError: null }],
    ['빈 상태', { isLoading: false, loadError: null }],
    ['실패', { isLoading: false, loadError: { kind: 'network' as const } }],
  ])('본문 자리는 %s에서도 카드 3줄 높이를 유지한다', (_label, state) => {
    const { container } = render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        {...state}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(
      container.querySelector(
        '.min-h-\\[min\\(385px\\,calc\\(100dvh-var\\(--sa-top\\)-var\\(--sa-bottom\\)-15rem\\)\\)\\]',
      ),
    ).not.toBeNull()
  })

  it('로딩 중이어도 저장 버튼 비활성 판정은 ADR-043 집합 비교 그대로다', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={['ocid-1']}
        {...loaded}
        isLoading
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    // 로딩 중에는 선택을 바꿀 수 없으니 자연히 비활성이다(별도 disabled 분기 없이).
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()

    rerender(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /내옆에최성일/ }))

    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })
})

// ADR-068 결정 4: 조회 불가 캐릭터(400 OPENAPI00003)를 숨기지 않고 별도 섹션에 남긴다 —
// 숨기면 trackedOcids에 남은 그 ocid를 사용자가 해제할 방법이 없다(이슈 #78 A-1).
describe('조회 불가 캐릭터', () => {
  const withUnavailable: CharacterPickerEntry[] = [
    { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: null, world: '엘리시움' },
    { ocid: 'ocid-x', name: '충쌕', level: 200, imageUrl: null, world: '베라', unavailable: true },
  ]

  it('별도 섹션으로 분리해 보여준다', () => {
    render(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={[]}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('조회할 수 없는 캐릭터')).toBeInTheDocument()
    const section = screen.getByTestId('unavailable-roster')
    expect(within(section).getByText('충쌕')).toBeInTheDocument()
    // 정상 후보는 그 섹션에 들어가지 않는다
    expect(within(section).queryByText('낟낟')).not.toBeInTheDocument()
  })

  it('추적 중이 아니면 눌러도 선택되지 않는다 — 고를 수 없는 후보다', async () => {
    const user = userEvent.setup()
    render(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={[]}
        {...loaded}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /충쌕/ }))

    expect(screen.getByRole('button', { name: /충쌕/ })).toHaveAttribute('aria-pressed', 'false')
    // 변경이 없으므로 저장 버튼도 활성되지 않는다(ADR-043 결정 1)
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
  })

  it('추적 중이면 눌러서 해제할 수 있다 — 갇힌 상태를 벗어나는 유일한 경로다', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={['ocid-1', 'ocid-x']}
        {...loaded}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /충쌕/ }))
    expect(screen.getByRole('button', { name: /충쌕/ })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(onSave).toHaveBeenCalledWith(['ocid-1'])
  })

  it('조회 불가 캐릭터가 없으면 섹션 자체를 그리지 않는다', () => {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )

    expect(screen.queryByText('조회할 수 없는 캐릭터')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unavailable-roster')).not.toBeInTheDocument()
  })
})

// ADR-107: 카드 높이의 상한은 "안전영역을 뺀 화면"이고, 스크롤포트는 그리드가 아니라 이 모달이
// 갖는다. jsdom 은 레이아웃을 계산하지 않으므로 그 규약을 클래스로 단언한다(PageHeader 와 같은 방식).
describe('CharacterTrackingPicker — 모달 높이·스크롤포트 (ADR-107)', () => {
  function renderPicker(): { overlay: HTMLElement; card: HTMLElement } {
    render(
      <CharacterTrackingPicker entries={entries} trackedOcids={[]} {...loaded} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    const overlay = screen.getByTestId('character-tracking-picker-overlay')
    return { overlay, card: overlay.firstElementChild as HTMLElement }
  }

  it('오버레이가 상하 안전영역 + 1rem 만큼 비운다 — 모달이 노치·제스처바에 닿지 않는다', () => {
    const { overlay } = renderPicker()

    expect(overlay).toHaveClass('px-4')
    expect(overlay).toHaveClass('pt-[calc(1rem+var(--sa-top))]')
    expect(overlay).toHaveClass('pb-[calc(1rem+var(--sa-bottom))]')
  })

  it('카드가 그 여백 안에 갇히고, 줄어드는 것은 본문 자리뿐이다', () => {
    const { card } = renderPicker()

    // max-h-full = 오버레이 콘텐츠 박스(= 안전영역·여백을 뺀 높이)
    expect(card).toHaveClass('flex', 'max-h-full', 'flex-col')
    // 헤더(제목·설명)와 푸터(닫기·저장)는 줄어들지 않는다
    expect(card.firstElementChild).toHaveClass('shrink-0')
    expect(card.lastElementChild).toHaveClass('shrink-0')
  })

  it('본문 자리의 3줄 최소 높이는 짧은 뷰포트에서 양보한다 — min-height 가 max-height 를 이기므로', () => {
    renderPicker()
    const body = screen.getByTestId('character-tracking-picker-scroll').parentElement

    expect(body).toHaveClass('min-h-[min(385px,calc(100dvh-var(--sa-top)-var(--sa-bottom)-15rem))]')
  })

  it('스크롤포트가 카드 좌우 패딩을 상쇄해 인디케이터가 모달 오른쪽 끝에 온다', () => {
    renderPicker()
    const scroll = screen.getByTestId('character-tracking-picker-scroll')

    // -mr-6 이 스크롤포트를 카드 테두리까지 넓히고(인디케이터가 그 위에 그려진다),
    // 같은 크기 pr-6 이 콘텐츠 여백을 되돌린다. min-h-0 이 없으면 카드 상한 아래로 줄지 않는다.
    expect(scroll).toHaveClass('-mr-6', 'pr-6', 'min-h-0', 'overflow-y-auto')
  })

  it('그리드 자신은 상한도 스크롤도 갖지 않는다 — 스크롤포트는 쓰는 쪽 소유다', () => {
    renderPicker()
    const grid = screen.getByTestId('character-tracking-picker-scroll').firstElementChild as HTMLElement

    expect(grid).not.toHaveClass('max-h-[70vh]')
    expect(grid).not.toHaveClass('overflow-y-auto')
  })

  it('스탈 배너는 스크롤포트 밖에 남는다 — 목록을 굴려도 계속 보인다', () => {
    render(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const scroll = screen.getByTestId('character-tracking-picker-scroll')
    expect(scroll).not.toContainElement(screen.getByText('목록이 최신이 아닙니다'))
  })
})
