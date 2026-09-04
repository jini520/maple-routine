// 캐릭터 관리 화면. 옮겨 적을 명세가 없어 이
// 파일이 보는 것은 그 ADR 의 성공 기준 그대로다: 두 층의 범위· 이동· 별· TTL· 저장 활성 조건.
//
// 무엇을 목으로 세우는가
//
// 값 규칙(`summarizeAccount`·`buildSelectedCharacterViews`·`resolveRepresentative`)과 문구
// (`formatRosterError`)는 **실물을 쓴다**. 여기서 베끼면 규칙이 두 벌이 된다(머리
// **값 규칙의 자리**). 세우는 것은 경계 넷뿐이다: 계정 목록 조회· 후보 목록 조회· 로컬 캐시·
// 저장 액션.
//
// 끌기는 여기서 **흉내** 내지 않는다
//
// 제스처는 네이티브가 인식하고 jest 는 레이아웃을 계산하지 않아, 끄는 동작 자체를 재현하면 우리가
// 만든 가짜만 검사하게 된다. 그래서 순서의 계약은 두 자리로 나뉜다. 값 규칙은
// `../../../components/organisms/CharacterManage/__tests__/reorder.test.ts`(순수 함수)가 보고,
// 여기서는 **화면이 그 규칙에 닿는 두 번째 경로**인 접근성 액션으로 본다(끌기와 같은 문을 쓰므로,
// 결과가 `moveOcid` 와 같은지는 그쪽으로 확인된다).
import { act, fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { getCharacterPickerRoster } from '../../../features/schedule-sync/schedule-sync'
import { fetchCharacterList } from '../../../nexon/character'
import { NexonAuthError, NexonRateLimitError } from '../../../nexon/errors'
import { getAuthConfig } from '../../../storage/api-key'
import { getCachedCharacterBasic } from '../../../storage/character-basic-cache'
import {
  clearRepresentativeCharacter,
  getRepresentativeCharacter,
  setRepresentativeCharacter,
} from '../../../storage/character-selection'
import { getScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import { useContentSchedulerStore, type ContentSchedulerStore } from '../../../features/content-scheduler/store'
import { CHARACTER_BASIC_TTL_MS } from '../../../features/schedule-sync/character-basic-fetch'
import type { CachedCharacterBasicEntry } from '../../../storage/character-basic-cache'
import type { CharacterPickerEntry, MapleAccount, MapleCharacter } from '../../../types'

import {
  flattenStyle,
  renderOverlay,
  type AtomElement,
} from '../../../components/__tests__/render-atom'
import { moveOcid } from '../../../hooks/useSelectionDraft'
import { SettingsCharactersScreen } from '../SettingsCharactersScreen'
import { useSettingsNavigation } from '../../../hooks/useSettingsNavigation'

// 팩토리 밖 변수를 참조하려면 이름이 `mock` 으로 시작해야 한다(babel-jest 규칙).
const mockGetRoster = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const mockLoadBossTracked = jest.fn()
const mockLoadProfitTracked = jest.fn()

jest.mock('../../../hooks/useSettingsNavigation', () => ({ useSettingsNavigation: jest.fn() }))
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

jest.mock('../../../features/content-scheduler/store', () => {
  const hook = jest.fn()
  return { useContentSchedulerStore: hook }
})
// 저장 뒤 다시 읽히는 둘. 화면은 `getState` 로만 만진다.
jest.mock('../../../features/boss-scheduler/store', () => ({
  useBossSchedulerStore: { getState: () => ({ loadTrackedOcids: mockLoadBossTracked }) },
}))
jest.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: { getState: () => ({ loadTrackedOcids: mockLoadProfitTracked }) },
}))
// 401·429 는 키 재입력 진입점으로 간다.
jest.mock('../../../features/auth/store', () => ({
  useAuthStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

const mockedUseSettingsNavigation = jest.mocked(useSettingsNavigation)
const mockedFetchCharacterList = jest.mocked(fetchCharacterList)
const mockedGetAuthConfig = jest.mocked(getAuthConfig)
const mockedGetCachedBasic = jest.mocked(getCachedCharacterBasic)
const mockedGetRepresentative = jest.mocked(getRepresentativeCharacter)
const mockedSetRepresentative = jest.mocked(setRepresentativeCharacter)
const mockedClearRepresentative = jest.mocked(clearRepresentativeCharacter)
const mockedGetLedger = jest.mocked(getScheduleProbeLedger)
const mockedContentStore = jest.mocked(useContentSchedulerStore)
const mockedRoster = mockGetRoster as unknown as jest.MockedFunction<typeof getCharacterPickerRoster>

const goBack = jest.fn()

// 픽스처
function 캐릭터(ocid: string, name: string, world: string, level: number, jobClass: string): MapleCharacter {
  return { ocid, name, world, jobClass, level }
}

const 낟낟 = 캐릭터('a1', '낟낟', '스카니아', 294, '아크메이지(썬, 콜)')
const 달의아이 = 캐릭터('a2', '달의아이', '스카니아', 260, '나이트로드')
const 별헤는밤 = 캐릭터('a3', '별헤는밤', '스카니아', 250, '비숍')
const 밤샘메린 = 캐릭터('b1', '밤샘메린', '루나', 275, '팔라딘')

const 계정A: MapleAccount = { accountId: 'account-a', characters: [낟낟, 달의아이, 별헤는밤] }
const 계정B: MapleAccount = { accountId: 'account-b', characters: [밤샘메린] }

function 후보(character: MapleCharacter, overrides: Partial<CharacterPickerEntry> = {}): CharacterPickerEntry {
  return {
    ocid: character.ocid,
    name: character.name,
    level: character.level,
    imageUrl: null,
    world: character.world,
    jobClass: character.jobClass,
    ...overrides,
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

const 캐시된캐릭터 = new Map([낟낟, 달의아이, 별헤는밤, 밤샘메린].map((c) => [c.ocid, 캐시(c)]))

/** 계정별 후보 목록. 테스트가 이 표만 갈아 끼운다. */
let rosterByAccount: Record<string, CharacterPickerEntry[]>
/** 계정별로 심는 조회 실패. */
let rosterFailureByAccount: Record<string, unknown>
/** 그 계정의 조회를 손으로 붙잡아 둔다(대기 화면 검사용). */
let rosterHangingAccounts: Set<string>

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

function mockContentStore(overrides: Partial<ContentSchedulerStore> = {}): ContentSchedulerStore {
  const base = {
    trackedOcids: [],
    saveTrackedOcids: jest.fn(async () => {}),
    ...overrides,
  } as unknown as ContentSchedulerStore
  mockedContentStore.mockReturnValue(base)
  return base
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 화면을 그리는 도우미. 마운트 직후 계정 조회 → 후보 조회가 연달아 돌아 여러 번 흘려보낸다. */
async function renderScreen(): Promise<Rendered> {
  const view = await renderOverlay(<SettingsCharactersScreen />)
  for (let i = 0; i < 4; i += 1) await act(async () => {})
  return view
}

async function switchAccount(view: Rendered, accountId: string): Promise<void> {
  await press(view.getByTestId('account-select-trigger'))
  await press(view.getByTestId(`account-select-option-${accountId}`))
  for (let i = 0; i < 3; i += 1) await act(async () => {})
}

/** 서브트리의 글자를 나온 순서대로. 층 안의 **순서**를 보려고 쓴다. */
function textsIn(node: AtomElement): string[] {
  const texts: string[] = []
  const walk = (current: AtomElement): void => {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child)
      else walk(child)
    }
  }
  walk(node)
  return texts
}

const 모든이름 = ['낟낟', '달의아이', '별헤는밤', '밤샘메린']

// 두 층이 **한 격자의 형제**라 상자로는 못 가른다. 층은 행마다 붙은 표식이 말한다.
function namesIn(view: Rendered, testID: string): string[] {
  const rowTestID =
    testID === 'character-manage-selected'
      ? 'character-manage-selected-row'
      : testID === 'character-manage-candidates'
        ? 'character-manage-candidate-row'
        : testID

  const rows = view.queryAllByTestId(rowTestID)
  if (rows.length > 0) {
    return rows.flatMap((row) => textsIn(row).filter((text) => 모든이름.includes(text)))
  }

  const node = view.queryByTestId(testID)
  if (node === null) return []
  return textsIn(node).filter((text) => 모든이름.includes(text))
}

function star(view: Rendered, name: string): AtomElement {
  return view.getByLabelText(`${name} 대표 캐릭터`)
}

/** `aria-selected` 는 RN 에서 `accessibilityState.selected` 로 내려간다. */
function isRepresentative(view: Rendered, name: string): boolean {
  return star(view, name).props.accessibilityState?.selected === true
}

beforeEach(() => {
  rosterByAccount = {
    'account-a': [후보(낟낟), 후보(달의아이), 후보(별헤는밤)],
    'account-b': [후보(밤샘메린)],
  }
  rosterFailureByAccount = {}
  rosterHangingAccounts = new Set()

  mockedUseSettingsNavigation.mockReturnValue({
    navigate: jest.fn(),
    goBack,
    setParams: jest.fn(),
  } as unknown as ReturnType<typeof useSettingsNavigation>)
  mockedGetAuthConfig.mockResolvedValue({ apiKey: 'key' })
  mockedFetchCharacterList.mockResolvedValue([계정A, 계정B])
  mockedGetCachedBasic.mockImplementation(async (ocid: string) => 캐시된캐릭터.get(ocid) ?? null)
  mockedGetRepresentative.mockResolvedValue(null)
  mockedSetRepresentative.mockResolvedValue(undefined)
  mockedClearRepresentative.mockResolvedValue(undefined)
  mockedGetLedger.mockResolvedValue({ unavailable: false, dates: {} })
  mockedRoster.mockImplementation(async (onUpdate, options) => {
    const accountId = options?.accountId ?? ''
    if (rosterHangingAccounts.has(accountId)) return new Promise<void>(() => {})
    const failure = rosterFailureByAccount[accountId]
    if (failure !== undefined) throw failure
    onUpdate(rosterByAccount[accountId] ?? [])
  })
  mockLoadBossTracked.mockResolvedValue(undefined)
  mockLoadProfitTracked.mockResolvedValue(undefined)
  mockContentStore()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('두 층. 위는 계정을 넘고 아래는 계정 하나다', () => {
  it('위는 저장 순서 그대로, 아래는 그 계정에서 아직 안 고른 후보다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })

    const view = await renderScreen()

    expect(view.getByText('선택된 캐릭터 1개')).toBeTruthy()
    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['달의아이', '별헤는밤'])
  })

  it('드롭다운으로 계정을 바꿔도 위 목록은 그대로다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()

    await switchAccount(view, 'account-b')

    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['밤샘메린'])
  })

  it('대기는 아래 자리에만 그려진다. 위는 로컬 캐시라 기다릴 것이 없다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    rosterHangingAccounts.add('account-b')
    const view = await renderScreen()

    await switchAccount(view, 'account-b')

    expect(view.getByText('캐릭터 목록을 불러오고 있어요')).toBeTruthy()
    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
  })

  // 대기 자리에 문구가 보인다. `aria-label` 만 있으면 화면에는 마크 하나뿐이고, 그 조합은
  // 진행중인지 알 수 없다.
  it('대기 문구가 화면에 보인다. 마크만으로는 무엇을 기다리는지 모른다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    rosterHangingAccounts.add('account-b')
    const view = await renderScreen()

    await switchAccount(view, 'account-b')

    // 마크와 문구가 **함께** 선다. 둘 중 하나만 남기면 예전 얼굴로 돌아간다.
    expect(view.getByText('캐릭터 목록을 불러오고 있어요')).toBeTruthy()
    expect(view.getByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeTruthy()
  })

  it('실패도 아래 자리에만 그려진다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    rosterFailureByAccount['account-b'] = new Error('boom')
    const view = await renderScreen()

    await switchAccount(view, 'account-b')

    expect(view.getByTestId('error-state')).toBeTruthy()
    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
  })

  // `후보 목록 로딩` 정책 그대로. 보여줄 것이 남아 있으면 지우지 않고 위에 배너를 얹는다
  // 캐시 stub 이 네트워크보다 먼저 오므로 이쪽이 기본 분기다.
  it('후보가 도착한 뒤 실패하면 목록을 지우지 않고 스탈 배너를 얹는다', async () => {
    mockContentStore({ trackedOcids: [] })
    mockedRoster.mockImplementation(async (onUpdate) => {
      onUpdate([후보(달의아이)])
      throw new Error('boom')
    })

    const view = await renderScreen()

    expect(view.getByTestId('stale-banner')).toBeTruthy()
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['달의아이'])
  })
})

// ★ **콜드 캐시에서 위 층이 비던 결함.**
//
// 위 층과 대표 얼굴은 로컬 캐시(`getCachedCharacterBasic`)만 읽었는데, 프로필 채우기 effect 가
// **miss 에도 `null` 을 넣어** 그 ocid 를 영영 다시 안 읽었다(**모른다** 를 **없다** 로 기억). 온보딩에서는
// 그 effect 가 로스터의 `character/basic` 이 캐시를 쓰기 **전에** 돌아, 신규 설치 사용자에게만.
// 그리고 하필 가장 눈에 띄는 대표 캐릭터에서. 얼굴이 '?' 로, 고른 카드가 빈칸으로 남았다
// (안드로이드 실기기).
//
// 여기서는 캐시를 **끝까지 비워** 그 창을 영구화한다. 값은 이미 화면에 있는 로스터 응답에서 와야 한다.
describe('콜드 캐시. 캐시가 비어도 위 층이 빈칸으로 남지 않는다', () => {
  const 얼굴 = 'https://example.test/a1.png'

  beforeEach(() => {
    // 캐시가 한 번도 채워지지 않는 기기(= 신규 설치 직후의 그 창).
    mockedGetCachedBasic.mockResolvedValue(null)
    rosterByAccount['account-a'] = [
      후보(낟낟, { imageUrl: 얼굴 }),
      후보(달의아이),
      후보(별헤는밤),
    ]
  })

  it('대표 얼굴이 로스터 응답으로 채워진다. 캐시가 비었다고 **?** 로 두지 않는다', async () => {
    const view = await renderScreen()

    expect(view.queryByTestId('account-select-face-fallback-account-a')).toBeNull()
    expect(view.getByTestId('account-select-face-account-a').props.source).toEqual({ uri: 얼굴 })
  })

  it('캐시가 빈 채로 고른 캐릭터도 이름·레벨이 보인다. 빈 행이 아니다', async () => {
    const view = await renderScreen()

    await press(view.getByText('달의아이'))

    expect(namesIn(view, 'character-manage-selected')).toEqual(['달의아이'])
    expect(textsIn(view.getByTestId('character-manage-selected-row'))).toContain('Lv.260 나이트로드')
  })

  // 로스터가 못 채우는 자리(지금 열지 않은 계정의 캐릭터)로 **재시도를 막지 않는다** 를
  // 따로 본다. 캐시가 **나중에** 차면 그때 그려져야 한다.
  it('캐시가 나중에 차면 그때 채워진다. miss 를 **없음** 으로 굳히지 않는다', async () => {
    mockContentStore({ trackedOcids: ['b1'] })
    let 캐시가찼다 = false
    mockedGetCachedBasic.mockImplementation(async (ocid: string) =>
      캐시가찼다 ? (캐시된캐릭터.get(ocid) ?? null) : null,
    )

    const view = await renderScreen()
    expect(namesIn(view, 'character-manage-selected')).toEqual([])

    캐시가찼다 = true
    // `neededKey` 를 움직이는 사건 하나. 후보를 고르면 위 층이 다시 읽힌다.
    await press(view.getByText('달의아이'))

    expect(namesIn(view, 'character-manage-selected')).toEqual(['밤샘메린', '달의아이'])
  })
})

describe('이동. 선택은 **표시** 가 아니라 **이동** 이다', () => {
  it('후보 카드를 누르면 아래에서 사라지고 위 리스트 **끝**에 붙는다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()

    await press(view.getByText('별헤는밤'))

    // 레벨(250)로 끼워 넣지 않는다. 새로 고른 캐릭터는 배열 끝이다.
    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟', '별헤는밤'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['달의아이'])
  })

  it('`✕` 로 빼면 지금 열린 계정 소속은 아래로 돌아온다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    const view = await renderScreen()

    await press(view.getByLabelText('달의아이 선택 해제'))

    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['달의아이', '별헤는밤'])
  })

  it('다른 계정 소속을 빼면 아래로 돌아오지 않는다. 그 계정을 열어야 보인다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'b1'] })
    const view = await renderScreen()

    await press(view.getByLabelText('밤샘메린 선택 해제'))

    expect(namesIn(view, 'character-manage-selected')).toEqual(['낟낟'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['달의아이', '별헤는밤'])
  })

  // 뺄 수 있으면 됐고, 다시 고를 수 있어야 할 이유는 없다.
  it('조회 불가 캐릭터는 위에 남아 해제되고, 빼면 어디에도 서지 않는다', async () => {
    mockContentStore({ trackedOcids: ['a2'] })
    rosterByAccount['account-a'] = [후보(낟낟), 후보(달의아이, { unavailable: true })]
    mockedGetLedger.mockImplementation(async (ocid: string) => ({
      unavailable: ocid === 'a2',
      dates: {},
    }))
    const view = await renderScreen()

    expect(view.getByText('조회할 수 없는 캐릭터')).toBeTruthy()
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['낟낟'])

    await press(view.getByLabelText('달의아이 선택 해제'))

    expect(namesIn(view, 'character-manage-selected')).toEqual([])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['낟낟'])
  })
})

describe('대표. 별의 뜻이 **고름** 에서 **대표** 로 바뀌었다', () => {
  it('대표가 없으면 아무 별도 채워지지 않고 흐려지지도 않는다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })

    const view = await renderScreen()

    for (const name of ['낟낟', '달의아이']) {
      expect(isRepresentative(view, name)).toBe(false)
      expect(flattenStyle(star(view, name).props.style).opacity).toBeUndefined()
    }
  })

  it('하나가 채워지면 나머지는 흐려진다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    mockedGetRepresentative.mockResolvedValue('a1')

    const view = await renderScreen()

    expect(isRepresentative(view, '낟낟')).toBe(true)
    expect(flattenStyle(star(view, '낟낟').props.style).opacity).toBeUndefined()
    expect(isRepresentative(view, '달의아이')).toBe(false)
    expect(flattenStyle(star(view, '달의아이').props.style).opacity as number).toBeCloseTo(0.4, 5)
  })

  it('흐린 별도 눌린다. 누르면 대표가 그리로 옮겨간다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    mockedGetRepresentative.mockResolvedValue('a1')
    const view = await renderScreen()

    await press(star(view, '달의아이'))

    expect(isRepresentative(view, '달의아이')).toBe(true)
    expect(isRepresentative(view, '낟낟')).toBe(false)
  })

  it('후보 카드에는 별이 없다. 자리가 곧 **고름** 이다', async () => {
    mockContentStore({ trackedOcids: [] })

    const view = await renderScreen()

    expect(view.queryByLabelText('낟낟 대표 캐릭터')).toBeNull()
  })

  it('대표를 뺀 자리는 **대표 없음** 이 된다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    mockedGetRepresentative.mockResolvedValue('a1')
    const view = await renderScreen()

    await press(view.getByLabelText('낟낟 선택 해제'))

    expect(isRepresentative(view, '달의아이')).toBe(false)
    expect(flattenStyle(star(view, '달의아이').props.style).opacity).toBeUndefined()
  })
})

describe('순서. 놓은 자리가 배열 순서다', () => {
  function handle(view: Rendered, name: string): AtomElement {
    return view.getByLabelText(`${name} 순서 변경`)
  }

  function actionLabels(element: AtomElement): string[] {
    const actions = (element.props.accessibilityActions ?? []) as { label?: string }[]
    return actions.map((action) => action.label ?? '')
  }

  async function reorder(
    view: Rendered,
    name: string,
    actionName: 'moveUp' | 'moveDown',
  ): Promise<void> {
    await act(async () => {
      fireEvent(handle(view, name), 'accessibilityAction', { nativeEvent: { actionName } })
    })
  }

  // **끌 수 있는 것은 위층뿐**이다. 아래층 카드와 구분자가 고정이라 위층 행이 그 아래로
  // 내려갈 자리가 없다. 층 이동은 누르기와 `✕` 둘뿐이다.
  it('핸들은 위 층 행에만 있다. 아래 층 순서는 사용자 것이 아니다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })

    const view = await renderScreen()

    const 위층 = view.getAllByTestId('character-manage-selected-row')
    const 아래층 = view.getAllByTestId('character-manage-candidate-row')
    expect(위층).toHaveLength(1)
    expect(아래층.length).toBeGreaterThan(0)
    expect(위층.flatMap((row) => within(row).getAllByTestId('drag-handle'))).toHaveLength(1)
    expect(아래층.flatMap((row) => within(row).queryAllByTestId('drag-handle'))).toEqual([])

    expect(view.queryByLabelText('달의아이 순서 변경')).toBeNull()
    expect(view.getByLabelText('낟낟 순서 변경')).toBeTruthy()
  })

  // 끌기와 접근성 액션은 **같은 문**을 쓴다(`moveOcid`). 그래서 기대값을 손으로 적지 않고
  // 그 함수에서 받는다. 두 경로가 갈라지면 이 단언이 먼저 깨진다.
  it.each([
    ['아래로 옮기기', '낟낟', 'moveDown' as const, 0, 1],
    ['위로 옮기기', '별헤는밤', 'moveUp' as const, 2, 1],
  ])('%s 액션이 moveOcid 와 같은 결과를 낸다', async (_label, name, actionName, from, to) => {
    mockContentStore({ trackedOcids: ['a1', 'a2', 'a3'] })
    const view = await renderScreen()
    const before = namesIn(view, 'character-manage-selected')

    await reorder(view, name, actionName)

    expect(namesIn(view, 'character-manage-selected')).toEqual(moveOcid(before, from, to))
  })

  // 눌러도 아무 일이 없는 액션을 로터에 남기지 않는다. 할 수 있는 것만 준다.
  it('경계 행에는 갈 수 없는 쪽 액션이 없다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2', 'a3'] })

    const view = await renderScreen()

    expect(actionLabels(handle(view, '낟낟'))).toEqual(['아래로 옮기기'])
    expect(actionLabels(handle(view, '달의아이'))).toEqual(['위로 옮기기', '아래로 옮기기'])
    expect(actionLabels(handle(view, '별헤는밤'))).toEqual(['위로 옮기기'])
  })

  it('하나뿐이면 순서 액션이 아예 없다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })

    const view = await renderScreen()

    expect(actionLabels(handle(view, '낟낟'))).toEqual([])
  })

  // **멤버십으로만 판정하라** 가 뒤집힌 자리. 집합은
  // 그대로이고 순서만 달라진다.
  it('순서만 바꿔도 저장이 활성이 된다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    const view = await renderScreen()
    const saveButton = (): AtomElement => {
      let node: AtomElement | null = view.getByText('저장')
      while (node !== null && node.props.role !== 'button') node = node.parent
      if (node === null) throw new Error('저장 버튼을 찾지 못했다')
      return node
    }
    expect(saveButton().props.accessibilityState?.disabled).toBe(true)

    await reorder(view, '낟낟', 'moveDown')

    expect(namesIn(view, 'character-manage-selected')).toEqual(['달의아이', '낟낟'])
    expect(saveButton().props.accessibilityState?.disabled).toBe(false)
  })

  it('바꾼 순서 그대로 저장한다. 저장 시점에 다시 정렬하지 않는다', async () => {
    const saveTrackedOcids = jest.fn(async () => {})
    mockContentStore({
      trackedOcids: ['a1', 'a2', 'a3'],
      saveTrackedOcids: saveTrackedOcids as unknown as ContentSchedulerStore['saveTrackedOcids'],
    })
    const view = await renderScreen()

    await reorder(view, '낟낟', 'moveDown')
    let node: AtomElement | null = view.getByText('저장')
    while (node !== null && node.props.role !== 'button') node = node.parent
    await press(node as AtomElement)
    await act(async () => {})

    // 레벨(294· 260· 250)로 되돌리지 않는다.
    expect(saveTrackedOcids).toHaveBeenCalledWith(['a2', 'a1', 'a3'], expect.any(Function))
  })
})

describe('계정 전환 TTL', () => {
  function accountsOf(): string[] {
    return mockedRoster.mock.calls.map((call) => call[1]?.accountId ?? '')
  }

  it('5분 안에 같은 계정을 다시 열면 조회가 한 번도 더 나가지 않는다', async () => {
    const view = await renderScreen()

    await switchAccount(view, 'account-b')
    await switchAccount(view, 'account-a')

    expect(accountsOf()).toEqual(['account-a', 'account-b'])
  })

  it('실패로 끝난 계정은 캐싱되지 않는다. 다시 열면 다시 돈다', async () => {
    rosterFailureByAccount['account-a'] = new Error('boom')
    const view = await renderScreen()

    await switchAccount(view, 'account-b')
    await switchAccount(view, 'account-a')

    expect(accountsOf()).toEqual(['account-a', 'account-b', 'account-a'])
  })

  it('`다시 시도`는 TTL 과 무관하게 그 계정을 다시 조회한다', async () => {
    rosterFailureByAccount['account-a'] = new Error('boom')
    const view = await renderScreen()
    delete rosterFailureByAccount['account-a']

    await press(view.getByText('다시 시도'))
    await act(async () => {})

    expect(accountsOf()).toEqual(['account-a', 'account-a'])
    expect(namesIn(view, 'character-manage-candidates')).toEqual(['낟낟', '달의아이', '별헤는밤'])
  })

  it('5분이 지나면 다시 돈다', async () => {
    const base = Date.now()
    const clock = jest.spyOn(Date, 'now').mockReturnValue(base)
    try {
      const view = await renderScreen()
      await switchAccount(view, 'account-b')

      clock.mockReturnValue(base + CHARACTER_BASIC_TTL_MS + 1)
      await switchAccount(view, 'account-a')

      expect(accountsOf()).toEqual(['account-a', 'account-b', 'account-a'])
    } finally {
      clock.mockRestore()
    }
  })

  // **방금 확인함** 류의 표시를 두지 않는다. 사용자가 아니라 구현의 사정이다.
  it('TTL 을 알리는 표시가 화면에 없다', async () => {
    const view = await renderScreen()

    await switchAccount(view, 'account-b')
    await switchAccount(view, 'account-a')

    expect(view.queryByText(/방금|최신|캐시/)).toBeNull()
  })
})

describe('못 고르는 계정', () => {
  it('그 계정의 후보가 0건이면 그 사실을 말하고, 출구는 드롭다운이다', async () => {
    rosterByAccount['account-a'] = []

    const view = await renderScreen()

    expect(view.getByText('이 메이플 ID 의 캐릭터는 모두 조회할 수 없어요')).toBeTruthy()
    expect(view.getByTestId('account-select-trigger')).toBeTruthy()
    expect(view.queryByText('계정 다시 선택')).toBeNull()
  })

  it('고를 수 있는 계정이 하나도 없으면 화면 전체가 빈 상태 + 키 재입력 경로다', async () => {
    mockedFetchCharacterList.mockResolvedValue([])

    const view = await renderScreen()

    expect(view.getByText('조회되는 캐릭터가 없어요')).toBeTruthy()
    expect(view.queryByTestId('account-select-trigger')).toBeNull()

    await press(view.getByText('API 키 다시 입력'))

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
  })

  it('후보를 전부 골랐으면 **모두 조회할 수 없어요** 가 아니라 빈 목록이다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2', 'a3'] })

    const view = await renderScreen()

    expect(view.getByText('표시할 캐릭터가 없어요')).toBeTruthy()
    // 라벨 오른쪽의 **n개 중 m개 표시** 는 뺐다.
    expect(view.queryByText(/개 중 .*개 표시/)).toBeNull()
  })
})

describe('키 재입력 진입점', () => {
  it.each([
    ['401', new NexonAuthError('401'), 'invalid'],
    ['429', new NexonRateLimitError('429'), 'rateLimited'],
  ])('후보 조회가 %s 로 끝나면 키 재입력 경로로 간다', async (_label, error, kind) => {
    rosterFailureByAccount['account-a'] = error

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith(kind)
  })

  it('계정 목록 조회가 401 로 끝나도 같은 경로로 간다', async () => {
    mockedFetchCharacterList.mockRejectedValue(new NexonAuthError('401'))

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
  })

  it('401·429 가 아닌 실패는 그 경로를 타지 않는다', async () => {
    rosterFailureByAccount['account-a'] = new Error('boom')

    await renderScreen()

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })
})

describe('저장', () => {
  function saveButton(view: Rendered): AtomElement {
    let node: AtomElement | null = view.getByText('저장')
    while (node !== null && node.props.role !== 'button') node = node.parent
    if (node === null) throw new Error('저장 버튼을 찾지 못했다')
    return node
  }

  function isSaveDisabled(view: Rendered): boolean {
    return saveButton(view).props.accessibilityState?.disabled === true
  }

  it('바뀐 것이 없으면 비활성이다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })

    expect(isSaveDisabled(await renderScreen())).toBe(true)
  })

  // 0개는 어떤 사용자 의도도 표현하지 않는다.
  it('0개면 비활성이다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()

    await press(view.getByLabelText('낟낟 선택 해제'))

    expect(isSaveDisabled(view)).toBe(true)
  })

  it('집합만 달라져도 활성이다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()

    await press(view.getByText('달의아이'))

    expect(isSaveDisabled(view)).toBe(false)
  })

  // **멤버십으로만 판정하라** 가 뒤집히는 자리다. 순서가 사용자 것이 되면서
  // 그 근거(그리드 토글이 배열 끝에 append 해 순서가 의미 없이 흔들린다)가 사라졌다.
  it('집합이 같아도 순서가 달라지면 활성이다', async () => {
    mockContentStore({ trackedOcids: ['a1', 'a2'] })
    const view = await renderScreen()

    await press(view.getByLabelText('낟낟 선택 해제'))
    await press(view.getByText('낟낟'))

    expect(namesIn(view, 'character-manage-selected')).toEqual(['달의아이', '낟낟'])
    expect(isSaveDisabled(view)).toBe(false)
  })

  it('대표만 달라져도 활성이다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()
    expect(isSaveDisabled(view)).toBe(true)

    await press(star(view, '낟낟'))

    expect(isSaveDisabled(view)).toBe(false)
  })

  it('목록을 먼저 쓰고 대표를 그 뒤에 쓴 다음 보스·수익 스토어를 다시 읽힌다', async () => {
    const order: string[] = []
    const saveTrackedOcids = jest.fn(async () => {
      order.push('save')
    })
    mockedSetRepresentative.mockImplementation(async () => {
      order.push('representative')
    })
    mockLoadBossTracked.mockImplementation(async () => {
      order.push('boss')
    })
    mockLoadProfitTracked.mockImplementation(async () => {
      order.push('profit')
    })
    mockContentStore({
      trackedOcids: ['a1'],
      saveTrackedOcids: saveTrackedOcids as unknown as ContentSchedulerStore['saveTrackedOcids'],
    })
    const view = await renderScreen()
    await press(view.getByText('달의아이'))
    await press(star(view, '달의아이'))

    await press(saveButton(view))
    await act(async () => {})

    expect(saveTrackedOcids).toHaveBeenCalledWith(['a1', 'a2'], expect.any(Function))
    expect(mockedSetRepresentative).toHaveBeenCalledWith('a2')
    // 목록 저장이 먼저 돌아야 한다. `setTrackedCharacterOcids` 가 목록에 없는 대표를 지운다.
    expect(order).toEqual(['save', 'representative', 'boss', 'profit'])
    expect(goBack).toHaveBeenCalled()
  })

  it('대표를 고르지 않았으면 저장할 때 그 키를 지운다', async () => {
    mockContentStore({ trackedOcids: ['a1'] })
    const view = await renderScreen()
    await press(view.getByText('달의아이'))

    await press(saveButton(view))
    await act(async () => {})

    expect(mockedClearRepresentative).toHaveBeenCalledTimes(1)
    expect(mockedSetRepresentative).not.toHaveBeenCalled()
  })

  it('저장 중에는 진행률 모달을 띄운다', async () => {
    let resolveSave: () => void = () => {}
    mockContentStore({
      trackedOcids: ['a1'],
      saveTrackedOcids: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve
          }),
      ) as unknown as ContentSchedulerStore['saveTrackedOcids'],
    })
    const view = await renderScreen()
    await press(view.getByText('달의아이'))

    await press(saveButton(view))

    expect(view.getByText(/캐릭터 정보를 저장하고 있어요/)).toBeTruthy()

    await act(async () => {
      resolveSave()
    })
  })

  // 뒤로가기가 둘(헤더 `←`· OS)인 화면에서 셋째 출구는 중복이다.
  it('`닫기` 버튼은 없다. 출구는 뒤로가기다', async () => {
    const view = await renderScreen()

    expect(view.queryByText('닫기')).toBeNull()
  })
})

describe('화면 골격', () => {
  it('자기 스크롤 컨테이너를 갖고, 고정되는 것은 저장 바 하나다 ( 의 하단 액션 바 예외)', async () => {
    const view = await renderScreen()

    // 헤더가 스크롤 뷰의 **자식**이다. 형제로 두면 화면에 붙어 영원히 고정된다.
    expect(view.getByTestId('screen-scroll')).toBeTruthy()
    expect(view.getByTestId('screen-SettingsCharacters')).toBeTruthy()
    expect(view.getByText('캐릭터 관리')).toBeTruthy()
    // 저장 바는 반대로 스크롤 뷰 **밖**이라야 어디까지 굴렸든 눌린다.
    expect(view.getByTestId('character-manage-action-bar')).toBeTruthy()
  })

  // `더 높은 레벨이 존재하는 ID 가 먼저`. 응답 순서(넥슨이 정한다)를
  // 그대로 쓰면 주력 ID 가 뒤에 설 수 있고, 화면은 목록의 첫 항목을 연다.
  it('메이플 ID 차례는 대표 레벨 내림차순이다. 응답 순서를 따르지 않는다', async () => {
    // 응답을 뒤집어 준다: 계정B(대표 275) 가 먼저, 계정A(대표 294) 가 나중.
    mockedFetchCharacterList.mockResolvedValue([계정B, 계정A])

    const view = await renderScreen()

    // 첫 조회가 account-a 다. 정렬이 첫 계정 선택에도 그대로 걸린다.
    expect(mockedRoster.mock.calls[0]?.[1]?.accountId).toBe('account-a')

    await press(view.getByTestId('account-select-trigger'))
    const options = view
      .getAllByTestId(/^account-select-option-/)
      .map((node) => String(node.props.testID).replace('account-select-option-', ''))
    expect(options).toEqual(['account-a', 'account-b'])
  })

  it('저장 버튼은 그 바 안에서 폭을 다 쓴다', async () => {
    const view = await renderScreen()

    const bar = view.getByTestId('character-manage-action-bar')
    const button = within(bar).getByRole('button')
    // 클래스 문자열은 NativeWind 가 스타일로 바꿔 사라지므로 flatten 한 값에서 읽는다.
    expect(StyleSheet.flatten(button.props.style).width).toBe('100%')
  })

  it('뒤로 버튼이 pop 한다', async () => {
    const view = await renderScreen()

    await press(view.getByLabelText('뒤로'))

    expect(goBack).toHaveBeenCalledTimes(1)
  })
})
