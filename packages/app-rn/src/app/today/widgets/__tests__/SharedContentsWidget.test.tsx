// 공유 컨텐츠 위젯([[ADR-146]] 정정 28~31). 이 파일이 지키는 것 넷 —
// ① **계열이 축이다**(월드·계정 라벨이 화면에 한 번도 안 나온다)
// ② **오른쪽 열은 «완료 → CLEAR · 미완료+카운트 → n/max · 그 밖 → 빈칸»**(정정 33)
// ③ **머리의 `?` 가 월드 한계를 말하되 타일 높이를 안 바꾼다**(정정 34)
// ④ **타일을 눌러 가는 곳이 없다**(`target` 이 없는 타일이다)

import { act, fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../../components/__tests__/render-atom'
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

describe('계열이 축이다 ([[ADR-146]] 정정 28)', () => {
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

  // 월드로는 가를 수 없고([[ADR-030]] 결정 6) 계열로 묶은 이유가 그것이다 — 라벨이 한 번이라도
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

describe('오른쪽 열은 `count` 유무 하나로 갈린다 ([[ADR-146]] 정정 29)', () => {
  it('완료했고 카운트가 없으면 CLEAR 배지다 — 「남은 스케줄」과 같은 말이다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('에픽던전', [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('앵글러컴퍼니', { isComplete: true }),
        공유항목('악몽선경'),
      ]),
    ])

    expect(getAllByTestId('shared-clear')).toHaveLength(2)
  })

  it('미완료이고 카운트가 없으면 오른쪽을 비운다 (사용자 지정)', async () => {
    const { queryAllByTestId } = await 위젯([공유계열('에픽던전', [공유항목('악몽선경')])])

    // 「0/1」을 붙이려면 API 에 없는 분모를 앱이 지어내야 한다.
    expect(queryAllByTestId('shared-clear')).toHaveLength(0)
    expect(queryAllByTestId('shared-count')).toHaveLength(0)
  })

  it('카운트가 있으면 분자와 분모를 붙여 그린다 ([[ADR-146]] 정정 7 과 같은 이유)', async () => {
    const { getByText } = await 위젯([
      공유계열('몬스터파크', [공유항목('일간', { count: { now: 7, max: 14 } })]),
    ])

    // 벌어지면 두 값, 붙으면 분수로 읽힌다 — 한 `Text` 안에서 이어져야 «7/14» 로 읽힌다.
    expect(getByText('7/14')).toBeTruthy()
    // 분자만 굵다(강조는 굵기 하나뿐 — 위젯 2 와 같은 규칙).
    expect(String(getByText('7').props.style.fontWeight)).toBe('800')
  })

  // 완료한 항목의 «몇 번 했나» 는 언제나 max 라 `14/14` 가 더 말하는 것이 없다. 「익스트림만
  // 예외」로 적으면 그것이 정정 31 이 카탈로그로 밀어낸 «이름으로 유추하는 규칙» 이 된다.
  it('완료면 카운트가 있어도 CLEAR 다 ([[ADR-146]] 정정 33)', async () => {
    const { queryByTestId, getByTestId } = await 위젯([
      공유계열('몬스터파크', [공유항목('일간', { isComplete: true })]),
    ])

    expect(getByTestId('shared-clear')).toBeTruthy()
    expect(queryByTestId('shared-count')).toBeNull()
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

describe('빈 상태와 이동 ([[ADR-146]] 결정 5)', () => {
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

describe('머리의 `?` — 월드 한계를 말한다 ([[ADR-146]] 정정 34)', () => {
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
