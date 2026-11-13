// 공유 컨텐츠 위젯(~31). 이 파일이 지키는 것 넷.
// ① **계열이 축이다**(월드·계정 라벨이 화면에 한 번도 안 나온다)
// ② **오른쪽 열은 카운트 있음 → n/max· 그 밖 → 빈칸**(CLEAR 는 걷었다. 머리의 수도 걷었다)
// ④ **타일을 눌러 가는 곳이 없다**(`target` 이 없는 타일이다)
// ⑤ **계열이 두 열로 선다**(순서를 지키면서 높이가 가장 고른 지점에서 가른다)
// ⑥ **완료는 읽기 전용 체크박스 + 취소선이 말한다**

import { within } from '@testing-library/react-native'

import { flattenStyle, renderOverlay, 기본테마 } from '../../../../components/__tests__/render-atom'
import { withAlpha } from '../../../../lib/color'
import { SharedContentsWidget } from '../SharedContentsWidget'
import { 공유계열, 공유항목, 공유컨텐츠, 뷰모델 } from './widget-fixture'
import type { SharedContentGroupView } from '../../view-model'

async function 위젯(
  sharedContents: SharedContentGroupView[],
): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<SharedContentsWidget data={뷰모델({ sharedContents })} />)
}

describe('계열이 축이다', () => {
  // 월드로는 가를 수 없고 계열로 묶은 이유가 그것이다. 라벨이 한 번이라도
  // 나오면 화면이 다시 그 축을 주장하게 된다.
  it('월드·계정이라는 말이 화면에 한 번도 안 나온다', async () => {
    const { queryByText } = await 위젯(공유컨텐츠())

    expect(queryByText(/월드/)).toBeNull()
    expect(queryByText(/스카니아/)).toBeNull()
  })
})

describe('오른쪽 열은 `count` 유무 하나로 갈린다', () => {
  it('미완료이고 카운트가 없으면 오른쪽을 비운다 (사용자 지정)', async () => {
    const { queryAllByTestId } = await 위젯([공유계열('epic_dungeon', [공유항목('악몽선경')])])

    // `0/1`을 붙이려면 API 에 없는 분모를 앱이 지어내야 한다.
    expect(queryAllByTestId('shared-count')).toHaveLength(0)
  })

  it('카운트가 있으면 분자와 분모를 붙여 그린다 ( 과 같은 이유)', async () => {
    const { getByText } = await 위젯([
      공유계열('monster_park', [공유항목('일간', { count: { now: 7, max: 14 } })]),
    ])

    // 벌어지면 두 값, 붙으면 분수로 읽힌다. 한 `Text` 안에서 이어져야 **7/14** 로 읽힌다.
    expect(getByText('7/14')).toBeTruthy()
    // 분자만 굵다(강조는 굵기 하나뿐. 위젯 2 와 같은 규칙).
    expect(String(getByText('7').props.style.fontWeight)).toBe('700')
  })

  // 뷰모델이 완료한 항목에 카운트를 안 준다. 완료한 항목의
  // **몇 번 했나** 는 언제나 max 라 `14/14` 가 더 말하는 것이 없다.
  it('완료한 항목은 오른쪽이 통째로 빈다. 체크박스가 그 말을 한다', async () => {
    const { queryByTestId, getAllByTestId } = await 위젯([
      공유계열('monster_park', [공유항목('일간', { isComplete: true })]),
    ])

    expect(queryByTestId('shared-count')).toBeNull()
    expect(
      flattenStyle(getAllByTestId('checkbox-box', { includeHiddenElements: true })[0]?.props.style)
        .backgroundColor,
    ).toBe(기본테마.primary)
  })

  it('숫자에 `tabular-nums` 가 걸린다. 자릿수가 달라도 오른쪽 끝이 안 흔들린다', async () => {
    const { getByText } = await 위젯([
      공유계열('monster_park', [
        공유항목('일간', { count: { now: 7, max: 14 } }),
        공유항목('익스트림 몬스터파커', { count: { now: 1, max: 5 } }),
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

  // 6 대 4 로 가른다. 지그재그(홀짝)로 나누면 왼쪽이 **몬스터파크 + 에픽 던전**(7줄)이 되어
  // 타일이 한 줄 더 높다.
  it('계열 셋을 순서를 지키며 가른다. 높이가 가장 고른 지점에서', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠())

    const 열들 = getAllByTestId('shared-column')
    expect(열들).toHaveLength(2)
    expect(열이름(within(열들[0] as never))).toEqual(['몬스터파크', '메이플 유니온'])
    expect(열이름(within(열들[1] as never))).toEqual(['에픽 던전'])
  })

  it('계열이 둘이면 한 열에 하나씩이다', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠().slice(0, 2))

    const 열들 = getAllByTestId('shared-column')
    expect(열이름(within(열들[0] as never))).toEqual(['몬스터파크'])
    expect(열이름(within(열들[1] as never))).toEqual(['메이플 유니온'])
  })

  it('계열이 하나뿐이면 한 열로 그린다. 반폭만 쓰면 그 자체가 여백이다', async () => {
    const { getAllByTestId } = await 위젯(공유컨텐츠().slice(0, 1))

    expect(getAllByTestId('shared-column')).toHaveLength(1)
  })
})

describe('완료는 체크와 취소선이 말한다', () => {
  // 체크박스는 **접근성 트리에서 숨겨져 있다**(`aria-hidden`). 뜻은 이름과 `CLEAR` 가 이미
  // 말하고 이것은 그 말의 그림이라, 스크린 리더가 한 번 더 읽을 이유가 없다. 그래서 테스트도
  // 숨은 것을 포함해 찾는다.
  const 숨은것포함 = { includeHiddenElements: true } as const

  it('항목마다 공용 체크박스의 `sm` 상자가 서고 완료한 것만 채워진다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('epic_dungeon', [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('악몽선경'),
      ]),
    ])

    const 상자들 = getAllByTestId('checkbox-box', 숨은것포함)
    expect(상자들).toHaveLength(2)
    expect(flattenStyle(상자들[0]?.props.style).width).toBe(14)
    expect(flattenStyle(상자들[0]?.props.style).backgroundColor).toBe(기본테마.primary)
    expect(flattenStyle(상자들[1]?.props.style).backgroundColor).toBe(withAlpha(기본테마.text, 0.14))
    // 체크 표시는 완료한 것 하나뿐이다. 빈 상자는 반투명으로 채워지고 안이 비어 있다.
    expect(상자들[0]?.props.children).toBeTruthy()
    expect(상자들[1]?.props.children).toBeFalsy()
  })

  // 취소선만으로는 **지운 것/흐린 것** 이 애매하고, 색만으로는 흑백 화면에서 안 보인다.
  it('완료한 이름에 취소선과 흐린 색이 **함께** 걸린다', async () => {
    const { getAllByTestId } = await 위젯([
      공유계열('epic_dungeon', [
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

  // 게임에서 오는 값이라 앱이 못 뒤집는다. 못 뒤집는 것을 누를 수 있게 두면 무반응이 **고장** 이다.
  it('체크박스는 누를 수 없다. 읽기 전용이다', async () => {
    const { getAllByTestId, queryAllByRole } = await 위젯(공유컨텐츠())

    for (const 상자 of getAllByTestId('shared-checkbox', 숨은것포함)) {
      expect(상자.props.accessibilityRole).toBeUndefined()
      expect(상자.props.onClick).toBeUndefined()
    }
    expect(queryAllByRole('button')).toHaveLength(0)
  })
})

// 에픽 던전 주 3회 한도. 계열 제목 줄 오른쪽 끝에 줄 카운트와 같은 모양으로 n/3 이 서고, 한도 때문에
// 막힌 줄은 체크 없이 취소선만 긋는다.
describe('계열의 주간 한도', () => {
  const 숨은것포함 = { includeHiddenElements: true } as const
  const 한도참 = (): SharedContentGroupView[] => [
    공유계열(
      'epic_dungeon',
      [
        공유항목('하이마운틴', { isComplete: true }),
        공유항목('앵글러컴퍼니', { isComplete: true }),
        공유항목('악몽선경', { isWeeklyLimitClosed: true }),
        공유항목('아우룸레기스', { isComplete: true }),
      ],
      { now: 3, max: 3 },
    ),
  ]

  it('계열 제목 줄에 n/3 이 줄 카운트와 같은 모양으로 선다', async () => {
    const { getByTestId } = await 위젯(한도참())

    const 수 = getByTestId('shared-group-count')
    expect(수).toHaveTextContent('3/3')
    // 제목과 같은 줄의 오른쪽 끝이다. 제목과 수를 함께 품는 가로 줄이 양 끝으로 벌린다.
    const 줄 = getByTestId('shared-group-name').parent
    expect(수.parent).toBe(줄)
    expect(flattenStyle(줄?.props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'space-between' })
  })

  it('수의 모양은 줄의 n/max 와 같다', async () => {
    const { getByTestId } = await 위젯([
      공유계열('epic_dungeon', [공유항목('악몽선경', { count: { now: 1, max: 5 } })], { now: 2, max: 3 }),
    ])

    expect(flattenStyle(getByTestId('shared-group-count').props.style)).toEqual(
      flattenStyle(getByTestId('shared-count').props.style),
    )
  })

  it('한도가 없는 계열은 수를 안 단다', async () => {
    const { queryByTestId } = await 위젯([공유계열('monster_park', [공유항목('일간')])])

    expect(queryByTestId('shared-group-count')).toBeNull()
  })

  it('막힌 줄은 체크 없이 취소선과 흐린 색이 걸린다', async () => {
    const { getAllByTestId } = await 위젯(한도참())

    const 이름들 = getAllByTestId('shared-item-name')
    const 상자들 = getAllByTestId('checkbox-box', 숨은것포함)
    expect(flattenStyle(이름들[2]?.props.style).textDecorationLine).toBe('line-through')
    expect(flattenStyle(이름들[2]?.props.style).color).toBe(기본테마.textDisabled)
    expect(상자들[2]?.props.children).toBeFalsy()
    expect(상자들[0]?.props.children).toBeTruthy()
  })
})

describe('빈 상태와 이동', () => {
  it('계열이 하나도 없어도 타일은 선다. 위젯은 사라지지 않는다', async () => {
    const { getByTestId, queryAllByTestId } = await 위젯([])

    expect(getByTestId('widget-shared-contents')).toBeTruthy()
    expect(queryAllByTestId('shared-group-name')).toHaveLength(0)
  })

  // 타일 자체에는 `target` 이 없다(레지스트리). 계열 머리도 항목 줄도 누를 수 없다(위젯 2 의 아코디언과
  // 다르다). 표시 기준 설명은 today FAQ 로 옮겼다.
  it('누를 수 있는 것이 없다', async () => {
    const { queryAllByRole } = await 위젯(공유컨텐츠())

    expect(queryAllByRole('button')).toHaveLength(0)
  })
})

// 에픽 던전 · 메이플 유니온의 한도는 메이플 ID 마다 따로라, 메이플 ID 마다 따로 보이고 위젯 드롭다운 버튼으로 고른다.
describe('메이플 ID 드롭다운 버튼', () => {
  const 둘 = [
    { accountId: 'da9b2f21-main', name: '메이플ID-da9b2f21' },
    { accountId: '4f1c08ab-sub', name: '메이플ID-4f1c08ab' },
  ]

  it('고를 메이플 ID 가 둘 이상이면 제목 줄에 버튼이 서고 고른 메이플 ID 의 이름을 보인다', async () => {
    const { getByTestId } = await renderOverlay(
      <SharedContentsWidget
        data={뷰모델({ sharedContents: 공유컨텐츠(), sharedMapleIds: 둘, selectedSharedMapleId: '4f1c08ab-sub' })}
      />,
    )

    expect(getByTestId('shared-maple-id-select-trigger')).toHaveTextContent('메이플ID-4f1c08ab')
  })

  // 지금 위젯과 같다. 고를 것이 하나면 버튼은 아무것도 고르지 않는다.
  it('고를 메이플 ID 가 하나면 버튼을 그리지 않는다', async () => {
    const { queryByTestId } = await renderOverlay(
      <SharedContentsWidget
        data={뷰모델({ sharedContents: 공유컨텐츠(), sharedMapleIds: [둘[0]], selectedSharedMapleId: 'da9b2f21-main' })}
      />,
    )

    expect(queryByTestId('shared-maple-id-select-trigger')).toBeNull()
  })
})
