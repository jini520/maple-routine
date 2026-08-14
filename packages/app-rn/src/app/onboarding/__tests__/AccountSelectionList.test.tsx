// 웹판(495줄)의 명세를 읽어 다시 쓴 것. 각 케이스가 지키는 결정은 웹 주석 그대로다.
//
// 갈린 것 다섯
// ① `aria-pressed` → **`accessibilityState.selected`**(RN 접근성 상태에 *pressed* 가 없다).
//    `disabled` 도 같은 객체로 접힌다.
// ② `getByRole('button', { name })` → **글자에서 위로 올라가** 그 카드를 잡는다 — RN 은 자식 글자를
//    합쳐 하나의 접근성 이름으로 만들지 않는다(`CharacterTrackingPicker` 테스트와 같은 헬퍼).
// ③ `getByAltText` → `getByLabelText`(`alt` 의 짝은 `accessibilityLabel` 이다) + `src` → `source`.
//    월드 엠블럼은 [[ADR-129]] 이후 **번들 에셋 id** 라 URL 문자열이 아니다 — 그래서 값이 아니라
//    "무엇을 넘겼는가"를 목이 돌려준 것과 대조한다.
// ④ `container.textContent` 로 "(1/3) 뿐"을 단언하던 자리는 **그 글자 하나 + 나머지 부재**로 나눈다.
// ⑤ `toHaveClass('m-auto')` → `style.margin === 'auto'` — 클래스는 스타일로 컴파일돼 사라진다.
import { fireEvent } from '@testing-library/react-native'

import { useAccountProbes } from '@core/features/onboarding/use-account-probes'
import { useApiKeyNotice } from '@core/features/onboarding/use-api-key-notice'
import { worldEmblemUrl } from '@core/lib/world-emblem'
import type { MapleAccount } from '@core/types'

import {
  flattenStyle,
  renderAtom,
  type AtomElement,
  type TreeNode,
} from '../../../components/__tests__/render-atom'
import { AccountSelectionList } from '../AccountSelectionList'

jest.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: jest.fn(),
}))

// [[ADR-116]] 결정 3: 429 판정 불가의 출구는 안내 모달이다([[ADR-115]] 결정 10 의 사슬). 여기서는 그
// 진입점이 불렸는지만 본다 — 모달 자체는 `ApiKeyNoticeModal` 테스트가 본다.
jest.mock('@core/features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: jest.fn(),
}))

jest.mock('@core/lib/world-emblem', () => ({
  worldEmblemUrl: jest.fn(),
}))

const mockedUseAccountProbes = jest.mocked(useAccountProbes)
const mockedUseApiKeyNotice = jest.mocked(useApiKeyNotice)
const mockedWorldEmblemUrl = jest.mocked(worldEmblemUrl)

const QUERYABLE = { kind: 'queryable' } as const
const ALL_UNAVAILABLE = { kind: 'allUnavailable' } as const
const retryMock = jest.fn()

const accounts: MapleAccount[] = [
  {
    accountId: 'da9b2f2-account-hash-1',
    characters: [
      { ocid: 'ocid-1', name: '내옆에최성일', world: '베라', jobClass: '아크메이지(썬,콜)', level: 211 },
    ],
  },
  {
    accountId: '69e3525-account-hash-2',
    characters: [
      { ocid: 'ocid-2', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 },
      { ocid: 'ocid-3', name: '부캐', world: '엘리시움', jobClass: '나이트로드', level: 150 },
    ],
  },
]

// [[ADR-113]] 결정 3: 목록은 프로브가 settle 한 뒤에만 그려진다. 목록 렌더링을 보는 케이스는 전부
// 이 헬퍼로 "프로브가 끝난 뒤"를 만든다.
function settled(probes: ReturnType<typeof useAccountProbes>['probes']): ReturnType<typeof useAccountProbes> {
  const total = accounts.reduce((sum, account) => sum + account.characters.length, 0)
  return { probes, isSettled: true, progress: { completed: total, total }, retry: retryMock }
}

function waiting(progress: { completed: number; total: number }): ReturnType<typeof useAccountProbes> {
  return { probes: {}, isSettled: false, progress, retry: retryMock }
}

beforeEach(() => {
  mockedUseAccountProbes.mockReturnValue(settled({}))
  // 매핑된 월드는 에셋을, 미매핑 월드('리부트')는 null 을 돌려 폴백을 검사한다. RN 에서 이 값은
  // URL 문자열이 아니라 번들 에셋 id(숫자)다([[ADR-129]]) — 목도 그 모양을 흉내 낸다.
  mockedWorldEmblemUrl.mockImplementation((world) => (world === '리부트' ? null : world.length))
})

afterEach(() => {
  jest.clearAllMocks()
})

type Rendered = Awaited<ReturnType<typeof renderAtom>>

function pressableOf(node: AtomElement): AtomElement {
  let current: AtomElement | null = node
  while (current !== null && current.props.role !== 'button') current = current.parent
  if (current === null) throw new Error('누를 수 있는 요소를 찾지 못했다')
  return current
}

function stateOf(node: AtomElement): { selected?: boolean; disabled?: boolean } {
  return (node.props.accessibilityState ?? {}) as { selected?: boolean; disabled?: boolean }
}

function card(view: Rendered, label: string): AtomElement {
  return pressableOf(view.getByText(label))
}

function cta(view: Rendered): AtomElement {
  return pressableOf(view.getByText('계속하기'))
}

/**
 * 진행률 바 — **`getByRole('progressbar')` 로는 못 찾는다.** RNTL 의 role 쿼리는 접근성 트리에
 * 노출된 요소만 보는데 `ProgressBar` 의 트랙은 `accessibilityRole` 만 갖고 `accessible` 표시가 없다
 * (그 atom 의 자기 테스트도 `fillTestId` 로 잡는다). RNTL 14 에는 `UNSAFE_*ByProps` 도 없어
 * (실측 — 반환 객체에 그 키가 없다) `toJSON()` 트리를 직접 훑는다(`findAllOfType` 과 같은 방식이고,
 * 거기서 고르는 축이 `type` 이 아니라 프롭인 것만 다르다).
 */
function findByProp(node: unknown, key: string, value: unknown): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findByProp(child, key, value))
  if (node === null || typeof node !== 'object') return []

  const current = node as TreeNode
  const hit = current.props?.[key] === value ? [current] : []
  return [...hit, ...findByProp(current.children, key, value)]
}

function progressBars(view: Rendered): TreeNode[] {
  return findByProp(view.toJSON(), 'accessibilityRole', 'progressbar')
}

function render(
  props: Partial<React.ComponentProps<typeof AccountSelectionList>> = {},
): Promise<Rendered> {
  return renderAtom(
    <AccountSelectionList
      accounts={accounts}
      isSubmitting={false}
      onSelect={jest.fn()}
      {...props}
    />,
  )
}

describe('AccountSelectionList', () => {
  it('각 계정을 "월드 · 닉네임 · Lv.레벨" + "캐릭터 N개" 2줄로 렌더링하고 직업은 표시하지 않는다', async () => {
    const view = await render()

    expect(view.getByText('베라 · 내옆에최성일 · Lv.211')).toBeTruthy()
    expect(view.getByText('캐릭터 1개')).toBeTruthy()
    expect(view.getByText('엘리시움 · 낟낟 · Lv.293')).toBeTruthy()
    expect(view.getByText('캐릭터 2개')).toBeTruthy()

    // 직업(아크메이지/렌)은 더 이상 표시하지 않는다
    expect(view.queryByText(/아크메이지/)).toBeNull()
    expect(view.queryByText(/^렌$/)).toBeNull()
  })

  it('월드 엠블럼을 월드명과 함께 표시한다', async () => {
    const view = await render()

    const emblem = view.getByTestId('world-emblem-69e3525-account-hash-2')
    expect(emblem.props.accessibilityLabel).toBe('엘리시움')
    expect(emblem.props.source).toBe('엘리시움'.length)

    // 웹은 `h-[22px] w-auto object-contain` — 폭은 그림이 정한다. RN 에서 폭을 **이름 부르지
    // 않으면** 고유 폭(46)이 살아남아 이름 줄 왼쪽에 빈자리가 생긴다([[ADR-135]]).
    const style = flattenStyle(emblem.props.style)
    expect(style.height).toBe(22)
    expect(Object.keys(style)).toContain('width')
    expect(style.width).toBeUndefined()
    expect(style.aspectRatio).toBeDefined()
  })

  it('매핑에 없는 월드는 엠블럼 없이 월드명 텍스트만 표시한다', async () => {
    const rebootAccount: MapleAccount[] = [
      {
        accountId: 'reboot-account-hash',
        characters: [{ ocid: 'ocid-r', name: '리부트캐릭', world: '리부트', jobClass: '히어로', level: 260 }],
      },
    ]

    const view = await render({ accounts: rebootAccount })

    expect(view.getByText('리부트 · 리부트캐릭 · Lv.260')).toBeTruthy()
    expect(view.queryByTestId('world-emblem-reboot-account-hash')).toBeNull()
  })

  it('계정이 2개 이상이면 초기에 하이라이트된 항목이 없고 "계속하기"가 비활성화 상태다', async () => {
    const view = await render()

    expect(stateOf(card(view, '캐릭터 1개')).selected).toBe(false)
    expect(stateOf(card(view, '캐릭터 2개')).selected).toBe(false)
    expect(stateOf(cta(view)).disabled).toBe(true)
  })

  it('계정이 2개 이상일 때 다른 항목을 누르면 하이라이트가 옮겨간다', async () => {
    const view = await render()

    await fireEvent.press(card(view, '엘리시움 · 낟낟 · Lv.293'))
    expect(stateOf(card(view, '엘리시움 · 낟낟 · Lv.293')).selected).toBe(true)
    expect(stateOf(card(view, '베라 · 내옆에최성일 · Lv.211')).selected).toBe(false)

    await fireEvent.press(card(view, '베라 · 내옆에최성일 · Lv.211'))
    expect(stateOf(card(view, '베라 · 내옆에최성일 · Lv.211')).selected).toBe(true)
    expect(stateOf(card(view, '엘리시움 · 낟낟 · Lv.293')).selected).toBe(false)
  })

  // [[ADR-051]] 결정 3: 계정이 1개면 고를 것이 없으므로 항목 선택 탭은 생략하고
  // "계속하기" 확정 행위만 남긴다.
  it('계정이 1개면 그 항목이 초기 하이라이트이고 "계속하기"가 곧바로 활성화된다', async () => {
    const view = await render({ accounts: [accounts[0]] })

    expect(stateOf(card(view, '베라 · 내옆에최성일 · Lv.211')).selected).toBe(true)
    expect(stateOf(cta(view)).disabled).toBe(false)
  })

  it('계정이 1개여도 렌더만으로는 onSelect가 호출되지 않고 "계속하기"를 눌러야 확정된다', async () => {
    const onSelect = jest.fn()
    const view = await render({ accounts: [accounts[0]], onSelect })

    expect(onSelect).not.toHaveBeenCalled()

    await fireEvent.press(cta(view))

    expect(onSelect).toHaveBeenCalledWith('da9b2f2-account-hash-1')
  })

  // 웹판은 한 케이스 안에서 두 번 렌더했는데, RNTL 14 에서는 그러면 **다음 케이스부터 렌더가
  // 비어 버린다**(`overlapping act() calls` — `RootNavigator` 테스트 머리의 규칙과 같은 자리).
  // 계정 수만 다른 같은 단언이라 케이스를 나눠도 잃는 것이 없다.
  it('isSubmitting이면 계정이 1개여도 항목과 "계속하기"가 비활성화된다', async () => {
    const view = await render({ accounts: [accounts[0]], isSubmitting: true })

    expect(stateOf(card(view, '베라 · 내옆에최성일 · Lv.211')).disabled).toBe(true)
    expect(stateOf(cta(view)).disabled).toBe(true)
  })

  it('isSubmitting이면 계정이 여럿이어도 항목과 "계속하기"가 비활성화된다', async () => {
    const view = await render({ isSubmitting: true })

    expect(stateOf(card(view, '캐릭터 1개')).disabled).toBe(true)
    expect(stateOf(card(view, '캐릭터 2개')).disabled).toBe(true)
    expect(stateOf(cta(view)).disabled).toBe(true)
  })

  it('카드를 눌러도 onSelect가 즉시 호출되지 않는다', async () => {
    const onSelect = jest.fn()
    const view = await render({ onSelect })

    await fireEvent.press(card(view, '엘리시움 · 낟낟 · Lv.293'))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('카드를 눌러 하이라이트한 뒤 "계속하기"를 눌러야 해당 accountId로 onSelect가 호출된다', async () => {
    const onSelect = jest.fn()
    const view = await render({ onSelect })

    await fireEvent.press(card(view, '엘리시움 · 낟낟 · Lv.293'))
    expect(stateOf(cta(view)).disabled).toBe(false)

    await fireEvent.press(cta(view))

    expect(onSelect).toHaveBeenCalledWith('69e3525-account-hash-2')
  })

  it('accountId 원본 해시 문자열을 화면에 노출하지 않는다', async () => {
    const view = await render()

    expect(view.queryByText(/da9b2f2/)).toBeNull()
    expect(view.queryByText(/69e3525/)).toBeNull()
  })

  it('대표 캐릭터의 초상화 URL이 있으면 이미지를 렌더링한다', async () => {
    mockedUseAccountProbes.mockReturnValue(
      settled({
        'da9b2f2-account-hash-1': {
          representative: accounts[0].characters[0],
          portraitUrl: 'https://example.com/portrait.png',
          verdict: QUERYABLE,
        },
        '69e3525-account-hash-2': { representative: null, portraitUrl: null, verdict: QUERYABLE },
      }),
    )

    const view = await render()

    const portrait = view.getByTestId('account-portrait-da9b2f2-account-hash-1')
    expect(portrait.props.accessibilityLabel).toBe('내옆에최성일')
    // 초상화는 넥슨이 주는 **원격 URL** 이라 `{ uri }` 로 감싼다 — 월드 엠블럼(에셋 id)과 갈리는 자리.
    expect(portrait.props.source).toEqual({ uri: 'https://example.com/portrait.png' })
  })

  it('초상화를 찾지 못한 계정은 "?"로 대체 표시한다', async () => {
    mockedUseAccountProbes.mockReturnValue(
      settled({
        'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: QUERYABLE },
        '69e3525-account-hash-2': { representative: null, portraitUrl: null, verdict: QUERYABLE },
      }),
    )

    const view = await render()

    expect(view.getAllByText('?')).toHaveLength(2)
    expect(view.queryByTestId('account-portrait-da9b2f2-account-hash-1')).toBeNull()
    expect(view.queryByTestId('account-portrait-69e3525-account-hash-2')).toBeNull()
  })

  // [[ADR-068]] 결정 4: 전원 조회 불가를 고르기 **전에** 알린다. 전에는 고른 뒤 예열이 전부 실패해
  // 피커가 빈 목록이 되고 아무 설명이 없었다(이슈 #78).
  describe('전원 조회 불가 계정', () => {
    function withAllUnavailable(): void {
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: ALL_UNAVAILABLE },
          '69e3525-account-hash-2': {
            representative: accounts[1].characters[0],
            portraitUrl: null,
            verdict: QUERYABLE,
          },
        }),
      )
    }

    it('그 계정에만 경고를 붙인다', async () => {
      withAllUnavailable()

      const view = await render()

      expect(view.getAllByText('이 계정의 캐릭터를 조회할 수 없습니다')).toHaveLength(1)
    })

    // [[ADR-086]] 결정 8: 경고만으로는 부족하다 — 고르면 후보가 0명이라 "최소 1명"(결정 7)을
    // 만족할 수 없어 온보딩이 진행 불가 상태로 멈춘다. 들어갈 수 없는 문은 잠근다.
    it('그 계정은 고를 수 없다', async () => {
      withAllUnavailable()

      const view = await render()

      expect(stateOf(card(view, '베라 · 내옆에최성일 · Lv.211')).disabled).toBe(true)

      await fireEvent.press(card(view, '엘리시움 · 낟낟 · Lv.293'))
      expect(stateOf(cta(view)).disabled).toBe(false)
    })

    it('계정이 1개라 초기 하이라이트된 항목이 조회 불가면 "계속하기"도 막는다', async () => {
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': { representative: null, portraitUrl: null, verdict: ALL_UNAVAILABLE },
        }),
      )

      const view = await render({ accounts: [accounts[0]] })

      expect(stateOf(cta(view)).disabled).toBe(true)
    })
  })

  // [[ADR-113]] 결정 3: settle 전에는 목록을 그리지 않는다. 전에는 잠정 대표로 카드를 먼저 그린 뒤
  // 결과가 오면 경고를 붙이고 비활성으로 바꿨는데, 그것은 고를 수 없는 카드를 고를 수 있는 것처럼
  // 보여주고 나서 뺏는 것이었다.
  describe('프로브 settle 전 대기', () => {
    it('계정 카드도 "계속하기"도 안내 문구도 렌더하지 않는다', async () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 0, total: 3 }))

      const view = await render()

      expect(view.queryByText('캐릭터 1개')).toBeNull()
      expect(view.queryByText('계속하기')).toBeNull()
      expect(view.queryByText('사용할 메이플 ID를 선택해주세요.')).toBeNull()
      expect(view.queryByText('베라 · 내옆에최성일 · Lv.211')).toBeNull()
    })

    // [[ADR-113]] 결정 5: 대기 표현은 진행률 바 + (완료/전체) 뿐이고 설명 문구를 붙이지 않는다 —
    // 직후 `verifying` 단계와 마크가 달라지면 두 번의 대기로 읽힌다.
    it('진행률 바와 (완료/전체) 표기만 그린다', async () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 1, total: 3 }))

      const view = await render()

      expect(progressBars(view)).toHaveLength(1)
      expect(view.getByText('(1/3)')).toBeTruthy()
      // 예열 진행률(`캐릭터 정보를 준비하고 있어요 (N/M)`)에서 앞 문장만 뗀 모양이다.
      expect(view.queryByText(/준비하고 있어요/)).toBeNull()
    })

    // 이 대기는 화면에 자기 혼자뿐이라 온보딩의 다른 두 전체 대기(prefetching·seedingTracking)와
    // 같은 자리 — 세로 중앙 — 에 서야 한다(사용자 보고 2026-08-09). 자동 여백으로 세우는 이유는
    // 이 컴포넌트가 설정 계정 변경 모달에서도 쓰이기 때문이다.
    it('프로브 대기는 자동 여백으로 세로 중앙에 선다', async () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 1, total: 3 }))

      const view = await render()

      expect(flattenStyle(view.getByTestId('account-probe-wait').props.style)).toMatchObject({
        margin: 'auto',
      })
    })

    it('진행률은 progress 를 그대로 반영한다', async () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 12, total: 40 }))

      const view = await render()

      expect(progressBars(view)[0].props.accessibilityValue).toMatchObject({ now: 30 })
    })

    it('settle 하면 목록과 "계속하기"가 나타난다', async () => {
      mockedUseAccountProbes.mockReturnValue(waiting({ completed: 0, total: 3 }))
      const view = await render()

      expect(view.queryByText('계속하기')).toBeNull()

      mockedUseAccountProbes.mockReturnValue(settled({}))
      // `rerender` 도 `render` 와 같이 **await 해야** 갱신이 반영된다(RNTL 14 — `RootNavigator`
      // 테스트 머리의 규칙과 같은 자리).
      await view.rerender(
        <AccountSelectionList accounts={accounts} isSubmitting={false} onSelect={jest.fn()} />,
      )

      expect(view.getByText('계속하기')).toBeTruthy()
      expect(view.getByText('베라 · 내옆에최성일 · Lv.211')).toBeTruthy()
      expect(progressBars(view)).toHaveLength(0)
    })
  })

  // [[ADR-116]] 결정 3: 003이 아닌 실패는 "판정 불가"이고, 판정 못 한 계정이 하나라도 있으면 목록
  // 자체를 그리지 않는다 — 결정 3("모르는 동안은 보여주지도 않는다")을 429에도 적용한 것이다.
  describe('판정 불가 계정 ([[ADR-116]] 결정 3)', () => {
    function withUndetermined(kind: 'rateLimited' | 'network'): void {
      mockedUseAccountProbes.mockReturnValue(
        settled({
          'da9b2f2-account-hash-1': {
            representative: null,
            portraitUrl: null,
            verdict: { kind: 'undetermined', error: { kind } },
          },
          // 나머지 계정을 확인했더라도 부분 판정으로 목록을 그리지 않는다.
          '69e3525-account-hash-2': {
            representative: accounts[1].characters[0],
            portraitUrl: null,
            verdict: QUERYABLE,
          },
        }),
      )
    }

    it('목록도 "계속하기"도 안내 문구도 그리지 않는다', async () => {
      withUndetermined('rateLimited')

      const view = await render()

      expect(view.queryByText('캐릭터 1개')).toBeNull()
      expect(view.queryByText('계속하기')).toBeNull()
      expect(view.queryByText('사용할 메이플 ID를 선택해주세요.')).toBeNull()
      // 확인이 끝난 계정이 있어도 그리지 않는다 — 부분 판정으로 목록을 만들지 않는다.
      expect(view.queryByText('엘리시움 · 낟낟 · Lv.293')).toBeNull()
    })

    it('429는 안내 모달 경로로 보낸다 — 그 자리의 출구는 키 재입력이다', async () => {
      withUndetermined('rateLimited')

      const view = await render()

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith({ kind: 'rateLimited' })
      // 429는 눌러도 또 429라 액션을 주지 않는다([[ADR-114]] 결정 2) — 출구는 모달이 쥔다.
      expect(view.getByTestId('error-state-title').props.children).toBe('호출 한도를 초과했습니다')
      expect(view.queryByText('다시 시도')).toBeNull()
    })

    it('429가 아닌 원인은 모달로 보내지 않고 이 자리에서 다시 시도한다', async () => {
      withUndetermined('network')

      const view = await render()

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith(null)

      await fireEvent.press(pressableOf(view.getByText('다시 시도')))
      expect(retryMock).toHaveBeenCalledTimes(1)
    })

    it('판정 불가가 없으면 모달 경로를 타지 않는다', async () => {
      const view = await render()

      expect(mockedUseApiKeyNotice).toHaveBeenCalledWith(null)
      expect(view.queryByTestId('error-state')).toBeNull()
    })
  })

  // [[ADR-068]] 결정 4: character/list의 최고 레벨이 조회 불가일 수 있으므로, 대표는 프로브가
  // 확인한 "조회 가능한 캐릭터 중 최고 레벨"이다.
  it('프로브가 고른 대표 캐릭터를 표기한다', async () => {
    mockedUseAccountProbes.mockReturnValue(
      settled({
        '69e3525-account-hash-2': {
          representative: accounts[1].characters[1],
          portraitUrl: null,
          verdict: QUERYABLE,
        },
      }),
    )

    const view = await render()

    expect(view.getByText('엘리시움 · 부캐 · Lv.150')).toBeTruthy()
  })

  // [[ADR-127]]: 캐릭터 0명 계정은 `normalizeCharacterList` 가 이미 걸렀다 — 그래서 여기 목록이
  // **통째로 빌 수는 있다.** 그때 던지지 않고 안내 + 비활성 CTA 로 서는 것이 웹과 같은 동작이다
  // (화면 층에서 다시 거르지 않는다는 그 결정의 요점이 이 케이스로 고정된다).
  it('계정이 하나도 없어도 던지지 않고 안내와 비활성 CTA 만 남는다', async () => {
    mockedUseAccountProbes.mockReturnValue({
      probes: {},
      isSettled: true,
      progress: { completed: 0, total: 0 },
      retry: retryMock,
    })

    const view = await render({ accounts: [] })

    expect(view.getByText('사용할 메이플 ID를 선택해주세요.')).toBeTruthy()
    expect(stateOf(cta(view)).disabled).toBe(true)
  })
})
