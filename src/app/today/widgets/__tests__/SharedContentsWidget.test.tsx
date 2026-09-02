// 공유 컨텐츠 위젯(~31). 이 파일이 지키는 것 넷 —
// ① **계열이 축이다**(월드·계정 라벨이 화면에 한 번도 안 나온다)
// ② **오른쪽 열은 «카운트 있음 → n/max · 그 밖 → 빈칸»**(— CLEAR 는 걷었다)
// ③ **머리의 `?` 가 월드 한계를 말하되 타일 높이를 안 바꾼다**(정정 34)
// ④ **타일을 눌러 가는 곳이 없다**(`target` 이 없는 타일이다)
// ⑤ **계열이 두 열로 선다**(— 순서를 지키면서 높이가 가장 고른 지점에서 가른다)
// ⑥ **완료는 읽기 전용 체크박스 + 취소선이 말한다**

import { act, fireEvent, within } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../../components/__tests__/render-atom'
import { SharedContentsWidget } from '../SharedContentsWidget'
import { 공유계열, 공유항목, 공유컨텐츠, 뷰모델 } from './widget-fixture'
import type { SharedContentGroupView } from '../../view-model'

async function 위젯(
  sharedContents: SharedContentGroupView[],
  sharedRemaining = sharedContents
    .flatMap((group) => group.items)
    .filter((item) => !item.isComplete).length,
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(
    <SharedContentsWidget w={4} h="auto" data={뷰모델({ sharedContents, sharedRemaining })} />,
  )
}

/** RN 의 상태 갱신은 `act` 안에서 흘려야 다음 렌더가 보인다(위젯 2 의 아코디언 테스트와 같다). */
async function 누름(element: Parameters<typeof fireEvent.press>[0]): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

describe('계열이 축이다', () => {
  it('계열명을 머리로 세우고 그 아래에 짧은 이름을 그린다', async () => {
    const { getAllByTestId, getByText } = await 위젯(공유컨텐츠())

    expect(getAllByTestId('shared-group-name').map((node) => node.props.children)).toEqual([
      '에픽던전',
      '몬스터파크',
      '메이플 유니온',
    ])
    expect(getByText('하이마운틴')).toBeTruthy()
    expect(getByText('익스트림 몬스터파커')).toBeTruthy()
  })

  // 월드로는 가를 수 없고 계열로 묶은 이유가 그것이다 — 라벨이 한 번이라도
  // 나오면 화면이 다시 그 축을 주장하게 된다.
  it('월드·계정이라는 말이 화면에 한 번도 안 나온다', async () => {
    const { queryByText } = await 위젯(공유컨텐츠())

    expect(queryByText(/월드/)).toBeNull()
    expect(queryByText(/스카니아/)).toBeNull()
  })

  it('머리에 남은 줄 수를 단다 — 캐릭터 수와 무관하다', async () => {
    const { getByTestId } = await 위젯(공유컨텐츠())

    // 악몽선경 · 일간 · 익스트림 · PC방
    expect(getByTestId('shared-total').props.children).toBe(4)
  })
})

describe('오른쪽 열은 `count` 유무 하나로 갈린다', () => {
  // 체크박스와 취소선이 이미 완료를 말한다 — 배지는 같은 말의 세 번째였고, 그 46px 이 반폭 열에서
  // 긴 이름을 말줄임으로 밀어냈다(사용자 지시).
  it('완료해도 오른쪽에 배지가 안 선다 — CLEAR 를 걷었다', async () => {
    const { queryAllByTestId, queryByText } = await 위젯([
      공유계열('에픽던전', [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('앵글러컴퍼니', { isComplete: true }),
        공유항목('악몽선경'),
      ]),
    ])

    expect(queryAllByTestId('shared-clear')).toHaveLength(0)
    expect(queryByText('CLEAR')).toBeNull()
    expect(queryAllByTestId('shared-count')).toHaveLength(0)
  })

  it('미완료이고 카운트가 없으면 오른쪽을 비운다 (사용자 지정)', async () => {
    const { queryAllByTestId } = await 위젯([공유계열('에픽던전', [공유항목('악몽선경')])])

    // 「0/1」을 붙이려면 API 에 없는 분모를 앱이 지어내야 한다.
    expect(queryAllByTestId('shared-count')).toHaveLength(0)
  })

  it('카운트가 있으면 분자와 분모를 붙여 그린다 ( 과 같은 이유)', async () => {
    const { getByText } = await 위젯([
      공유계열('몬스터파크', [공유항목('일간', { count: { now: 7, max: 14 } })]),
    ])

    // 벌어지면 두 값, 붙으면 분수로 읽힌다 — 한 `Text` 안에서 이어져야 «7/14» 로 읽힌다.
    expect(getByText('7/14')).toBeTruthy()
    // 분자만 굵다(강조는 굵기 하나뿐 — 위젯 2 와 같은 규칙).
    expect(String(getByText('7').props.style.fontWeight)).toBe('800')
  })

  // 뷰모델이 완료한 항목에 카운트를 안 준다(의 살아 있는 절반) — 완료한 항목의
  // «몇 번 했나» 는 언제나 max 라 `14/14` 가 더 말하는 것이 없다.
  it('완료한 항목은 오른쪽이 통째로 빈다 — 체크박스가 그 말을 한다', async () => {
    const { queryByTestId, getAllByTestId } = await 위젯([
      공유계열('몬스터파크', [공유항목('일간', { isComplete: true })]),
    ])

    expect(queryByTestId('shared-count')).toBeNull()
    expect(
      flattenStyle(getAllByTestId('shared-checkbox', { includeHiddenElements: true })[0]?.props.style)
        .backgroundColor,
    ).toBe(기본테마.primary)
  })

  it('숫자에 `tabular-nums` 가 걸린다 — 자릿수가 달라도 오른쪽 끝이 안 흔들린다', async () => {
    const { getByText } = await 위젯([
      공유계열('몬스터파크', [
        공유항목('일간', { count: { now: 7, max: 14 } }),
        공유항목('익스트림 몬스터파커', { count: { now: 1, max: 2 } }),
      ]),
    ])

    expect(getByText('7').props.style).toEqual(
      expect.objectContaining({ fontVariant: ['tabular-nums'] }),
    )
  })
})

describe('두 열로 선다', () => {
  const 열이름 = (열: ReturnType<typeof within>): unknown[] =>
    열.queryAllByTestId('shared-group-name').map((node) => node.props.children)

  // 지그재그(홀짝)로 나누면 왼쪽이 «에픽던전 + 유니온»(7줄)이 되어 타일이 한 줄 더 높다.
  it('계열 셋을 순서를 지키며 가른다 — 높이가 가장 고른 지점에서', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠())

    const 열들 = getAllByTestId('shared-column')
    expect(열들).toHaveLength(2)
    expect(열이름(within(열들[0] as never))).toEqual(['에픽던전'])
    expect(열이름(within(열들[1] as never))).toEqual(['몬스터파크', '메이플 유니온'])
  })

  it('계열이 둘이면 한 열에 하나씩이다', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠().slice(0, 2))

    const 열들 = getAllByTestId('shared-column')
    expect(열이름(within(열들[0] as never))).toEqual(['에픽던전'])
    expect(열이름(within(열들[1] as never))).toEqual(['몬스터파크'])
  })

  it('계열이 하나뿐이면 한 열로 그린다 — 반폭만 쓰면 그 자체가 여백이다', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠().slice(0, 1))

    expect(getAllByTestId('shared-column')).toHaveLength(1)
  })
})

describe('완료는 체크와 취소선이 말한다', () => {
  // 체크박스는 **접근성 트리에서 숨겨져 있다**(`aria-hidden`) — 뜻은 이름과 `CLEAR` 가 이미
  // 말하고 이것은 그 말의 그림이라, 스크린 리더가 한 번 더 읽을 이유가 없다. 그래서 테스트도
  // 숨은 것을 포함해 찾는다.
  const 숨은것포함 = { includeHiddenElements: true } as const

  it('항목마다 체크박스가 서고 완료한 것만 채워진다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('에픽던전', [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('악몽선경'),
      ]),
    ])

    const 상자들 = getAllByTestId('shared-checkbox', 숨은것포함)
    expect(상자들).toHaveLength(2)
    expect(flattenStyle(상자들[0]?.props.style).backgroundColor).toBe(기본테마.primary)
    expect(flattenStyle(상자들[1]?.props.style).backgroundColor).toBeUndefined()
    // 체크 표시는 완료한 것 하나뿐이다 — 빈 상자는 테두리만 지고 안이 비어 있다.
    expect(상자들[0]?.props.children).toBeTruthy()
    expect(상자들[1]?.props.children).toBeFalsy()
  })

  // **채운 상자는 언제나 `primary` 다**(사용자 판정 — *"테마 색이랑 관련 없는
  // 색이 들어가 있어"*). 「완료 = `secondary`」 계보를 따랐더니 `secondary` 가 테마의 두 번째
  // 시드라 메인 컬러와 색상이 무관했다(렌은 빨강 테마에 틸 `#437B71`, 엔젤릭버스터는 분홍 테마에
  // 하늘 `#82B5C3`). 앱의 다른 체크박스 셋(설정·가계부·테마 선택)이 쓰는 색으로 되돌린다.
  // 체크 표시(`shared-checkbox-mark`)의 색은 여기서 못 잰다 — SVG 는 `testID` 를 호스트 노드로
  // 안 넘긴다(렌더 트리에 `RNSVGSvgView` 만 남는다). 상자의 두 값이 같은 토큰을 가리키는 것으로
  // 「secondary 로 되돌아가지 않았다」를 잡는다.
  it('채운 상자는 채움도 테두리도 primary 다 — secondary 가 아니다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('에픽던전', [공유항목('하이마운틴', { isComplete: true })]),
    ])

    const 상자 = flattenStyle(getAllByTestId('shared-checkbox', 숨은것포함)[0]?.props.style)
    expect(상자.backgroundColor).toBe(기본테마.primary)
    expect(상자.borderColor).toBe(기본테마.primary)
    expect(상자.backgroundColor).not.toBe(기본테마.secondaryInk)
  })

  // 취소선만으로는 «지운 것/흐린 것» 이 애매하고, 색만으로는 흑백 화면에서 안 보인다.
  it('완료한 이름에 취소선과 흐린 색이 **함께** 걸린다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('에픽던전', [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('악몽선경'),
      ]),
    ])

    const [완료, 미완료] = getAllByTestId('shared-item-name')
    expect(flattenStyle(완료?.props.style).textDecorationLine).toBe('line-through')
    expect(flattenStyle(완료?.props.style).color).toBe(기본테마.textDisabled)
    expect(flattenStyle(미완료?.props.style).textDecorationLine).toBeUndefined()
    expect(flattenStyle(미완료?.props.style).color).toBe(기본테마.text)
  })

  // 게임에서 오는 값이라 앱이 못 뒤집는다 — 못 뒤집는 것을 누를 수 있게 두면 무반응이 «고장» 이다.
  it('체크박스는 누를 수 없다 — 읽기 전용이다', async () => {
    const { getAllByTestId, queryAllByRole } = await 위젯(공유컨텐츠())

    for (const 상자 of getAllByTestId('shared-checkbox', 숨은것포함)) {
      expect(상자.props.accessibilityRole).toBeUndefined()
      expect(상자.props.onClick).toBeUndefined()
    }
    // 누를 수 있는 것은 여전히 머리의 `?` 하나뿐이다.
    expect(queryAllByRole('button')).toHaveLength(1)
  })
})

describe('빈 상태와 이동', () => {
  it('계열이 하나도 없어도 타일은 선다 — 위젯은 사라지지 않는다', async () => {
    const { getByTestId, queryAllByTestId } = await 위젯([], 0)

    expect(getByTestId('widget-shared-contents')).toBeTruthy()
    expect(queryAllByTestId('shared-group-name')).toHaveLength(0)
  })

  // 타일 자체에는 `target` 이 없다(레지스트리) — 여기서 누를 수 있는 것은 **설명 토글 하나뿐**이고
  // 그것은 화면을 옮기지 않는다. 계열 머리도 항목 줄도 누를 수 없다(위젯 2 의 아코디언과 다르다).
  it('누를 수 있는 것은 설명 토글 하나뿐이다 — 가는 곳은 없다', async () => {
    const { queryAllByRole, getByTestId } = await 위젯(공유컨텐츠())

    const 누름자리 = queryAllByRole('button')
    expect(누름자리).toHaveLength(1)
    expect(누름자리[0]?.props.testID).toBe('shared-note-toggle')

    // 말풍선을 열면 그것도 누를 수 있다 — 닫는 자리라서다.
    await 누름(getByTestId('shared-note-toggle'))
    expect(queryAllByRole('button').map((node) => node.props.testID)).toEqual([
      'shared-note-toggle',
      'shared-note',
    ])
  })
})

describe('머리의 `?` — 월드 한계를 말한다', () => {
  const 문장 = '계정 및 메이플 ID 공유 컨텐츠는 가장 마지막에 접속한 월드 기준으로 표시됩니다.'

  it('평소에는 안 보인다 — 늘 떠 있는 각주는 격자에서 잡음이다', async () => {
    const { queryByTestId, queryByText } = await 위젯(공유컨텐츠())

    expect(queryByTestId('shared-note')).toBeNull()
    expect(queryByText(문장)).toBeNull()
  })

  it('`?` 를 누르면 한 문장이 뜬다', async () => {
    const { getByTestId, getByText } = await 위젯(공유컨텐츠())

    await 누름(getByTestId('shared-note-toggle'))

    expect(getByText(문장)).toBeTruthy()
  })

  it('같은 `?` 를 다시 눌러도, 말풍선을 눌러도 닫힌다', async () => {
    const { getByTestId, queryByTestId } = await 위젯(공유컨텐츠())

    await 누름(getByTestId('shared-note-toggle'))
    await 누름(getByTestId('shared-note-toggle'))
    expect(queryByTestId('shared-note')).toBeNull()

    await 누름(getByTestId('shared-note-toggle'))
    await 누름(getByTestId('shared-note'))
    expect(queryByTestId('shared-note')).toBeNull()
  })

  // 인라인으로 펼치면 `h: 'auto'` 가 다시 재서 **아래 타일이 전부 밀린다**(정정 27 이 아코디언에서
  // 겪은 자리). 절대 배치라 흐름에서 빠지고, 카드 «안» 이라 잘릴 자리도 없다.
  it('말풍선은 절대 배치라 타일 높이를 안 바꾼다', async () => {
    const { getByTestId } = await 위젯(공유컨텐츠())

    await 누름(getByTestId('shared-note-toggle'))

    expect(flattenStyle(getByTestId('shared-note').props.style)).toMatchObject({
      position: 'absolute',
    })
  })
})
