// 남은 스케줄 위젯 — **주기 탭**이다. 이 파일이 지키는 것 다섯 —
// ① **탭이 목록의 전부를 정한다**(그 주기의 수치만 · 펼침도 그 주기만)
// ② **수치는 N개이고 강조는 굵기 하나뿐**(테마 색 금지 — 칠하면 강조가 캐릭터 수만큼 반복된다)
// ③ **0 은 언제나 `CLEAR`** — `완료했다`가 아니라 **이 주기에 지금 할 게 없다** 라, 대상이 애초에
//    없던 캐릭터도 같은 배지다(그래서 분모를 안 센다)
// ④ **목록은 캐릭터 전부** — 완료해도 안 빠지고, 순서는 **보고 있는 주기**가 정한다(정정 1)
// ⑤ **합계를 안 그린다** — 제목 줄은 이름과 세그먼트 둘뿐이다
//
// jsdom 도 jest 도 레이아웃을 계산하지 않으므로 **픽셀** 로는 못 묻는다. 그래서 **치수를 정하는
// 구조**(숫자 칸의 바닥 폭 · `tabular-nums`)를 계약으로 적는다.

import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom, flattenStyle, 기본테마 } from '../../../../components/__tests__/render-atom'
import { RemainingScheduleWidget } from '../RemainingScheduleWidget'
import { 뷰모델, 스케줄목록, 스케줄행, 빈_뷰모델 } from './widget-fixture'
import type { ScheduleRowView } from '../../view-model'

type 위젯화면 = Awaited<ReturnType<typeof renderAtom>>

async function 위젯(schedule: ScheduleRowView[]): Promise<위젯화면> {
  return renderAtom(<RemainingScheduleWidget w={4} h="auto" data={뷰모델({ schedule })} />)
}

/** 세그먼트는 `aria-label` 로 잡는다 — 글자를 누르면 눌리는 것이 `Pressable` 인지가 안 보인다. */
async function 탭(view: 위젯화면, 주기: '일간' | '주간' | '월간'): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByLabelText(주기))
  })
}

async function 펼치기(view: 위젯화면, 번째 = 0): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getAllByTestId('schedule-toggle')[번째] as never)
  })
}

describe('주기 탭', () => {
  it('제목 줄에 세그먼트 셋이 서고 **합계는 없다**', async () => {
    // 행 하나가 10(4+3+2+1)이라 둘이면 옛 합계는 20 이었다.
    const view = await 위젯(스케줄목록(2))

    expect(view.getByText('남은 스케줄')).toBeTruthy()
    expect(view.getByLabelText('일간')).toBeTruthy()
    expect(view.getByLabelText('주간')).toBeTruthy()
    expect(view.getByLabelText('월간')).toBeTruthy()
    expect(view.queryByText('20')).toBeNull()
  })

  it('기본은 일간이다 — 일퀘 수만 서고 다른 주기의 수치는 안 보인다', async () => {
    const view = await 위젯([스케줄행()])

    expect(view.getByLabelText('일간').props.accessibilityState?.selected).toBe(true)
    expect(view.getByText('퀘스트')).toBeTruthy()
    expect(view.getByText('4')).toBeTruthy()
    // 일간엔 보스 갈래가 없다 — 주간 보스 2 도 검마 1 도 이 탭의 값이 아니다.
    expect(view.queryByText('보스')).toBeNull()
    expect(view.queryByText('3')).toBeNull()
  })

  it('주간 탭만 갈래가 둘이다 — 퀘스트와 보스가 나란히 선다', async () => {
    const view = await 위젯([스케줄행()])

    await 탭(view, '주간')

    expect(view.getByText('퀘스트')).toBeTruthy()
    expect(view.getByText('3')).toBeTruthy()
    expect(view.getByText('보스')).toBeTruthy()
    expect(view.getByText('2')).toBeTruthy()
    expect(view.getAllByText('개')).toHaveLength(2)
  })

  it('주간 탭에서 값이 0 인 갈래는 그 행에서 빠진다', async () => {
    const view = await 위젯([스케줄행({ weeklyBosses: [] })])

    await 탭(view, '주간')

    expect(view.getByText('퀘스트')).toBeTruthy()
    expect(view.queryByText('보스')).toBeNull()
  })

  // 라벨은 **어느 탭에서나** 붙는다(사용자 지정) — 값이 있는 갈래가 자기 이름과 함께 선다.
  it('월간 탭은 `보스 N개`다 — `검마`라는 낱말은 안 쓴다', async () => {
    const view = await 위젯([스케줄행()])

    await 탭(view, '월간')

    expect(view.getByText('보스')).toBeTruthy()
    expect(view.getByText('1')).toBeTruthy()
    expect(view.queryByText('검마')).toBeNull()
    expect(view.queryByText('퀘스트')).toBeNull()
  })
})

describe('수치는 `갈래 N개`다', () => {
  it('탭마다 다른 모양이 없다 — 값이 있는 갈래가 자기 이름과 함께 선다', async () => {
    const view = await 위젯([스케줄행()])

    expect(view.getAllByText('퀘스트')).toHaveLength(1)

    await 탭(view, '주간')

    expect(view.getAllByText('퀘스트')).toHaveLength(1)
    expect(view.getAllByText('보스')).toHaveLength(1)

    await 탭(view, '월간')

    expect(view.getAllByText('보스')).toHaveLength(1)
    expect(view.queryByText('퀘스트')).toBeNull()
  })

  it('숫자 뒤에 `개`가 붙고, 굵은 것은 숫자뿐이다', async () => {
    const view = await 위젯([스케줄행()])

    const 숫자 = flattenStyle(view.getByText('4').props.style)
    const 단위 = flattenStyle(view.getByText('개').props.style)

    expect(숫자.fontSize).toBe(단위.fontSize)
    expect(String(숫자.fontWeight)).toBe('800')
    expect(숫자.fontWeight).not.toBe(단위.fontWeight)
  })

  // 숫자를 `primary-ink` 로 칠하면 이 타일 하나에 강조색이 **캐릭터 수만큼** 반복된다
  // (— 세그먼트는 머리글에 하나뿐이라 그 규칙에 안 걸린다).
  it('숫자 색은 닉네임과 같은 `text` 이고 `개`는 `text-muted` 다 — 테마 강조색이 아니다', async () => {
    const view = await 위젯([스케줄행()])

    expect(flattenStyle(view.getByText('4').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(view.getByText('야간비행').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(view.getByText('개').props.style).color).toBe(기본테마.textMuted)
    expect(flattenStyle(view.getByText('4').props.style).color).not.toBe(기본테마.primaryInk)
  })

  it('숫자에 `tabular-nums` 와 **바닥 폭**이 걸린다 — 천장은 없다', async () => {
    const view = await 위젯([스케줄행()])

    const 숫자 = flattenStyle(view.getByText('4').props.style)
    expect(숫자.fontVariant).toEqual(['tabular-nums'])
    expect(숫자.minWidth).toBe(14)
    expect(숫자.width).toBeUndefined()
  })
})

describe('0 은 언제나 CLEAR', () => {
  it('그 탭이 0 이면 수치 자리에 `CLEAR` 가 선다', async () => {
    const view = await 위젯([스케줄행({ dailyNames: [] })])

    expect(view.getByTestId('schedule-clear')).toBeTruthy()
    expect(view.queryByTestId('schedule-stats')).toBeNull()
  })

  it('CLEAR 는 **그 탭의 말**이다 — 다른 주기에 남아 있어도 상관없다', async () => {
    const view = await 위젯([스케줄행({ dailyNames: [] })])

    expect(view.getByTestId('schedule-clear')).toBeTruthy()

    await 탭(view, '주간')

    expect(view.queryByTestId('schedule-clear')).toBeNull()
    expect(view.getByTestId('schedule-stats')).toBeTruthy()
  })

  // 레벨 미달로 대상이 아닌 보스도 여기서는 0 이다. **가르지 않는다**(사용자 확정) —
  // 그래서 이 배지의 뜻이 `완료했다`가 아니라 **이 주기에 지금 할 게 없다** 로 정해졌다.
  it('대상이 애초에 없던 캐릭터도 같은 배지를 받는다', async () => {
    const view = await 위젯([스케줄행({ monthlyBosses: [] })])

    await 탭(view, '월간')

    expect(view.getByTestId('schedule-clear')).toBeTruthy()
  })

  it('동기화 실패는 어느 탭에서나 그 사실을 말한다 — CLEAR 가 아니다', async () => {
    const view = await 위젯([스케줄행({ hasSyncIssue: true })])

    expect(view.getByTestId('schedule-issue')).toBeTruthy()
    expect(view.queryByTestId('schedule-clear')).toBeNull()

    await 탭(view, '월간')

    expect(view.getByTestId('schedule-issue')).toBeTruthy()
    expect(view.queryByTestId('schedule-clear')).toBeNull()
  })
})

describe('목록은 캐릭터 전부다', () => {
  it('그 탭을 끝낸 캐릭터도 목록에 남는다 — 사람 수가 늘 같다', async () => {
    const [첫, 둘, 셋] = 스케줄목록(3)
    const view = await 위젯([
      첫 as ScheduleRowView,
      { ...(둘 as ScheduleRowView), dailyNames: [] },
      { ...(셋 as ScheduleRowView), dailyNames: [] },
    ])

    expect(view.getAllByTestId('schedule-row')).toHaveLength(3)
    expect(view.getAllByText('CLEAR')).toHaveLength(2)
  })

  // 순서는 **보고 있는 주기**가 정한다(정정 1, 사용자 지정) — 뷰모델은 관리 순서까지만 세워 준다.
  it('그 주기에 남은 개수 많은 순으로 선다 — 탭을 바꾸면 다시 선다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: 'a', characterName: '가', dailyNames: ['하나'], weeklyNames: ['하나', '둘', '셋'] }),
      스케줄행({ ocid: 'b', characterName: '나', dailyNames: ['하나', '둘', '셋'], weeklyNames: [] }),
      스케줄행({ ocid: 'c', characterName: '다', dailyNames: ['하나', '둘'], weeklyNames: ['하나'] }),
    ])

    const 이름들 = (): unknown[] =>
      view.getAllByTestId('schedule-name').map((name) => name.props.children)

    expect(이름들()).toEqual(['나', '다', '가'])

    await 탭(view, '주간')

    expect(이름들()).toEqual(['가', '다', '나'])
  })

  it('동수면 캐릭터 관리 순서다 — 뷰모델이 준 차례가 곧 그 기준이다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: 'c', characterName: '다', dailyNames: ['하나', '둘'] }),
      스케줄행({ ocid: 'a', characterName: '가', dailyNames: ['하나', '둘'] }),
      스케줄행({ ocid: 'b', characterName: '나', dailyNames: ['하나', '둘'] }),
    ])

    expect(view.getAllByTestId('schedule-name').map((name) => name.props.children)).toEqual([
      '다',
      '가',
      '나',
    ])
  })

  // 남은 개수를 **모르는** 것이라 개수 비교에 참여시키지 않는다 — 위로 올리면 **제일 밀린 캐릭터**
  // 자리를 모르는 값이 거짓으로 차지한다(의 태도).
  it('동기화 실패는 어느 탭에서나 맨 아래다 — CLEAR 보다도 아래다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: '실패', characterName: '실패한캐릭터', hasSyncIssue: true }),
      스케줄행({ ocid: 'clear', characterName: '끝낸캐릭터', dailyNames: [], weeklyNames: [] }),
      스케줄행({ ocid: 'a', characterName: '남은캐릭터', dailyNames: ['하나'] }),
    ])

    const 이름들 = (): unknown[] =>
      view.getAllByTestId('schedule-name').map((name) => name.props.children)

    expect(이름들()).toEqual(['남은캐릭터', '끝낸캐릭터', '실패한캐릭터'])

    await 탭(view, '월간')

    expect(이름들()[2]).toBe('실패한캐릭터')
  })

  it('`외 N명` 접기 없이 캐릭터를 전부 그린다', async () => {
    const view = await 위젯(스케줄목록(6))

    expect(view.getAllByTestId('schedule-row')).toHaveLength(6)
    expect(view.queryByText(/외 .*명/)).toBeNull()
  })

  it('추적 캐릭터가 없으면 그 사실을 말한다', async () => {
    const { getByText, queryByTestId } = await renderAtom(
      <RemainingScheduleWidget w={4} h="auto" data={빈_뷰모델} />,
    )

    expect(getByText('추적 중인 캐릭터가 없습니다')).toBeTruthy()
    expect(queryByTestId('schedule-row')).toBeNull()
  })
})

describe('펼침도 그 탭의 것만이다', () => {
  it('처음에는 전부 접혀 있다', async () => {
    const view = await 위젯(스케줄목록(3))

    expect(view.queryByTestId('schedule-detail')).toBeNull()
  })

  it('일간 탭에서 펼치면 일퀘 이름만 선다 — 보스는 안 딸려 온다', async () => {
    const view = await 위젯([스케줄행()])

    await 펼치기(view)

    for (const name of ['소멸의 여로', '츄츄 아일랜드', '레헬른', '아르카나']) {
      expect(view.getByText(name)).toBeTruthy()
    }
    expect(view.queryByText('스우')).toBeNull()
    expect(view.queryByText('검은마법사')).toBeNull()
  })

  it('주간 탭에서 펼치면 주간퀘와 주간 보스가 함께 선다 — 검마는 아니다', async () => {
    const view = await 위젯([스케줄행()])

    await 탭(view, '주간')
    await 펼치기(view)

    expect(view.getByText('에르다 스펙트럼')).toBeTruthy()
    expect(view.getAllByTestId('schedule-detail-boss')).toHaveLength(2)
    expect(view.getByText('스우')).toBeTruthy()
    expect(view.queryByText('검은마법사')).toBeNull()
    expect(view.queryByText('소멸의 여로')).toBeNull()
  })

  it('월간 탭에서 펼치면 검마 하나다 — 공용 난이도 배지를 쓴다', async () => {
    const view = await 위젯([스케줄행()])

    await 탭(view, '월간')
    await 펼치기(view)

    expect(view.getAllByTestId('schedule-detail-boss')).toHaveLength(1)
    expect(view.getByText('검은마법사')).toBeTruthy()
    expect(view.getByText('하드')).toBeTruthy()
  })

  it('탭을 바꾸면 펼친 행이 닫힌다 — 두 층이 다른 주기를 말하면 안 된다', async () => {
    const view = await 위젯([스케줄행()])

    await 펼치기(view)
    expect(view.getByTestId('schedule-detail')).toBeTruthy()

    await 탭(view, '주간')

    expect(view.queryByTestId('schedule-detail')).toBeNull()
  })

  it('열린 행을 다시 누르면 닫힌다', async () => {
    const view = await 위젯([스케줄행()])

    await 펼치기(view)
    expect(view.getByTestId('schedule-detail')).toBeTruthy()

    await 펼치기(view)
    expect(view.queryByTestId('schedule-detail')).toBeNull()
  })

  // 여섯이 다 열리면 타일이 1,000px 을 넘고, 타일 안 스크롤은 이 금지한다.
  it('한 번에 하나만 열린다', async () => {
    const view = await 위젯(스케줄목록(3))

    await 펼치기(view, 0)
    await 펼치기(view, 1)

    expect(view.getAllByTestId('schedule-detail')).toHaveLength(1)
  })

  it('CLEAR 와 동기화 실패는 누를 수 없다 — 보여 줄 것이 없거나 모른다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: 'open' }),
      스케줄행({ ocid: 'clear', dailyNames: [] }),
      스케줄행({ ocid: 'issue', hasSyncIssue: true }),
    ])

    expect(view.queryAllByTestId('schedule-toggle')).toHaveLength(1)
  })

  // 20px 배지가 줄 높이를 혼자 정하고 있었다. 이제 상자에 높이를 안 박고
  // 여백이 높이를 만들므로, `작다`는 **글자 크기**로 잰다.
  it('보스 배지가 작은 크기다 — 본문보다 작은 칩 계단을 쓴다', async () => {
    const view = await 위젯([스케줄행()])

    await 탭(view, '월간')
    await 펼치기(view)

    expect(Number(flattenStyle(view.getByText('하드').props.style).fontSize)).toBe(9)
  })

  // `[주간 퀘스트] 타락한 세계수 주간 임무` 와 `… 정화에 대한 보답` 이 **둘 다 타락한 세계수** 로
  // 접힌다 — 키가 이름이면 같은 키가 둘이 되어 React 가 경고를 낸다.
  it('짧은 이름이 겹쳐도 칩이 둘 다 선다', async () => {
    const view = await 위젯([스케줄행({ weeklyNames: ['타락한 세계수', '타락한 세계수'] })])

    await 탭(view, '주간')
    await 펼치기(view)

    expect(view.getAllByText('타락한 세계수')).toHaveLength(2)
  })
})
