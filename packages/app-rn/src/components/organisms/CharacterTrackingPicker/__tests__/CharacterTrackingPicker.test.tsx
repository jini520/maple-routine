// 웹판(761줄)을 옮긴 것. **각 케이스가 지키는 ADR 은 웹 주석 그대로**이고, RN 에서 표현이 갈린
// 자리만 여기 다시 적는다.
//
// 갈린 것 넷
// ① `getByRole('heading')` → RN 에 heading role 이 없어 글자로 찾는다.
// ② `toBeDisabled()` 대신 `props.disabled` 를 본다 — RNTL 의 `toBeDisabled` 는 `accessibilityState`
//    까지 보고, `Pressable` 은 `disabled` 를 그대로 넘긴다.
// ③ 카드 선택 상태는 `aria-pressed` → **`aria-selected`**(RN 접근성 상태에 *pressed* 가 없다).
// ④ "뒷 페이지 스크롤 잠금" 케이스가 사라졌다 — RN `Modal` 이 별도 네이티브 윈도우라 그 잠금이
//    **필요 자체가 없다**(컴포넌트 주석 ②). 대신 그 자리에 `onRequestClose`(안드로이드 뒤로가기,
//    [[ADR-120]] 결정 18 후반) 케이스를 둔다.
import { fireEvent } from '@testing-library/react-native'

import type { CharacterPickerEntry } from '@core/types'

import { renderOverlay, type AtomElement } from '../../../__tests__/render-atom'
import { CharacterTrackingPicker } from '../CharacterTrackingPicker'
import { ROSTER_BODY_MIN_H_PX } from '../roster-body'

const entries: CharacterPickerEntry[] = [
  { ocid: 'ocid-1', name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', world: '엘리시움' },
  { ocid: 'ocid-2', name: '내옆에최성일', level: 211, imageUrl: null, world: '베라' },
  { ocid: 'ocid-3', name: '테스트캐릭터', level: 165, imageUrl: null, world: '리부트' },
]

// [[ADR-053]] 결정 3: 로딩/실패는 호출부가 `getCharacterPickerRoster` 의 Promise 로 판정해 내려준다.
// [[ADR-062]] 결정 2: `loadFailed`(boolean)를 `loadError`(원인)로 바꿔 원인별 문구·액션을 그린다.
// 아래 기존 케이스는 모두 "조회 완료 + 성공" 상태를 전제한다.
const loaded = { isLoading: false, loadError: null, onRetry: jest.fn() }

const noop = (): void => {}

/** `Pressable` 이 접어 넣는 접근성 상태 — 아래 두 헬퍼가 읽는 것. */
interface PressableState {
  selected?: boolean
  disabled?: boolean
}

type GetByText = (text: string) => AtomElement

/**
 * 글자를 담은 `Text` 에서 위로 올라가 그 글자를 감싼 `Pressable` 을 찾는다.
 *
 * **`aria-*` 를 직접 볼 수 없다** — `Pressable` 이 `aria-selected`·`disabled` 를 호스트 `View` 로
 * 그대로 넘기지 않고 `accessibilityState` 로 접어 넣는다(실측). 그래서 표식은 `role` 로 찾고
 * 상태는 `accessibilityState` 에서 읽는다. 웹판의 `getByRole('button', { name })` 과 같은 자리다.
 */
function pressable(getByText: GetByText, text: string): AtomElement {
  let node: AtomElement | null = getByText(text)
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`Pressable 을 찾지 못했다: ${text}`)
  return node
}

function stateOf(node: AtomElement): PressableState {
  return (node.props.accessibilityState ?? {}) as PressableState
}

/** 카드가 선택(즐겨찾기)됐는가 — 웹 `aria-pressed` 의 짝. */
function isSelected(getByText: GetByText, name: string): boolean | undefined {
  return stateOf(pressable(getByText, name)).selected
}

/** 버튼이 비활성인가 — `disabled` 프롭도 `accessibilityState` 로 접힌다. */
function isDisabled(getByText: GetByText, label: string): boolean | undefined {
  return stateOf(pressable(getByText, label)).disabled
}

describe('CharacterTrackingPicker', () => {
  it('제목과 설명을 보여준다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByText('캐릭터 관리')).toBeTruthy()
    expect(getByText('체크한 캐릭터만 스케줄러 목록에 표시됩니다. 최소 한 명은 선택해주세요.')).toBeTruthy()
  })

  // [[ADR-086]] 결정 7: 0명은 화면을 빈 상태로 만들 뿐 어떤 사용자 의도도 표현하지 않는다.
  it('전부 해제하면 저장 버튼이 비활성이다 — 목록을 통째로 비울 수 없다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '낟낟'))

    expect(isDisabled(getByText, '저장')).toBe(true)
  })

  it('trackedOcids 에 포함된 캐릭터가 초기에 선택(즐겨찾기) 상태로 표시된다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1', 'ocid-3']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(isSelected(getByText, '낟낟')).toBe(true)
    expect(isSelected(getByText, '테스트캐릭터')).toBe(true)
    expect(isSelected(getByText, '내옆에최성일')).toBe(false)
  })

  it('카드를 눌러도 즉시 onSave 가 호출되지 않는다', async () => {
    const onSave = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={onSave}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '낟낟'))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('저장 버튼을 누르면 그 시점의 선택 상태로 onSave 를 호출한다', async () => {
    const onSave = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={onSave}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '낟낟'))
    await fireEvent.press(pressable(getByText, '테스트캐릭터'))
    await fireEvent.press(getByText('저장'))

    expect(onSave).toHaveBeenCalledWith(['ocid-1', 'ocid-3'])
  })

  it('선택을 바꾸지 않으면 저장 버튼이 비활성이다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(isDisabled(getByText, '저장')).toBe(true)
  })

  it('캐릭터를 추가로 체크하면 저장 버튼이 활성화된다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '테스트캐릭터'))

    expect(isDisabled(getByText, '저장')).toBe(false)
  })

  it('바꿨다가 원래 집합으로 되돌리면 저장 버튼이 다시 비활성이 된다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '테스트캐릭터'))
    await fireEvent.press(pressable(getByText, '테스트캐릭터'))

    expect(isDisabled(getByText, '저장')).toBe(true)
  })

  // [[ADR-043]] 결정 1: 토글이 ocid 를 배열 끝에 append 하므로 같은 집합이어도 순서가 달라진다.
  it('선택 순서만 달라진 동일 집합에서도 저장 버튼이 비활성으로 유지된다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1', 'ocid-3']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    // ocid-1 을 해제했다 다시 켜면 선택 배열은 ['ocid-3', 'ocid-1'] — 집합은 같다.
    await fireEvent.press(pressable(getByText, '낟낟'))
    await fireEvent.press(pressable(getByText, '낟낟'))

    expect(isDisabled(getByText, '저장')).toBe(true)
  })

  it('닫기 버튼을 누르면 onSave 없이 onClose 만 호출된다', async () => {
    const onSave = jest.fn()
    const onClose = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await fireEvent.press(getByText('닫기'))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  // 웹은 "오버레이 바깥을 클릭해도 안 닫힌다"를 단언했다. RN 에는 그 클릭 핸들러 자체가 없으므로
  // (오버레이 `View` 에 `onPress` 를 안 달았다) 계약을 **구조로** 확인한다.
  it('오버레이 자체는 눌러도 닫히지 않는다 — 닫기 버튼으로만 닫는다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={onClose}
      />,
    )

    expect(getByTestId('character-tracking-picker-overlay').props.onPress).toBeUndefined()
    expect(onClose).not.toHaveBeenCalled()
  })

  // [[ADR-120]] 결정 18 후반 — 2단계가 organisms 몫으로 남긴 자리. 뒤로가기는 스택을 pop 하는 게
  // 아니라 이 오버레이만 닫는다.
  it('안드로이드 뒤로가기(onRequestClose)는 이 오버레이만 닫는다', async () => {
    const onClose = jest.fn()
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={onClose}
      />,
    )

    // `Modal` 자신을 testID 로 잡는다 — RNTL 14 는 `UNSAFE_getByType` 을 없앴고, 이 프롭은
    // 호스트 뷰가 아니라 `Modal` 요소가 갖는다.
    const modal = getByTestId('character-tracking-picker-modal', { includeHiddenElements: true })
    ;(modal.props.onRequestClose as () => void)()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('imageUrl 이 있으면 캐릭터 이미지를 렌더링한다', async () => {
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('character-face-ocid-1').props.source).toEqual({
      uri: 'https://example.com/1.png',
    })
  })

  it('imageUrl 이 null 이면 이미지 대신 플레이스홀더를 표시한다', async () => {
    const { queryByTestId, getAllByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(queryByTestId('character-face-ocid-2')).toBeNull()
    expect(getAllByText('?').length).toBe(2)
  })

  // 웹의 두 케이스("엠블럼을 표시한다" / "매핑에 없는 월드는 생략한다")가 [[ADR-129]] 로 되살아났다 —
  // 3단계에서는 `worldEmblemUrl` 이 항상 `null` 이라 둘이 한 사실로 합쳐져 있었다.
  //
  // `리부트`(ocid-3)는 `world-emblems.json` 에 없어 **지금도** 생략되는 쪽이다. 그 한 케이스가
  // 남아 있어야 "에셋이 왔으니 무조건 그린다"로 굳지 않는다.
  it('엠블럼이 있는 월드는 그리고, 매핑에 없는 월드는 생략한다', async () => {
    const { getByTestId, queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('world-emblem-ocid-1')).toBeTruthy() // 엘리시움
    expect(queryByTestId('world-emblem-ocid-3')).toBeNull() // 리부트 — 매핑 없음
  })

  // 얼굴은 넥슨이 주는 **원격 URI** 이고 엠블럼은 **번들 에셋**이라 `source` 형태가 갈린다
  // (`CharacterTrackingGrid` 주석 ⑤). 감싸는 쪽을 바꿔 놓으면 그림만 조용히 안 뜨므로 계약으로 둔다.
  it('얼굴은 `{ uri }`, 엠블럼은 에셋 참조 그대로 넘긴다', async () => {
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('character-face-ocid-1').props.source).toEqual({
      uri: 'https://example.com/1.png',
    })
    expect(getByTestId('world-emblem-ocid-1').props.source).not.toHaveProperty('uri')
  })
})

// [[ADR-015]]: 즐겨찾기(선택)한 캐릭터를 그룹 맨 앞으로 보낸다.
describe('CharacterTrackingPicker — 정렬', () => {
  it('즐겨찾기한 캐릭터가 레벨이 낮아도 그룹 맨 앞으로 재정렬된다', async () => {
    const { getAllByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-3']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )


    // 레벨 표기의 순서가 곧 카드 순서다(165 → 293 → 211).
    expect(getAllByText(/^Lv\./).map((node) => node.children.join(''))).toEqual([
      'Lv.165',
      'Lv.293',
      'Lv.211',
    ])
  })

  it('즐겨찾기를 다시 해제하면 원래 순서(레벨 내림차순)로 되돌아간다', async () => {
    const { getAllByText, getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-3']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '테스트캐릭터'))

    expect(getAllByText(/^Lv\./).map((node) => node.children.join(''))).toEqual([
      'Lv.293',
      'Lv.211',
      'Lv.165',
    ])
  })
})

describe('CharacterTrackingPicker — 로딩/빈/실패 상태 ([[ADR-053]] · [[ADR-062]])', () => {
  it('조회 중이고 보여줄 항목이 없으면 스피너를 보여주고 그리드 항목은 없다', async () => {
    const { getByTestId, queryByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        isLoading
        loadError={null}
        onRetry={noop}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeTruthy()
    expect(queryByText('표시할 캐릭터가 없어요')).toBeNull()
  })

  // [[ADR-016]] 캐시 우선 표시 — 스피너로 목록을 가리지 않는다.
  it('조회 중이어도 캐시로 보여줄 항목이 있으면 스피너 대신 그리드를 그린다', async () => {
    const { getByText, queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        isLoading
        loadError={null}
        onRetry={noop}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByText('낟낟')).toBeTruthy()
    expect(queryByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeNull()
  })

  it('조회가 끝났는데 항목이 없으면 빈 상태 안내를 보여준다(스피너 없음)', async () => {
    const { getByText, queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByText('표시할 캐릭터가 없어요')).toBeTruthy()
    expect(queryByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeNull()
  })

  it('항목 없이 실패하면 빈 상태와 구분되는 ErrorState 를 보여준다', async () => {
    const { getByTestId, queryByTestId, queryByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('error-state')).toBeTruthy()
    expect(getByTestId('error-state-title').children.join('')).toBe('캐릭터 목록을 불러오지 못했습니다')
    expect(queryByText('표시할 캐릭터가 없어요')).toBeNull()
    expect(queryByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeNull()
  })

  it('실패 원인에 따라 문구가 달라진다 — 401은 무효 키를 말한다', async () => {
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'invalidApiKey' }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('error-state-title').children.join('')).toBe('API 키가 유효하지 않습니다')
  })

  it('network 실패의 다시 시도를 누르면 onRetry 가 호출된다', async () => {
    const onRetry = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onRetry={onRetry}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(getByText('다시 시도'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // [[ADR-062]] 결정 3 · [[ADR-115]] 결정 1·7: 401에 재시도도 설정 이동도 주지 않는다 —
  // 이 401은 곧 키 무효화라 화면이 스스로 키 입력으로 이동한다. 누를 것이 없다.
  it('401 실패는 액션 없이 이동을 알린다 — 모달 자체 버튼(닫기·저장) 외에는 버튼이 없다', async () => {
    const { getByTestId, queryByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'invalidApiKey' }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('error-state-description').children.join('')).toBe('키 입력 화면으로 이동합니다')
    expect(queryByText('다시 시도')).toBeNull()
    expect(queryByText('설정 열기')).toBeNull()
  })

  // [[ADR-116]] 결정 4(이슈 #178): 429에도 액션은 없다([[ADR-114]] 결정 2 유지 — 눌러도 또 429다).
  // 잠기지 않는 근거는 **자리**다: 모달이라 껍데기의 "닫기"가 항상 남는다.
  it('429 실패는 액션 없이 처방만 말하고, 모달 껍데기의 닫기가 남는다', async () => {
    const { getByTestId, getByText, queryByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[]}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'rateLimited' }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('error-state-title').children.join('')).toBe('호출 한도를 초과했습니다')
    expect(getByTestId('error-state-description').children.join('')).toBe(
      '입력하신 API 키가 서비스 단계 키인지 확인해주세요',
    )
    expect(queryByText('다시 시도')).toBeNull()
    expect(getByText('닫기')).toBeTruthy()
  })

  // [[ADR-062]] 결정 4: 항목이 있는 채로 실패하면 그리드를 지우지 않는다.
  it('보여줄 항목이 있는 채로 실패하면 그리드를 지우지 않고 스탈 배너를 얹는다', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('stale-banner')).toBeTruthy()
    expect(getByText('낟낟')).toBeTruthy()
    expect(queryByTestId('error-state')).toBeNull()
  })

  it('스탈 배너의 다시 시도를 누르면 onRetry 가 호출된다', async () => {
    const onRetry = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind: 'network' }}
        onRetry={onRetry}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(getByText('다시 시도'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // [[ADR-114]] 결정 2·3: 배너의 액션도 원인별이다 — 재시도가 통하지 않는 셋에는 없다.
  it.each([
    ['rateLimited' as const, '호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요'],
    ['invalidApiKey' as const, 'API 키가 유효하지 않아 목록을 갱신하지 못했습니다'],
    ['characterUnavailable' as const, '이 계정의 캐릭터를 조회할 수 없습니다'],
  ])('%s 배너는 원인만 말하고 액션을 주지 않는다', async (kind, message) => {
    const { getByTestId, getByText, queryByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        loadError={{ kind }}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('stale-banner')).toBeTruthy()
    expect(getByText(message)).toBeTruthy()
    expect(queryByText('다시 시도')).toBeNull()
  })

  it('조회가 끝나고 항목이 있으면 그리드만 보여준다', async () => {
    const { getByText, queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByText('낟낟')).toBeTruthy()
    expect(queryByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeNull()
    expect(queryByTestId('error-state')).toBeNull()
    expect(queryByTestId('stale-banner')).toBeNull()
  })

  it('로딩 중이어도 저장 버튼 비활성 판정은 [[ADR-043]] 집합 비교 그대로다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        isLoading
        loadError={null}
        onRetry={noop}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(isDisabled(getByText, '저장')).toBe(true)
    await fireEvent.press(pressable(getByText, '테스트캐릭터'))
    expect(isDisabled(getByText, '저장')).toBe(false)
  })
})

// [[ADR-068]] 결정 4: 조회 불가 항목은 숨기지 않고 별도 섹션으로 내리며 **해제만** 허용한다.
describe('조회 불가 캐릭터', () => {
  const withUnavailable: CharacterPickerEntry[] = [
    ...entries,
    { ocid: 'ocid-4', name: '조회불가', level: 200, imageUrl: null, world: '스카니아', unavailable: true },
  ]

  it('별도 섹션으로 분리해 보여준다', async () => {
    const { getByTestId, getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(getByTestId('unavailable-roster')).toBeTruthy()
    expect(getByText('조회할 수 없는 캐릭터')).toBeTruthy()
  })

  it('추적 중이 아니면 눌러도 선택되지 않는다 — 고를 수 없는 후보다', async () => {
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '조회불가'))

    expect(isSelected(getByText, '조회불가')).toBe(false)
    expect(isDisabled(getByText, '저장')).toBe(true)
  })

  it('추적 중이면 눌러서 해제할 수 있다 — 갇힌 상태를 벗어나는 유일한 경로다', async () => {
    const onSave = jest.fn()
    const { getByText } = await renderOverlay(
      <CharacterTrackingPicker
        entries={withUnavailable}
        trackedOcids={['ocid-1', 'ocid-4']}
        {...loaded}
        onSave={onSave}
        onClose={noop}
      />,
    )

    await fireEvent.press(pressable(getByText, '조회불가'))
    await fireEvent.press(getByText('저장'))

    expect(onSave).toHaveBeenCalledWith(['ocid-1'])
  })

  it('조회 불가 캐릭터가 없으면 섹션 자체를 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={[]}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(queryByTestId('unavailable-roster')).toBeNull()
  })
})

// [[ADR-107]]. 웹판은 클래스 문자열을 단언했지만 RN 에서는 그 값들이 **스타일 숫자**로 온다 —
// 그래서 오히려 더 정확히 잰다(안전영역이 실제로 더해졌는지, 클램프가 발동했는지).
describe('CharacterTrackingPicker — 모달 높이·스크롤포트 ([[ADR-107]])', () => {
  const open = {
    entries,
    trackedOcids: [] as string[],
    ...loaded,
    onSave: noop,
    onClose: noop,
  }

  function flatten(style: unknown): Record<string, unknown> {
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten)) as Record<string, unknown>
    if (style !== null && typeof style === 'object') return style as Record<string, unknown>
    return {}
  }

  it('오버레이가 상하 안전영역 + 16px 만큼 비운다 — 모달이 노치·제스처바에 닿지 않는다', async () => {
    const { getByTestId } = await renderOverlay(<CharacterTrackingPicker {...open} />)

    const style = flatten(getByTestId('character-tracking-picker-overlay').props.style)
    expect(style.paddingTop).toBe(59 + 16)
    expect(style.paddingBottom).toBe(34 + 16)
  })

  // 385px 가 들어가는 기기에서는 종전 동작 그대로다.
  it('넉넉한 화면에서는 본문 자리가 3줄 높이(385px)를 그대로 쓴다', async () => {
    const { getByTestId } = await renderOverlay(<CharacterTrackingPicker {...open} />)

    expect(flatten(getByTestId('character-tracking-picker-body').props.style).minHeight).toBe(
      ROSTER_BODY_MIN_H_PX,
    )
  })

  // 결정 2: `min-height` 가 `max-height` 를 이기므로, 짧은 기기에서는 3줄 고정이 양보해야
  // 결정 1 의 카드 상한이 살아남는다.
  it('본문 자리의 3줄 최소 높이는 짧은 뷰포트에서 양보한다', async () => {
    const { getByTestId } = await renderOverlay(<CharacterTrackingPicker {...open} />, {
      frame: { x: 0, y: 0, width: 390, height: 568 },
      insets: { top: 20, left: 0, right: 0, bottom: 0 },
    })

    const minHeight = flatten(getByTestId('character-tracking-picker-body').props.style)
      .minHeight as number
    expect(minHeight).toBeLessThan(ROSTER_BODY_MIN_H_PX)
    expect(minHeight).toBeGreaterThan(0)
  })

  // 결정 3: 스크롤포트가 카드 패딩 **바깥**까지 넓어져 인디케이터가 모달 오른쪽 끝에 온다.
  it('스크롤포트가 카드 오른쪽 패딩을 상쇄하고, 그만큼을 콘텐츠 쪽에서 되돌린다', async () => {
    const { getByTestId } = await renderOverlay(<CharacterTrackingPicker {...open} />)

    const scroll = getByTestId('character-tracking-picker-scroll')
    expect(flatten(scroll.props.style).marginRight).toBe(-24)
    expect(flatten(scroll.props.contentContainerStyle).paddingRight).toBe(24)
  })

  // 배너는 스크롤포트 **밖**이다 — 목록을 굴려도 "최신이 아님"은 계속 보여야 한다.
  it('스탈 배너는 스크롤포트 밖에 남는다', async () => {
    const { getByTestId } = await renderOverlay(
      <CharacterTrackingPicker {...open} loadError={{ kind: 'network' }} />,
    )

    const scroll = getByTestId('character-tracking-picker-scroll')
    let node = getByTestId('stale-banner').parent
    let insideScroll = false
    while (node !== null) {
      if (node === scroll) insideScroll = true
      node = node.parent
    }

    expect(insideScroll).toBe(false)
  })
})

// step 3~4 와 같은 관례의 트리 스냅샷 — *"예전(웹)과 같은가"* 가 아니라 **"앞으로 안 바뀌는가"** 만
// 답한다(웹의 DOM 스냅샷은 [[ADR-094]] 결정 4 였고 RN 에는 그 짝이 없다, `render-atom.tsx`).
describe('트리 스냅샷', () => {
  it('그리드가 있는 기본 상태', async () => {
    const { toJSON } = await renderOverlay(
      <CharacterTrackingPicker
        entries={entries}
        trackedOcids={['ocid-1']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(toJSON()).toMatchSnapshot()
  })

  it('조회 불가 섹션이 있는 상태', async () => {
    const { toJSON } = await renderOverlay(
      <CharacterTrackingPicker
        entries={[
          ...entries,
          { ocid: 'ocid-4', name: '조회불가', level: 200, imageUrl: null, world: '스카니아', unavailable: true },
        ]}
        trackedOcids={['ocid-4']}
        {...loaded}
        onSave={noop}
        onClose={noop}
      />,
    )

    expect(toJSON()).toMatchSnapshot()
  })
})
