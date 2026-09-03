// 온보딩 캐릭터 선택 단계.
//
// **옛 파일을 갱신하지 않고 다시 썼다**. 계약이 뒤집혔다. 이 단계는 더 이상 **고른 계정 하나의
// 3열 그리드** 가 아니라 설정 하위 페이지와 **같은 두 층 본문**이고, 그래서 옛 케이스가 보던 것
// (`emptyAction` 탈출구· 그리드 토글· 로스터 로딩 분기)은 여기서 검사할 대상이 아니게 됐다.
// 같은 이름을 남겨 두면 **검사했다** 로 오독된다.
//
// 그래서 이 파일이 보는 것은 **갈리는 것** 뿐이다
//
// 본문(`CharacterManageBody` + `useCharacterManage`)의 계약. 두 층의 범위· 이동· 별· TTL·
// 드롭다운· 실패 표현. 은 `../../settings/__tests__/SettingsCharactersScreen.test.tsx` 가 이미
// 본다. 같은 컴포넌트를 두 곳에서 다시 검사하면 이 **머리와 CTA 만 갈린다** 로
// 묶어 둔 것이 테스트에서 두 벌이 된다. 여기서 보는 것은 제목· CTA 게이트· 제출 payload·
// **429 만 넘기는 배선** 넷이다.
import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { fetchCharacterList } from '../../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../../nexon/errors'
import { getAuthConfig } from '../../../storage/api-key'
import { getCachedCharacterBasic } from '../../../storage/character-basic-cache'
import { getRepresentativeCharacter } from '../../../storage/character-selection'
import { getScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import { useContentSchedulerStore, type ContentSchedulerStore } from '../../../features/content-scheduler/store'
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CharacterPickerEntry, MapleAccount, MapleCharacter } from '../../../types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { ContentCharacterStep } from '../ContentCharacterStep'

// 팩토리 밖 변수를 참조하려면 이름이 `mock` 으로 시작해야 한다(babel-jest 규칙).
const mockGetRoster = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()

jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn() }))
jest.mock('../../../storage/api-key', () => ({ getAuthConfig: jest.fn() }))
jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(),
  setRepresentativeCharacter: jest.fn(),
  clearRepresentativeCharacter: jest.fn(),
}))
jest.mock('../../../storage/schedule-probe-ledger', () => ({ getScheduleProbeLedger: jest.fn() }))

// `toScheduleSyncError` 는 실물을 쓴다(문구가 원인에서 나온다). `...requireActual` 을
// 통째로 쓰면 순환 참조가 아직 구성 중인 모듈을 `undefined` 로 만난다. 부분 모킹이 그 처방이다.
jest.mock('../../../features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('../../../features/schedule-sync/errors')>(
    '../../../features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

jest.mock('../../../features/content-scheduler/store', () => ({ useContentSchedulerStore: jest.fn() }))

// 429 는 키 재입력 진입점으로 간다.
// **`useApiKeyNotice` 는 실물을 쓴다**. 이 파일이 보려는 것이 "무엇을 그 훅에 넘기는가"라,
// 훅을 목으로 세우면 검사 대상이 사라진다. 그래서 그 끝인 스토어만 세운다.
jest.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

const mockedFetchCharacterList = jest.mocked(fetchCharacterList)
const mockedGetAuthConfig = jest.mocked(getAuthConfig)
const mockedGetCachedBasic = jest.mocked(getCachedCharacterBasic)
const mockedGetRepresentative = jest.mocked(getRepresentativeCharacter)
const mockedGetLedger = jest.mocked(getScheduleProbeLedger)
const mockedContentStore = jest.mocked(useContentSchedulerStore)
const mockedRoster = mockGetRoster as unknown as jest.MockedFunction<typeof getCharacterPickerRoster>

// 픽스처
function 캐릭터(ocid: string, name: string, level: number): MapleCharacter {
  return { ocid, name, world: '스카니아', jobClass: '아크메이지(썬, 콜)', level }
}

const 낟낟 = 캐릭터('a1', '낟낟', 294)
const 달의아이 = 캐릭터('a2', '달의아이', 260)
const 계정A: MapleAccount = { accountId: 'account-a', characters: [낟낟, 달의아이] }

function 후보(character: MapleCharacter): CharacterPickerEntry {
  return {
    ocid: character.ocid,
    name: character.name,
    level: character.level,
    imageUrl: null,
    world: character.world,
    jobClass: character.jobClass,
  }
}

function 캐시(character: MapleCharacter): CachedCharacterBasicEntry {
  return {
    profile: {
      name: character.name,
      level: character.level,
      imageUrl: `https://example.test/${character.ocid}.png`,
      accessFlag: true,
      world: character.world,
      jobClass: character.jobClass,
    },
    cachedAt: '2026-08-17T00:00:00.000Z',
  }
}

const 캐시된캐릭터 = new Map([낟낟, 달의아이].map((c) => [c.ocid, 캐시(c)]))

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

function pressableOf(node: AtomElement): AtomElement {
  let current: AtomElement | null = node
  while (current !== null && current.props.role !== 'button') current = current.parent
  if (current === null) throw new Error('누를 수 있는 요소를 찾지 못했다')
  return current
}

function stateOf(node: AtomElement): { disabled?: boolean; busy?: boolean } {
  return (node.props.accessibilityState ?? {}) as { disabled?: boolean; busy?: boolean }
}

function button(view: Rendered, label: string | RegExp): AtomElement {
  return pressableOf(view.getByText(label))
}

/** 마운트 직후 계정 조회 → 후보 조회가 연달아 도는 자리라 여러 번 흘려보낸다. */
async function renderStep(
  props: Partial<React.ComponentProps<typeof ContentCharacterStep>> = {},
): Promise<{ view: Rendered; onSubmit: jest.Mock }> {
  const onSubmit = props.onSubmit ?? jest.fn()
  const view = await renderOverlay(
    <ContentCharacterStep
      isSubmitting={props.isSubmitting ?? false}
      onSubmit={onSubmit as (ocids: string[], representativeOcid: string | null) => void}
    />,
  )
  for (let i = 0; i < 4; i += 1) await act(async () => {})
  return { view, onSubmit: onSubmit as jest.Mock }
}

let rosterFailure: unknown
let accountsFailure: unknown

beforeEach(() => {
  rosterFailure = undefined
  accountsFailure = undefined

  mockedGetAuthConfig.mockResolvedValue({ apiKey: 'key' })
  mockedFetchCharacterList.mockImplementation(async () => {
    if (accountsFailure !== undefined) throw accountsFailure
    return [계정A]
  })
  mockedGetCachedBasic.mockImplementation(async (ocid: string) => 캐시된캐릭터.get(ocid) ?? null)
  mockedGetRepresentative.mockResolvedValue(null)
  mockedGetLedger.mockResolvedValue({ unavailable: false, dates: {} })
  mockedRoster.mockImplementation(async (onUpdate) => {
    if (rosterFailure !== undefined) throw rosterFailure
    onUpdate([후보(낟낟), 후보(달의아이)])
  })
  mockedContentStore.mockReturnValue({
    trackedOcids: [],
    saveTrackedOcids: jest.fn(async () => {}),
  } as unknown as ContentSchedulerStore)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('ContentCharacterStep: 머리와 CTA', () => {
  it('제목 블록과 `계속하기`를 그린다', async () => {
    const { view } = await renderStep()

    expect(view.getByText('관리할 캐릭터를 선택해주세요')).toBeTruthy()
    expect(view.getByText('계속하기')).toBeTruthy()
  })

  // 설정 하위 페이지가 그리는 것과 **같은 본문**이다. 갈리는 것은 위 케이스의 둘뿐이라,
  // 여기서는 그것이 정말 그 본문인지(사본이 아닌지)만 확인한다.
  it('설정 화면과 같은 두 층 본문을 그린다. 드롭다운이 아래 층의 머리다', async () => {
    const { view } = await renderStep()

    expect(view.getByTestId('character-manage-body')).toBeTruthy()
    expect(view.getByTestId('character-manage-selected')).toBeTruthy()
    expect(view.getByTestId('character-manage-candidates')).toBeTruthy()
    expect(view.getByTestId('account-select-trigger')).toBeTruthy()
  })

  // 옛 화면에 있던 `계정 다시 선택` 탈출구는 목적지가 없어졌다.
  // 그 자리의 출구는 드롭다운을 되돌리는 것이다.
  it('`계정 다시 선택` 탈출구를 두지 않는다', async () => {
    const { view } = await renderStep()

    expect(view.queryByText('계정 다시 선택')).toBeNull()
  })

  // 0개는 화면을 빈 상태로 만들 뿐 어떤 의도도 표현하지 않는다.
  it('아무도 고르지 않으면 `계속하기`가 비활성이다', async () => {
    const { view } = await renderStep()

    expect(stateOf(button(view, '계속하기')).disabled).toBe(true)
  })

  it('하나라도 고르면 `계속하기`가 활성이 된다', async () => {
    const { view } = await renderStep()

    await press(pressableOf(view.getByText('낟낟')))

    expect(stateOf(button(view, '계속하기')).disabled).toBe(false)
  })

  it('저장 중에는 `계속하기`에 스피너가 겹치고 비활성이 된다', async () => {
    const { view } = await renderStep({ isSubmitting: true })

    const cta = button(view, '계속하기')
    expect(stateOf(cta).disabled).toBe(true)
    expect(stateOf(cta).busy).toBe(true)
  })
})

// 설정 하위 페이지의 `저장` 과 같은 액션 바다.
// 본문이 그 화면과 같은 두 층이라 캐릭터가 많으면 본문 끝의 CTA 는 화면 밖에 있게 된다.
describe('ContentCharacterStep: `계속하기`는 하단에 고정된다', () => {
  it('CTA 는 스크롤 뷰 **밖**의 고정 바 안에 선다', async () => {
    const { view } = await renderStep()

    expect(within(view.getByTestId('onboarding-action-bar')).getByText('계속하기')).toBeTruthy()
    // 스크롤 뷰 안에 남아 있으면 **어디까지 굴렸든 지금 누른다** 가 깨진다. 그것이 이 정정이
    // 옮긴 자리다.
    expect(within(view.getByTestId('onboarding-scroll')).queryByText('계속하기')).toBeNull()
  })

  // 바 높이를 상수로 적지 않는다. 잰 값만큼 비워야 글자 크기·안전영역이 다른 기기에서도
  // 마지막 행이 바 뒤로 숨지 않는다.
  it('잰 바 높이만큼 콘텐츠 아래를 비운다', async () => {
    const { view } = await renderStep()

    await act(async () => {
      fireEvent(view.getByTestId('onboarding-action-bar'), 'layout', {
        nativeEvent: { layout: { height: 96 } },
      })
    })

    expect(view.getByTestId('onboarding-scroll').props.contentContainerStyle).toMatchObject({
      paddingBottom: 96,
    })
  })

  it('CTA 는 그 바 안에서 폭을 다 쓴다', async () => {
    const { view } = await renderStep()

    const cta = within(view.getByTestId('onboarding-action-bar')).getByRole('button')
    // 클래스 문자열은 NativeWind 가 스타일로 바꿔 사라지므로 flatten 한 값에서 읽는다.
    expect(StyleSheet.flatten(cta.props.style).width).toBe('100%')
  })
})

describe('ContentCharacterStep: 제출 payload', () => {
  // 고른 순서가 곧 저장 순서다. 새로 고른 것은 배열 끝에 붙는다.
  it('고른 순서 그대로 ocid 를 넘긴다', async () => {
    const { view, onSubmit } = await renderStep()

    await press(pressableOf(view.getByText('달의아이')))
    await press(pressableOf(view.getByText('낟낟')))
    await press(button(view, '계속하기'))

    expect(onSubmit).toHaveBeenCalledWith(['a2', 'a1'], null)
  })

  // 본문이 별을 그리므로 이 단계에서도 대표를 고를 수 있다. 안 실어 보내면 그 선택이
  // 조용히 사라진다.
  it('고른 대표 캐릭터를 목록과 함께 넘긴다', async () => {
    const { view, onSubmit } = await renderStep()

    await press(pressableOf(view.getByText('낟낟')))
    await press(pressableOf(view.getByText('달의아이')))
    await press(view.getByLabelText('달의아이 대표 캐릭터'))
    await press(button(view, '계속하기'))

    expect(onSubmit).toHaveBeenCalledWith(['a1', 'a2'], 'a2')
  })
})

describe('ContentCharacterStep: 키 재입력 진입점은 429 만 탄다', () => {
  // 로스터가 429 로 비면 출구가 전부 막힌다(CTA 영구 비활성· 재시도는 같은
  // 키로 또 429· 단계는 라우트가 아니라 status switch). 그 자리를 여는 것이 이 배선이다.
  it('후보 조회 429 는 키 재입력 진입점으로 넘어간다', async () => {
    rosterFailure = new NexonRateLimitError('429')
    await renderStep()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
  })

  it('계정 목록 429 도 같은 진입점으로 넘어간다', async () => {
    accountsFailure = new NexonRateLimitError('429')
    await renderStep()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
  })

  // 미배선이라는 선택이다. 이 자리의 401 은 방금 넣은 키가 나쁘다 는 뜻이라 폼 자체의 실패로
  // 남고, 화면의 다시 시도 가 처방이다. 설정 하위 페이지는 같은 401 을 진입점으로 넘긴다.
  // 두 화면은 여기서만 갈리고 그래서 문구도 갈린다. 화면이 안 옮겨가는데 키 입력 화면으로
  // 이동합니다 를 쓰면 거짓인 데다 액션까지 없어 401 이 하드 잠금이 된다.
  it('401 은 넘기지 않는다. 폼 자체의 실패로 남고 `다시 시도`가 그 처방이다', async () => {
    rosterFailure = new NexonAuthError('401')
    const { view } = await renderStep()

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
    expect(view.getByTestId('error-state-description')).toHaveTextContent('API 키를 다시 확인해주세요')
    expect(view.getByText('다시 시도')).toBeTruthy()
  })

  it('계정 목록 401 도 넘기지 않는다', async () => {
    accountsFailure = new NexonAuthError('401')
    await renderStep()

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })
})
