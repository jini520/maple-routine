// 이 앱이 **처음으로 직접 만드는 여는 목록**이라 테스트가 지키는 것도 **값이
// 잘 나오는가** 보다 **무엇을 두지 않기로 했는가** 쪽이 많다. 스크림 없음 · 지시받지 않은 문구 없음.
//
// 대표 캐릭터 규칙은 `summarizeAccount` 가 갖는다. 그래서 픽스처를 손으로 적지 않고 **그 함수를 통과시켜** 만든다.
// 여기서 기대값을 베끼면 규칙이 두 벌이 된다.
import { act, fireEvent } from '@testing-library/react-native'

import {
  summarizeAccount,
  type AccountSummaryView,
} from '../../../../features/character-manage/derivations'
import type { MapleCharacter } from '../../../../types'
import { worldKeyOfApiName } from '../../../../lib/world/worlds'

import { flattenStyle, renderOverlay, 기본테마, type TreeNode } from '../../../__tests__/render-atom'
import { AccountSelect } from '../AccountSelect'
import { placeDropdown } from '../../../../lib/place-dropdown'

function 캐릭터(name: string, world: string, level: number): MapleCharacter {
  return { ocid: `ocid-${name}`, name, world, worldKey: worldKeyOfApiName(world), jobClass: '아크메이지(썬, 콜)', level }
}

function 여럿(world: string, count: number, level: number): MapleCharacter[] {
  return Array.from({ length: count }, (_, i) => 캐릭터(`${world}${i}`, world, level))
}

function 요약(accountId: string, characters: MapleCharacter[]): AccountSummaryView {
  const summary = summarizeAccount({ accountId, characters })
  if (summary === null) throw new Error('픽스처에 캐릭터가 없다')
  return summary
}

const A = 'da9b2f21-a'
const B = '4f1c08ab-b'

/** 스카니아 19 · 엘리시움 7 · 크로아 3. 월드별 개수는 행에 적지 않는다. */
const 계정A = 요약(A, [
  캐릭터('낟낟', '스카니아', 294),
  ...여럿('스카니아', 18, 200),
  ...여럿('엘리시움', 7, 210),
  ...여럿('크로아', 3, 180),
])

const 계정B = 요약(B, [캐릭터('밤샘메린', '루나', 275), ...여럿('루나', 4, 150)])

type Props = React.ComponentProps<typeof AccountSelect>

function props(overrides: Partial<Props> = {}): Props {
  return {
    accounts: [계정A, 계정B],
    selectedAccountId: A,
    portraitByAccountId: {},
    onSelect: jest.fn(),
    ...overrides,
  }
}

async function 열어서(overrides: Partial<Props> = {}): Promise<ReturnType<typeof renderOverlay>> {
  const rendered = await renderOverlay(<AccountSelect {...props(overrides)} />)
  await fireEvent.press(rendered.getByTestId('account-select-trigger'))
  return rendered
}

/** 트리에서 배경색을 전부 모은다. 어딘가에 스크림이 칠해져 있지 않은가 를 묻는 용도. */
function backgroundColors(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(backgroundColors)
  if (node === null || typeof node !== 'object') return []
  const current = node as TreeNode
  const style = flattenStyle(current.props.style)
  const own = style.backgroundColor === undefined ? [] : [style.backgroundColor]
  return [...own, ...backgroundColors(current.children)]
}

describe('AccountSelect: 트리거', () => {
  it('트리거가 선택된 메이플 ID 의 행을 그린다. 1줄 메이플 ID 이름, 2줄 대표 캐릭터이고 월드별 개수는 적지 않는다', async () => {
    const { getByTestId, getByText, queryByText } = await renderOverlay(<AccountSelect {...props()} />)

    expect(getByTestId('account-select-trigger')).toBeTruthy()
    expect(getByText('메이플ID-da9b2f21')).toBeTruthy()
    expect(getByText('스카니아 Lv.294 낟낟')).toBeTruthy()
    expect(queryByText(/\d+개/)).toBeNull()
  })

  it('계정이 하나여도 그린다. 숨기면 메이플 ID 가 여럿일 수 있다는 사실이 사라진다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <AccountSelect {...props({ accounts: [계정B], selectedAccountId: B })} />,
    )

    expect(getByTestId('account-select-trigger')).toBeTruthy()
    expect(getByText('루나 Lv.275 밤샘메린')).toBeTruthy()
  })

  // 폴백 규칙은 `CharacterRow` 와 같다. 이니셜이 아니라 흰 실루엣.
  it('얼굴이 없으면 흰 실루엣이다. 얼굴 때문에 조회하지 않는다', async () => {
    const { queryByTestId, getByTestId, queryByText } = await renderOverlay(
      <AccountSelect {...props()} />,
    )

    expect(queryByTestId(`account-select-face-${A}`)).toBeNull()
    expect(queryByText('낟')).toBeNull()
    expect(queryByText('?')).toBeNull()
    expect(getByTestId(`account-select-face-fallback-${A}`)).toBeTruthy()
  })

  it('캐시에 얼굴이 있으면 그것을 쓴다', async () => {
    const { getByTestId } = await renderOverlay(
      <AccountSelect {...props({ portraitByAccountId: { [A]: 'https://face/a' } })} />,
    )

    expect(getByTestId(`account-select-face-${A}`)).toBeTruthy()
  })
})

describe('AccountSelect: 열린 목록', () => {
  it('각 행이 메이플 ID 이름과 대표 캐릭터를 말한다', async () => {
    const { getAllByText } = await 열어서()

    // 트리거가 뒤에 남아 있으므로 선택된 메이플 ID 의 줄은 두 번(트리거 + 목록 행) 나온다.
    expect(getAllByText('메이플ID-da9b2f21')).toHaveLength(2)
    expect(getAllByText('스카니아 Lv.294 낟낟')).toHaveLength(2)
    expect(getAllByText('메이플ID-4f1c08ab')).toHaveLength(1)
    expect(getAllByText('루나 Lv.275 밤샘메린')).toHaveLength(1)
  })

  // 넥슨 계정이 하나면 라벨로 가를 것이 없어 부르는 쪽이 라벨을 넘기지 않는다.
  it('묶음 라벨을 받으면 묶음이 바뀌는 행 앞에만 라벨이 선다', async () => {
    const 계정C = 요약('0c5a7e6f-c', [캐릭터('새벽파티장', '루나', 268)])
    const { getAllByText } = await 열어서({
      accounts: [계정A, 계정B, 계정C],
      groupOf: { [A]: '넥슨 ID 계정', [B]: '넥슨 ID 계정', '0c5a7e6f-c': 'API 키 1 계정' },
    })

    expect(getAllByText('넥슨 ID 계정')).toHaveLength(1)
    expect(getAllByText('API 키 1 계정')).toHaveLength(1)
  })

  it('묶음 라벨을 안 받으면 라벨이 없다', async () => {
    const { queryByText } = await 열어서()

    expect(queryByText(/계정$/)).toBeNull()
  })

  it('선택된 계정만 선택 상태다', async () => {
    const { getByTestId } = await 열어서()

    expect(getByTestId(`account-select-option-${A}`).props.accessibilityState.selected).toBe(true)
    expect(getByTestId(`account-select-option-${B}`).props.accessibilityState.selected).toBe(false)
  })

  it('지시받지 않은 문구를 붙이지 않는다. **선택 n개**·**방금 확인함** 이 없다', async () => {
    const { queryByText } = await 열어서()

    expect(queryByText(/선택\s*\d+개/)).toBeNull()
    expect(queryByText(/방금 확인함/)).toBeNull()
    expect(queryByText(/확인함/)).toBeNull()
  })

  it('고르면 그 계정 id 로 onSelect 를 부르고 목록을 닫는다', async () => {
    const p = props()
    const rendered = await renderOverlay(<AccountSelect {...p} />)
    await fireEvent.press(rendered.getByTestId('account-select-trigger'))

    await fireEvent.press(rendered.getByTestId(`account-select-option-${B}`))

    expect(p.onSelect).toHaveBeenCalledWith(B)
    expect(rendered.queryByTestId('account-select-list')).toBeNull()
  })
})

describe('AccountSelect: 층은 그림자와 테두리가 말한다', () => {
  // 이 케이스가 이 step 의 계약이다. 뒤를 어둡게 덮으면 값 하나를 고르는 일이
  // 화면을 뺏는 일로 읽히고, 바로 아래 후보 목록까지 함께 어두워진다.
  it('스크림·딤 역할을 하는 배경색 요소가 없다', async () => {
    const { toJSON } = await 열어서()

    expect(backgroundColors(toJSON())).not.toContain(기본테마.scrim)
  })

  it('닫기용 터치 캐처는 잡기만 하고 칠하지 않는다', async () => {
    const { getByTestId } = await 열어서()

    expect(flattenStyle(getByTestId('account-select-backdrop').props.style).backgroundColor).toBeUndefined()
  })

  it('바깥을 누르면 닫힌다. 고르는 중에 아무것도 커밋하지 않아 잃을 것이 없다', async () => {
    const p = props()
    const rendered = await renderOverlay(<AccountSelect {...p} />)
    await fireEvent.press(rendered.getByTestId('account-select-trigger'))

    await fireEvent.press(rendered.getByTestId('account-select-backdrop'))

    expect(rendered.queryByTestId('account-select-list')).toBeNull()
    expect(p.onSelect).not.toHaveBeenCalled()
  })

  it('안드로이드 뒤로가기(onRequestClose)로 닫힌다', async () => {
    const rendered = await 열어서()
    // `Modal` 자신을 testID 로 잡는다. 이 프롭은 호스트 뷰가 아니라 `Modal` 요소가 갖는다
    // 상태를 바꾸므로 `act` 로 감싼다.
    const modal = rendered.getByTestId('account-select-modal', { includeHiddenElements: true })

    await act(async () => {
      ;(modal.props.onRequestClose as () => void)()
    })

    expect(rendered.queryByTestId('account-select-list')).toBeNull()
  })
})

describe('placeDropdown: 트리거 자리에서 시작하고, 넘치면 뒤집는다', () => {
  const 화면 = { windowHeight: 844, safeTop: 59, safeBottom: 34, edgeGap: 12 }

  it('아래에 들어가면 목록의 윗변이 트리거 윗변이다. 사이를 띄우지 않는다', () => {
    const placed = placeDropdown({ ...화면, anchorTop: 200, anchorHeight: 60, contentHeight: 300 })

    expect(placed.top).toBe(200)
  })

  it('아래로 넘치면 위로 뒤집어 목록의 밑변을 트리거 밑변에 맞춘다', () => {
    const placed = placeDropdown({ ...화면, anchorTop: 600, anchorHeight: 60, contentHeight: 300 })

    expect(placed.top).toBe(600 + 60 - 300)
  })

  it('양쪽 다 모자라면 넓은 쪽에 붙이고 그만큼으로 자른다. 목록은 안에서 굴린다', () => {
    const placed = placeDropdown({ ...화면, anchorTop: 700, anchorHeight: 60, contentHeight: 900 })

    // 위쪽이 넓다(700 + 60 − 71 = 689 vs 844 − 34 − 12 − 700 = 98).
    expect(placed.top).toBe(71)
    expect(placed.maxHeight).toBe(689)
  })
})

// 닫힌 줄과 펼친 목록 모두 테두리가 없다. 앱의 드롭다운이 한 모양이다.
describe('AccountSelect: 테두리', () => {
  it('닫힌 줄과 펼친 목록에 테두리가 없다', async () => {
    const rendered = await 열어서()

    expect(flattenStyle(rendered.getByTestId('account-select-trigger').props.style).borderWidth ?? 0).toBe(0)
    expect(flattenStyle(rendered.getByTestId('account-select-list').props.style).borderWidth ?? 0).toBe(0)
  })
})

// 목록은 모서리를 자르느라 `overflow: hidden` 이다. iOS 는 그 상자의 그림자를 함께 잘라서, 그림자는 바깥 상자가 든다.
describe('AccountSelect: 그림자', () => {
  it('목록 바깥 상자가 boxShadow 를 들고, 자르는 상자에는 그림자가 없다', async () => {
    const rendered = await 열어서()

    expect(typeof flattenStyle(rendered.getByTestId('account-select-list-shadow').props.style).boxShadow).toBe('string')
    const list = flattenStyle(rendered.getByTestId('account-select-list').props.style)
    expect(list.overflow).toBe('hidden')
    expect(list.shadowRadius).toBeUndefined()
  })
})
