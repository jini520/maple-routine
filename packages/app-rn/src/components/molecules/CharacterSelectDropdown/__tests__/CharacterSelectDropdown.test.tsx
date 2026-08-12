// 웹판은 열 케이스였고, RN 으로 오며 성격이 셋으로 갈렸다(컴포넌트 주석의 "웹뷰 사정 / 제품 결정"
// 구분과 같은 축이다).
//
//   지킨다   크기 두 벌의 치수([[ADR-096]] 결정 5) · chevron 을 직접 그린다 · 선택된 캐릭터 표시
//   사라진다 `<select>`/`<option>` 메커니즘에 붙어 있던 셋(옵션 개수·`combobox` 값·`selectOptions`)
//   미도착   목록(열린 상태)과 그때의 `onSelect` — 무엇으로 그릴지가 디자인 결정이라 step 5 와 함께
//
// 마지막 줄이 이 파일에서 가장 중요한 사실이다. **여기서 초록이라고 캐릭터를 고를 수 있는 것이
// 아니다.**
import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { CharacterSelectDropdown } from '../CharacterSelectDropdown'

const characters = [
  { ocid: 'ocid-1', characterName: '낟낟', world: '엘리시움' },
  { ocid: 'ocid-2', characterName: '내옆에최성일', world: '베라' },
]

describe('CharacterSelectDropdown', () => {
  it('선택된 캐릭터의 이름을 트리거에 그린다', async () => {
    const { getByText, queryByText } = await renderAtom(
      <CharacterSelectDropdown characters={characters} selectedOcid="ocid-2" onSelect={jest.fn()} />,
    )

    expect(getByText('내옆에최성일')).toBeTruthy()
    // 닫힌 상태라 다른 후보는 그리지 않는다 — 웹에서도 `<option>` 은 열어야 보였다.
    expect(queryByText('낟낟')).toBeNull()
  })

  it('선택된 ocid 가 목록에 없으면 이름 자리를 비운다(빈 문자열)', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterSelectDropdown characters={characters} selectedOcid="없는-ocid" onSelect={jest.fn()} />,
    )

    expect(getByTestId('character-select-trigger')).toBeTruthy()
  })

  // [[ADR-096]] 결정 5: 관리 화면은 제목 줄 우측의 작은 자리라, 그 자리에 있던 읽기 전용 칩과 같은
  // 크기감이어야 한다. 스케줄러용 기본 크기를 그대로 넣으면 헤더가 두꺼워진다.
  describe('size 변형', () => {
    it('기본값은 스케줄러용 크기다 — 최소 폭·큰 세로 여백·10px 라운딩', async () => {
      const { getByTestId, getByText } = await renderAtom(
        <CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={jest.fn()} />,
      )

      expect(flattenStyle(getByTestId('character-select-trigger').props.style)).toMatchObject({
        minWidth: 160,
        paddingTop: 12, // py-3
        paddingBottom: 12,
        borderRadius: 10,
        borderColor: 기본테마.border,
        backgroundColor: 기본테마.surface,
      })
      expect(flattenStyle(getByText('낟낟').props.style).fontSize).toBe(14) // text-sm
    })

    it('compact 는 칩과 같은 크기감(pill·text-xs)이고 폭을 강제하지 않는다', async () => {
      const { getByTestId, getByText } = await renderAtom(
        <CharacterSelectDropdown
          characters={characters}
          selectedOcid="ocid-1"
          onSelect={jest.fn()}
          size="compact"
        />,
      )

      const trigger = flattenStyle(getByTestId('character-select-trigger').props.style)
      expect(trigger).toMatchObject({ borderRadius: 9999, paddingTop: 4, paddingBottom: 4 })
      expect(trigger.minWidth).toBeUndefined()
      expect(flattenStyle(getByText('낟낟').props.style).fontSize).toBe(12) // text-xs
    })

    // 웹에서 chevron 을 직접 그린 이유는 UA 화살표를 끄기 위해서였지만(그 결과 두 플랫폼이 같은
    // 모양을 갖게 된 것이 결정으로 남았다), RN 에는 UA 화살표가 없다. 남는 것은 **어포던스**다 —
    // 트리거가 눌리는 물건임을 말하는 유일한 표식이라 크기별로 자리·크기가 정해져 있다.
    it.each([
      ['default' as const, 14, 16],
      ['compact' as const, 10, 12],
    ])('%s 의 chevron 은 정해진 자리·크기에 선다', async (size, right, iconSize) => {
      const { getByTestId } = await renderAtom(
        <CharacterSelectDropdown
          characters={characters}
          selectedOcid="ocid-1"
          onSelect={jest.fn()}
          size={size}
        />,
      )

      const anchor = getByTestId('character-select-chevron')
      expect(flattenStyle(anchor.props.style)).toMatchObject({
        position: 'absolute',
        top: 0,
        bottom: 0,
        right,
        justifyContent: 'center',
      })
      expect(anchor.props.pointerEvents).toBe('none')

      // 아이콘의 색은 lucide 가 `color` 프롭을 `stroke` 로 옮겨 그린다(`lib/nativewind-interop.ts`).
      const [icon] = anchor.children as { props: Record<string, unknown> }[]
      expect(icon.props.width).toBe(iconSize)
      expect(icon.props.stroke).toBe(기본테마.textMuted)
    })
  })

  // 웹의 두 케이스가 [[ADR-129]] 로 되살아났다 — 3단계에서는 에셋이 없어 **모든 월드**가 "엠블럼
  // 없음" 분기였다. 엠블럼과 좌측 패딩은 **짝이어야 한다**(컴포넌트 주석 ③): 하나만 맞으면
  // 패딩만 벌어지고 그림이 없거나, 그림이 글자를 덮는다. 그래서 둘을 한 케이스에서 함께 본다.
  it('엠블럼이 있으면 그리고, 좌측 패딩도 넓은 쪽이다', async () => {
    const { getByTestId } = await renderAtom(
      <CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={jest.fn()} />,
    )

    expect(getByTestId('character-select-emblem')).toBeTruthy()
    expect(flattenStyle(getByTestId('character-select-trigger').props.style).paddingLeft).toBe(32) // pl-8
  })

  // 매핑에 없는 월드는 여전히 생략한다(웹과 같은 폴백) — 그때는 패딩도 좁은 쪽이다.
  it('매핑에 없는 월드는 엠블럼을 생략하고 좌측 패딩이 좁은 쪽이다', async () => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <CharacterSelectDropdown
        characters={[{ ocid: 'ocid-9', characterName: '무월드', world: '없는월드' }]}
        selectedOcid="ocid-9"
        onSelect={jest.fn()}
      />,
    )

    expect(queryByTestId('character-select-emblem')).toBeNull()
    expect(flattenStyle(getByTestId('character-select-trigger').props.style).paddingLeft).toBe(16) // pl-4
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    const asDefault = await renderAtom(
      <CharacterSelectDropdown characters={characters} selectedOcid="ocid-1" onSelect={jest.fn()} />,
    )
    expect(asDefault.toJSON()).toMatchSnapshot()

    const compact = await renderAtom(
      <CharacterSelectDropdown
        characters={characters}
        selectedOcid="ocid-1"
        onSelect={jest.fn()}
        size="compact"
      />,
    )
    expect(compact.toJSON()).toMatchSnapshot()
  })
})
