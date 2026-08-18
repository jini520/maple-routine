// 남은 스케줄 위젯([[ADR-146]] 정정 3·9·12). 이 파일이 지키는 것 넷 —
// ① **정렬 격자**(라벨·숫자 열 폭이 고정이라 모든 행의 숫자가 같은 x 에 선다)
// ② **강조는 굵기 하나뿐**(테마 색 금지 — 칠하면 강조가 캐릭터 수만큼 반복된다)
// ③ **행 높이가 데이터에 안 흔들린다**(값이 0 인 칸은 글자만 비우고 자리는 남는다)
// ④ **자르지도 축하하지도 않는다**(「외 N명」 없음 · 전부 완료 전용 UI 없음)
//
// jsdom 도 jest 도 레이아웃을 계산하지 않으므로 ③ 을 «픽셀» 로는 못 묻는다. 그래서 **높이를 정하는
// 구조**(둘째 줄이 언제나 있고 칸 폭이 상수다)를 계약으로 적는다.

import { act, fireEvent } from '@testing-library/react-native'

import { renderAtom, flattenStyle, 기본테마 } from '../../../../components/__tests__/render-atom'
import { RemainingScheduleWidget } from '../RemainingScheduleWidget'
import { 뷰모델, 스케줄목록, 스케줄행, 빈_뷰모델 } from './widget-fixture'
import type { ScheduleRowView } from '../../view-model'

async function 위젯(
  schedule: ScheduleRowView[],
  scheduleTotal = schedule.reduce(
    (sum, row) => (row.hasSyncIssue ? sum : sum + row.remainingTotal),
    0,
  ),
): Promise<ReturnType<typeof renderAtom>> {
  return renderAtom(
    <RemainingScheduleWidget w={4} h="auto" data={뷰모델({ schedule, scheduleTotal })} />,
  )
}

describe('정렬 격자 ([[ADR-146]] 정정 12)', () => {
  it('네 수치가 2×2 로 서고 라벨은 일퀘·주간퀘·주간 보스·검마다', async () => {
    const { getByText, getAllByTestId } = await 위젯([스케줄행()])

    expect(getByText('일퀘')).toBeTruthy()
    expect(getByText('주간퀘')).toBeTruthy()
    expect(getByText('주간 보스')).toBeTruthy()
    expect(getByText('검마')).toBeTruthy()
    expect(getAllByTestId('schedule-stat-line')).toHaveLength(2)
  })

  // 라벨 길이가 제각각(「일퀘」 2자 · 「주간 보스」 4자)이라 폭을 고정하지 않으면 행마다 다른 x 에서
  // 끝난다 — 그러면 «누가 제일 밀렸나» 를 세로로 훑을 수가 없다.
  it('라벨·숫자 열 폭이 고정이라 모든 행의 숫자가 같은 x 에 선다', async () => {
    const { getByText } = await 위젯([스케줄행()])

    const 라벨폭 = (글자: string): unknown => flattenStyle(getByText(글자).props.style).width
    const 숫자폭 = (글자: string): unknown => flattenStyle(getByText(글자).props.style).width

    expect(라벨폭('일퀘')).toBe(라벨폭('주간 보스'))
    expect(라벨폭('주간퀘')).toBe(라벨폭('검마'))
    expect(숫자폭('4')).toBe(숫자폭('1'))
  })

  it('숫자에 `tabular-nums` 가 걸린다 — 자릿수가 바뀌어도 폭이 안 흔들린다', async () => {
    const { getByText } = await 위젯([스케줄행()])

    expect(flattenStyle(getByText('4').props.style).fontVariant).toEqual(['tabular-nums'])
  })
})

describe('강조는 굵기 하나뿐이다 ([[ADR-146]] 정정 9)', () => {
  it('숫자와 라벨의 크기가 같고 굵기만 다르다', async () => {
    const { getByText } = await 위젯([스케줄행()])

    const 숫자 = flattenStyle(getByText('4').props.style)
    const 라벨 = flattenStyle(getByText('일퀘').props.style)

    expect(숫자.fontSize).toBe(라벨.fontSize)
    expect(String(숫자.fontWeight)).toBe('800')
    expect(숫자.fontWeight).not.toBe(라벨.fontWeight)
  })

  // 숫자를 `primary-ink` 로 칠하면 이 타일 하나에 강조색이 **캐릭터 수만큼 반복**된다.
  it('숫자 색은 닉네임과 같은 `text` 이고 라벨은 `text-muted` 다 — 테마 강조색이 아니다', async () => {
    const { getByText } = await 위젯([스케줄행()])

    expect(flattenStyle(getByText('4').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(getByText('야간비행').props.style).color).toBe(기본테마.text)
    expect(flattenStyle(getByText('일퀘').props.style).color).toBe(기본테마.textMuted)
    expect(flattenStyle(getByText('4').props.style).color).not.toBe(기본테마.primaryInk)
  })
})

describe('행 높이는 데이터에 안 흔들린다 ([[ADR-146]] 정정 9·12)', () => {
  it('보스가 0이면 둘째 줄이 **비되 자리는 남는다**', async () => {
    const { getAllByTestId, queryByText } = await 위젯([
      스케줄행({ weeklyBosses: [], monthlyBosses: [] }),
    ])

    expect(getAllByTestId('schedule-stat-line')).toHaveLength(2)
    expect(queryByText('주간 보스')).toBeNull()
    expect(queryByText('검마')).toBeNull()
  })

  // 빈 글자만으로는 부족하다 — **빈 `Text` 의 높이는 플랫폼마다 다르다.** 줄에 높이를 박아 두지
  // 않으면 보스가 0인 캐릭터의 행만 접혀 auto 높이 계산이 성립하지 않는다.
  it('수치 줄 높이가 값에 상관없이 같다', async () => {
    const 채워진 = await 위젯([스케줄행()])
    const 비어있는 = await 위젯([스케줄행({ weeklyBosses: [], monthlyBosses: [] })])

    const 높이 = (view: Awaited<ReturnType<typeof 위젯>>): unknown[] =>
      view.getAllByTestId('schedule-stat-line').map((line) => flattenStyle(line.props.style).height)

    expect(높이(채워진)).toEqual(높이(비어있는))
    expect(new Set(높이(채워진)).size).toBe(1)
    expect(높이(채워진)[0]).toBeGreaterThan(0)
  })

  it('0 인 칸은 「일퀘 0」이 아니라 빈 칸이다', async () => {
    const { queryByText } = await 위젯([스케줄행({ dailyNames: [] })])

    expect(queryByText('일퀘')).toBeNull()
    expect(queryByText('0')).toBeNull()
  })
})

describe('아코디언 ([[ADR-146]] 정정 25)', () => {
  it('처음에는 전부 접혀 있다', async () => {
    const { queryByTestId } = await 위젯(스케줄목록(3))

    expect(queryByTestId('schedule-detail')).toBeNull()
  })

  it('행을 누르면 그 캐릭터의 남은 것이 이름으로 선다', async () => {
    const view = await 위젯([스케줄행()])

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })

    expect(view.getByTestId('schedule-detail')).toBeTruthy()
    expect(view.getByText('소멸의 여로')).toBeTruthy()
    expect(view.getByText('에르다 스펙트럼')).toBeTruthy()
    expect(view.getByText('스우')).toBeTruthy()
  })

  // 「외 N개」로 접으면 펼친 이유가 사라진다 — 펼침은 «더 보겠다» 는 명시적 행동이다.
  it('본문은 자르지 않는다 — 일퀘 넷이면 넷 다 적는다', async () => {
    const view = await 위젯([스케줄행()])

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })

    for (const name of ['소멸의 여로', '츄츄 아일랜드', '레헬른', '아르카나']) {
      expect(view.getByText(name)).toBeTruthy()
    }
  })

  it('보스는 공용 난이도 배지를 쓴다 — 주간과 검마가 한 그룹이다', async () => {
    const view = await 위젯([스케줄행()])

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })

    expect(view.getAllByTestId('schedule-detail-boss')).toHaveLength(3)
    expect(view.getByText('검은마법사')).toBeTruthy()
    // 스우·검은마법사가 둘 다 하드다 — 배지가 보스마다 하나씩 선다.
    expect(view.getAllByText('하드')).toHaveLength(2)
    expect(view.getByText('카오스')).toBeTruthy()
  })

  it('열린 행을 다시 누르면 닫힌다', async () => {
    const view = await 위젯([스케줄행()])

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })
    expect(view.getByTestId('schedule-detail')).toBeTruthy()

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })
    expect(view.queryByTestId('schedule-detail')).toBeNull()
  })

  // 여섯이 다 열리면 타일이 1,000px 을 넘고, 타일 안 스크롤은 [[ADR-146]] 결정 3 이 금지한다.
  it('한 번에 하나만 열린다', async () => {
    const view = await 위젯(스케줄목록(3))

    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[0])
    })
    await act(async () => {
      fireEvent.press(view.getAllByTestId('schedule-toggle')[1])
    })

    expect(view.getAllByTestId('schedule-detail')).toHaveLength(1)
  })

  it('CLEAR 와 동기화 실패는 누를 수 없다 — 보여 줄 것이 없거나 모른다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: 'open' }),
      스케줄행({ ocid: 'clear', dailyNames: [], weeklyNames: [], weeklyBosses: [], monthlyBosses: [] }),
      스케줄행({ ocid: 'issue', hasSyncIssue: true }),
    ])

    // 셋 중 남은 것이 있는 하나만 눌린다.
    expect(view.queryAllByTestId('schedule-toggle')).toHaveLength(1)
  })
})

describe('배지는 «상태» 에만 선다 ([[ADR-146]] 정정 9)', () => {
  it('남은 것이 없으면 수치 자리에 `CLEAR` 가 선다', async () => {
    const { getByTestId, queryByTestId } = await 위젯([
      스케줄행({ dailyNames: [], weeklyNames: [], weeklyBosses: [], monthlyBosses: [] }),
    ])

    expect(getByTestId('schedule-clear')).toBeTruthy()
    expect(queryByTestId('schedule-stats')).toBeNull()
  })

  it('전부 완료여도 **같은 목록**이다 — 축하 UI 를 두지 않는다', async () => {
    const 완료 = 스케줄목록(3).map((row) => ({
      ...row,
      dailyNames: [],
      weeklyNames: [],
      weeklyBosses: [],
      monthlyBosses: [],
      remainingTotal: 0,
    }))
    const { getAllByTestId, getAllByText } = await 위젯(완료)

    expect(getAllByTestId('schedule-row')).toHaveLength(3)
    expect(getAllByText('CLEAR')).toHaveLength(3)
    // 형태가 안 바뀌어야 «어제와 같은 화면» 으로 읽힌다 — 머리글도 그대로다.
    expect(getAllByText('남은 스케줄')).toHaveLength(1)
  })

  it('동기화 실패는 수치 대신 그 사실을 말한다', async () => {
    const { getByTestId, queryByTestId } = await 위젯([스케줄행({ hasSyncIssue: true })])

    expect(getByTestId('schedule-issue')).toBeTruthy()
    expect(queryByTestId('schedule-stats')).toBeNull()
    expect(queryByTestId('schedule-clear')).toBeNull()
  })
})

describe('목록은 자르지도 다시 세우지도 않는다', () => {
  // 정렬은 뷰모델이 끝냈다(남은 개수 많은 순 → 동수면 관리 순서 · 실패는 맨 아래). 위젯이 다시
  // 세우면 그 계약이 두 벌이 된다 — 여기서 묻는 것은 «받은 순서 그대로 그리는가» 다.
  it('받은 순서를 그대로 그린다 — 동기화 실패 캐릭터가 맨 아래에 온다', async () => {
    const [첫, 둘] = 스케줄목록(2)
    const 실패 = 스케줄행({ ocid: 'ocid-실패', characterName: '실패한캐릭터', hasSyncIssue: true })
    const { getAllByTestId } = await 위젯([첫, 둘, 실패])

    const 이름들 = getAllByTestId('schedule-name').map((name) => name.props.children)

    expect(이름들).toEqual(['캐릭터1', '캐릭터2', '실패한캐릭터'])
  })

  it('「외 N명」 접기 없이 캐릭터를 전부 그린다', async () => {
    const { getAllByTestId, queryByText } = await 위젯(스케줄목록(6))

    expect(getAllByTestId('schedule-row')).toHaveLength(6)
    expect(queryByText(/외 .*명/)).toBeNull()
  })

  it('추적 캐릭터가 없으면 그 사실을 말한다', async () => {
    const { getByText, queryByTestId } = await renderAtom(
      <RemainingScheduleWidget w={4} h="auto" data={빈_뷰모델} />,
    )

    expect(getByText('추적 중인 캐릭터가 없습니다')).toBeTruthy()
    expect(queryByTestId('schedule-row')).toBeNull()
  })
})

describe('머리글 합계 ([[ADR-146]] 정정 9)', () => {
  it('칩이 아니라 텍스트이고 숫자만 굵다', async () => {
    const { getByText } = await 위젯(스케줄목록(2))

    // 스케줄행 하나가 10(4+3+2+1)이라 둘이면 20 이다 — 합계는 뷰모델이 준 값을 그대로 그린다.
    const 합계 = getByText('20')
    expect(String(flattenStyle(합계.props.style).fontWeight)).toBe('800')
    expect(flattenStyle(합계.props.style).backgroundColor).toBeUndefined()
  })
})

describe('스냅샷 — 캐릭터 수만 다르다', () => {
  it.each([2, 4, 6])('%i명', async (n) => {
    const view = await 위젯(스케줄목록(n))

    expect(view.toJSON()).toMatchSnapshot()
  })
})
