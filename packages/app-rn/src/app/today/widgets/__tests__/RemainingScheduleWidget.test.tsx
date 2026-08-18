// 남은 스케줄 위젯([[ADR-146]] 정정 3·9·12). 이 파일이 지키는 것 넷 —
// ① **숫자 폭이 고정이다**(`tabular-nums` + 칸 폭 상수 — 자릿수가 바뀌어도 오른쪽 끝이 안 떤다)
// ② **강조는 굵기 하나뿐**(테마 색 금지 — 칠하면 강조가 캐릭터 수만큼 반복된다)
// ③ **줄도 칸도 «그 행» 이 정한다**(정정 37 — 빈 줄도 빈 칸도 안 남는다)
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

describe('정렬 격자 ([[ADR-146]] 정정 12 · 36)', () => {
  it('네 수치가 2×2 로 서고 라벨은 일퀘·주간퀘·주간 보스·검마다', async () => {
    const { getByText, getAllByTestId } = await 위젯([스케줄행()])

    expect(getByText('일퀘')).toBeTruthy()
    expect(getByText('주간퀘')).toBeTruthy()
    expect(getByText('주간 보스')).toBeTruthy()
    expect(getByText('검마')).toBeTruthy()
    expect(getAllByTestId('schedule-stat-line')).toHaveLength(2)
  })

  // 폭 상수는 남는다([[ADR-146]] 정정 36) — 정렬을 반만 포기한 것이지 숫자가 자릿수마다 떨어도
  // 된다는 뜻이 아니다. **같은 모양의 행끼리는** 이 폭 덕에 여전히 한 열이다.
  it('라벨·숫자 열 폭이 고정이다', async () => {
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

describe('줄도 칸도 «그 행» 이 정한다 ([[ADR-146]] 정정 35~37)', () => {
  it('보스가 안 남은 행은 **한 줄**이다 — 빈 줄을 지지 않는다', async () => {
    const { getAllByTestId, queryByText } = await 위젯([
      스케줄행({ ocid: 'a', weeklyBosses: [], monthlyBosses: [] }),
      스케줄행({ ocid: 'b', weeklyBosses: [], monthlyBosses: [] }),
    ])

    expect(getAllByTestId('schedule-stat-line')).toHaveLength(2) // 행마다 한 줄씩
    expect(queryByText('주간 보스')).toBeNull()
    expect(queryByText('검마')).toBeNull()
  })

  // 정정 35 는 «한 명이라도 들고 있으면 모든 행에 줄이 선다» 였다 — 그 장치를 지웠다. 남은 행이
  // 빈 줄을 지지 않는 것이 사용자가 고른 답이고, 대가는 목록의 행 높이가 고르지 않은 것이다.
  it('한 캐릭터만 보스가 남으면 그 행만 두 줄이다', async () => {
    const { getAllByTestId, getAllByText } = await 위젯([
      스케줄행({ ocid: 'a', weeklyBosses: [], monthlyBosses: [] }),
      스케줄행({ ocid: 'b' }),
    ])

    expect(getAllByTestId('schedule-stat-line')).toHaveLength(3) // a 한 줄 + b 두 줄
    expect(getAllByText('주간 보스')).toHaveLength(1)
  })

  it('칸 하나만 죽으면 줄은 남는다 — 줄은 계열(컨텐츠·보스) 단위다', async () => {
    const { getAllByTestId, getAllByText, queryByText } = await 위젯([
      스케줄행({ ocid: 'a', monthlyBosses: [] }),
      스케줄행({ ocid: 'b', monthlyBosses: [] }),
    ])

    expect(getAllByTestId('schedule-stat-line')).toHaveLength(4)
    expect(getAllByText('주간 보스')).toHaveLength(2)
    expect(queryByText('검마')).toBeNull()
  })

  // 값이 없는 칸을 비워 두면 그것이 그대로 빈 자리가 된다 — 일퀘만 남은 행이 `일퀘 10` 뒤에
  // 라벨 48 + 숫자 18 + 간격 12 를 지고 셰브런까지 갔다(사용자 보고, 정정 36).
  it('값이 없는 칸은 접힌다 — 「일퀘 0」도 빈 자리도 남기지 않는다', async () => {
    const { getAllByTestId, queryByText } = await 위젯([
      스케줄행({ dailyNames: [], weeklyBosses: [], monthlyBosses: [] }),
    ])

    const 줄들 = getAllByTestId('schedule-stat-line')
    expect(줄들).toHaveLength(1)
    expect(줄들[0]?.props.children).toHaveLength(1) // 주간퀘 하나만
    expect(queryByText('일퀘')).toBeNull()
    expect(queryByText('0')).toBeNull()
  })

  it('줄은 오른쪽 정렬이다 — 칸이 줄면 셰브런 옆에 붙는다', async () => {
    const { getByTestId } = await 위젯([스케줄행()])

    expect(flattenStyle(getByTestId('schedule-stats').props.style)).toMatchObject({
      alignItems: 'flex-end',
    })
  })

  // 행 높이는 이제 줄 수를 따라간다. 그래도 **줄 하나의 높이**는 상수라, 한 줄 행과 두 줄 행의
  // 높이가 예측 가능한 관계로 묶인다.
  it('수치 줄 하나의 높이는 값에 상관없이 같다', async () => {
    const view = await 위젯([
      스케줄행({ ocid: 'a', weeklyBosses: [], monthlyBosses: [] }),
      스케줄행({ ocid: 'b' }),
    ])

    const 높이 = view
      .getAllByTestId('schedule-stat-line')
      .map((line) => flattenStyle(line.props.style).height)

    expect(new Set(높이).size).toBe(1)
    expect(높이[0]).toBeGreaterThan(0)
  })

  it('넷 다 남으면 2×2 그대로다', async () => {
    const { getAllByTestId } = await 위젯([스케줄행()])

    const 줄들 = getAllByTestId('schedule-stat-line')
    expect(줄들).toHaveLength(2)
    expect(줄들[0]?.props.children).toHaveLength(2)
    expect(줄들[1]?.props.children).toHaveLength(2)
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


describe('수치 줄을 좁혔다 ([[ADR-146]] 정정 40)', () => {
  // 18 은 세 자리를 담을 폭이라, 오른쪽 정렬에서 남는 4px 이 전부 왼쪽 여백이 되어 한 자리 수치가
  // 라벨에서 떨어져 보였다. 두 자리에 맞춘다.
  it('숫자 칸이 두 자리 폭이다', async () => {
    const { getByText } = await 위젯([스케줄행()])

    expect(flattenStyle(getByText('4').props.style).width).toBe(14)
  })

  it('라벨–숫자 간격보다 칸 사이가 넓다 — 한 칸이 한 덩이로 읽혀야 한다', async () => {
    const { getAllByTestId, getByText } = await 위젯([스케줄행()])

    const 간격 = (style: unknown): number => {
      const 풀린 = flattenStyle(style) as Record<string, unknown>
      return Number(풀린.columnGap ?? 풀린.gap ?? 0)
    }
    const 칸사이 = 간격(getAllByTestId('schedule-stat-line')[0]?.props.style)
    const 라벨숫자 = 간격(getByText('일퀘').parent?.props.style)

    expect(칸사이).toBeGreaterThan(라벨숫자)
    expect(칸사이).toBeLessThanOrEqual(8)
  })

  it('보스 배지가 작은 크기다 — 20px 배지가 줄 높이를 혼자 정하고 있었다', async () => {
    const { getAllByTestId, getAllByText } = await 위젯([스케줄행()])

    await act(async () => {
      fireEvent.press(getAllByTestId('schedule-toggle')[0])
    })

    // 스우 하드 · 검은마법사 하드 둘이라 앞의 것을 본다.
    expect(Number(flattenStyle(getAllByText('하드')[0]?.parent?.props.style).height)).toBe(16)
  })

  // `[주간 퀘스트] 타락한 세계수 주간 임무` 와 `… 정화에 대한 보답` 이 **둘 다 「타락한 세계수」** 로
  // 접힌다 — 키가 이름이면 같은 키가 둘이 되어 React 가 경고를 낸다.
  it('짧은 이름이 겹쳐도 칩이 둘 다 선다', async () => {
    const { getAllByTestId, getAllByText } = await 위젯([
      스케줄행({ weeklyNames: ['타락한 세계수', '타락한 세계수'] }),
    ])

    await act(async () => {
      fireEvent.press(getAllByTestId('schedule-toggle')[0])
    })

    expect(getAllByText('타락한 세계수')).toHaveLength(2)
  })
})
