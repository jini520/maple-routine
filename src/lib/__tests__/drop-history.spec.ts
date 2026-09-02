import {
  confirmedDropKey,
  filterUnobtainableConfirmedDrops,
  formatDropHistoryLine,
  formatValuableDroughtHeadline,
  formatValuableDroughtItems,
  getValuableDroughtTier,
  getPeriodCycle,
  getPeriodStartUtcMs,
  groupDropRecordsByPeriod,
  objectParticle,
  summarizeValuableDrought,
  valuableDroughtHeadlineCount,
  WORD_JOINER,
  type DropHistoryLine,
  type DropHistoryRecord,
} from '../drop/drop-history'

/** 보이지 않는 줄바꿈 금지 문자를 걷어내 사람이 읽는 문장으로 되돌린다. */
function plain(text: string): string {
  return text.replaceAll(WORD_JOINER, '')
}

/** 조각을 화면이 그리는 순서대로 이어 완성 문장을 만든다. */
function sentence(line: DropHistoryLine): string {
  const box = line.box === undefined ? '' : `${line.box.name}${line.box.connector}`
  return `${line.prefix}${box}${line.item}${line.particle}${line.suffix}`
}

// 히스토리는 boss_drop_records를 전 기간 조회한 결과를 그대로 받는다. 이 lib은 storage를
// 의존하지 않으므로 저장 계층 타입 대신 구조적 입력 타입을 쓴다.
function record(overrides: Partial<DropHistoryRecord>): DropHistoryRecord {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: '2026-07-09',
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    quantity: 1,
    ...overrides,
  }
}

describe('getPeriodCycle', () => {
  it('주간 키(YYYY-MM-DD)는 weekly, 월간 키(YYYY-MM)는 monthly', () => {
    expect(getPeriodCycle('2026-07-09')).toBe('weekly')
    expect(getPeriodCycle('2026-07')).toBe('monthly')
  })
})

describe('getPeriodStartUtcMs', () => {
  it('주간 키는 그 KST 날짜 00:00을 가리킨다', () => {
    // 2026-07-09 00:00 KST = 2026-07-08 15:00 UTC
    expect(getPeriodStartUtcMs('2026-07-09')).toBe(Date.UTC(2026, 6, 8, 15, 0, 0))
  })

  it('월간 키는 그 달 1일 00:00 KST를 가리킨다', () => {
    expect(getPeriodStartUtcMs('2026-07')).toBe(Date.UTC(2026, 5, 30, 15, 0, 0))
  })

  it('두 형식을 한 축에서 비교할 수 있다. 문자열 비교로는 불가능한 순서', () => {
    // 문자열로는 '2026-07-09' > '2026-07'(접두사)이지만 시간축에서는 월간 7월이 더 이르다.
    expect(getPeriodStartUtcMs('2026-07')).toBeLessThan(getPeriodStartUtcMs('2026-07-09'))
    expect(getPeriodStartUtcMs('2026-07')).toBeGreaterThan(getPeriodStartUtcMs('2026-06-25'))
  })
})

describe('groupDropRecordsByPeriod', () => {
  it('기간별로 묶고 최신 기간이 먼저 오도록 정렬한다', () => {
    const groups = groupDropRecordsByPeriod([
      record({ periodKey: '2026-06-25' }),
      record({ periodKey: '2026-07-16' }),
      record({ periodKey: '2026-07-09' }),
    ])

    expect(groups.map((group) => group.periodKey)).toEqual(['2026-07-16', '2026-07-09', '2026-06-25'])
  })

  it('주간·월간 키를 시간축에서 섞어 정렬한다', () => {
    const groups = groupDropRecordsByPeriod([
      record({ periodKey: '2026-07-09' }),
      record({ periodKey: '2026-07' }),
      record({ periodKey: '2026-06-25' }),
    ])

    // 월간 7월(7/1)은 7/9 주보다 이르고 6/25 주보다 늦다. 문자열 정렬로는 나오지 않는 순서다.
    expect(groups.map((group) => group.periodKey)).toEqual(['2026-07-09', '2026-07', '2026-06-25'])
  })

  it('그룹에 cycle을 붙인다. 기간 라벨 포맷이 주간/월간으로 갈리기 때문', () => {
    const groups = groupDropRecordsByPeriod([record({ periodKey: '2026-07' })])
    expect(groups[0].cycle).toBe('monthly')
  })

  it('같은 기간 안에서는 입력 순서를 보존한다. 조회 SQL이 정한 순서가 표시 순서다', () => {
    const groups = groupDropRecordsByPeriod([
      record({ itemName: '루즈 컨트롤 머신 마크' }),
      record({ itemName: '주문의 흔적', category: 'fixed', slot: undefined }),
      record({ itemName: '리스트레인트 링', category: 'consumable', slot: undefined }),
    ])

    expect(groups[0].records.map((entry) => entry.itemName)).toEqual([
      '루즈 컨트롤 머신 마크',
      '주문의 흔적',
      '리스트레인트 링',
    ])
  })

  it('기록이 없으면 빈 배열', () => {
    expect(groupDropRecordsByPeriod([])).toEqual([])
  })
})

describe('filterUnobtainableConfirmedDrops', () => {
  const confirmed = new Set([confirmedDropKey('ocid-1', '스우', '하드', '2026-07-09')])

  it('처치 난이도가 확정된 조합에서는 그 난이도에서 못 나오는 기록을 거른다', () => {
    const records = [
      record({ itemName: '루즈 컨트롤 머신 마크' }), // 하드+익스 → 유지
      record({ itemName: '컴플리트 언더컨트롤', slot: undefined }), // 익스 전용 → 제거
    ]

    expect(filterUnobtainableConfirmedDrops(records, confirmed).map((entry) => entry.itemName)).toEqual([
      '루즈 컨트롤 머신 마크',
    ])
  })

  it('상자 개봉 결과는 상자명(boxOrigin) 기준으로 판정한다', () => {
    const records = [
      record({
        itemName: '리스트레인트 링',
        category: 'consumable',
        slot: undefined,
        boxOrigin: '홍옥의 보스 반지 상자', // 하드 → 유지
        ringLevel: 3,
      }),
      record({
        itemName: '아무 반지',
        category: 'consumable',
        slot: undefined,
        boxOrigin: '백옥의 보스 반지 상자', // 익스 전용 → 제거
      }),
    ]

    expect(filterUnobtainableConfirmedDrops(records, confirmed).map((entry) => entry.itemName)).toEqual([
      '리스트레인트 링',
    ])
  })

  it('확정되지 않은 조합은 건드리지 않는다. 나중에 이관되어 살아남을 기록이다', () => {
    // 익스트림으로 등록해두고 실제로는 하드를 잡은 상황: 하드 전용 기록이 익스트림 키에 들어 있다.
    // 여기서 걸러버리면 난이도가 확정되면 살아남을 기록을 미리 숨기게 된다.
    const records = [record({ difficulty: '익스트림', itemName: '녹옥의 보스 반지 상자' })]

    expect(filterUnobtainableConfirmedDrops(records, new Set())).toEqual(records)
  })

  it('고정(fixed) 기록은 선택 대상이 아니라 항상 보존한다', () => {
    const records = [record({ category: 'fixed', itemName: '주문의 흔적', slot: undefined })]
    expect(filterUnobtainableConfirmedDrops(records, confirmed)).toEqual(records)
  })
})

describe('summarizeValuableDrought', () => {
  // 2026-07-31(금) → 가장 최근 주간 리셋(KST 목 00:00)은 2026-07-30
  const now = new Date('2026-07-31T03:00:00.000Z')

  it('마지막 고가 획득 기간과 그 뒤로 지난 주 수를 반환한다', () => {
    const summary = summarizeValuableDrought(
      [
        record({ periodKey: '2026-07-09', itemName: '루즈 컨트롤 머신 마크' }), // 고가
        record({ periodKey: '2026-07-23', itemName: '리스트레인트 링', category: 'consumable', slot: undefined }), // 고가 아님
      ],
      now,
    )

    // 7-09 → 7-30 = 21일 = 3주
    expect(summary).toMatchObject({ periodKey: '2026-07-09', cycle: 'weekly', weeksSince: 3 })
  })

  it('여러 고가 기록 중 가장 최신 기간을 고른다 (입력 순서와 무관)', () => {
    const summary = summarizeValuableDrought(
      [
        record({ periodKey: '2026-07-16', itemName: '생명의 연마석', category: 'consumable', slot: undefined }),
        record({ periodKey: '2026-06-25', itemName: '루즈 컨트롤 머신 마크' }),
        record({ periodKey: '2026-07-02', itemName: '창세의 뱃지', slot: undefined }),
      ],
      now,
    )

    expect(summary).toMatchObject({ periodKey: '2026-07-16', weeksSince: 2 })
  })

  it('그 기간의 고가 기록을 함께 반환한다. 아이콘 스택 표시용', () => {
    const summary = summarizeValuableDrought(
      [
        record({ periodKey: '2026-07-16', itemName: '루즈 컨트롤 머신 마크' }),
        record({ periodKey: '2026-07-16', itemName: '리스트레인트 링', category: 'consumable', slot: undefined }),
        record({ periodKey: '2026-07-16', itemName: '창세의 뱃지', slot: undefined }),
        record({ periodKey: '2026-07-09', itemName: '생명의 연마석', category: 'consumable', slot: undefined }),
      ],
      now,
    )

    // 고가만, 그리고 마지막 기간(7-16)만. 고가 아닌 링과 이전 기간 연마석은 빠진다.
    expect(summary?.records.map((entry) => entry.itemName)).toEqual([
      '루즈 컨트롤 머신 마크',
      '창세의 뱃지',
    ])
  })

  it('이번 주에 먹었으면 weeksSince는 0이다', () => {
    const summary = summarizeValuableDrought(
      [record({ periodKey: '2026-07-30', itemName: '루즈 컨트롤 머신 마크' })],
      now,
    )
    expect(summary?.weeksSince).toBe(0)
  })

  it('월간 기록도 주 축으로 환산해 센다 (주 경계에 걸리면 내림)', () => {
    // 월간 7월 시작(7/1 00:00 KST) → 7/30 = 29일 = 4주 + 1일 → 4주
    const summary = summarizeValuableDrought(
      [record({ periodKey: '2026-07', boss: '검은 마법사', difficulty: '하드', itemName: '창세의 뱃지', slot: undefined })],
      now,
    )
    expect(summary).toMatchObject({ periodKey: '2026-07', cycle: 'monthly', weeksSince: 4 })
  })

  it('고가 기록이 하나도 없으면 null"∞주째" 같은 값을 만들지 않는다', () => {
    const summary = summarizeValuableDrought(
      [record({ itemName: '리스트레인트 링', category: 'consumable', slot: undefined })],
      now,
    )
    expect(summary).toBeNull()
  })

  it('기록이 아예 없으면 null', () => {
    expect(summarizeValuableDrought([], now)).toBeNull()
  })
})

describe('objectParticle', () => {
  it('받침이 있으면 "을", 없으면 "를"', () => {
    expect(objectParticle('가디언 엔젤링')).toBe('을') // 링. 받침 ㅇ
    expect(objectParticle('루즈 컨트롤 머신 마크')).toBe('를') // 크. 받침 없음
    expect(objectParticle('생명의 연마석')).toBe('을') // 석. 받침 ㄱ
  })

  it('한글이 아닌 문자로 끝나면 마지막 한글 음절로 판단한다', () => {
    // 슬롯별로 분리된 익셉셔널 해머는 ')'로 끝난다. 괄호를 보고 판단하면 틀린다.
    expect(objectParticle('익셉셔널 해머(벨트)')).toBe('를') // 트. 받침 없음
    expect(objectParticle('익셉셔널 해머(눈장식)')).toBe('을') // 식. 받침 ㄱ
  })

  it('한글이 없으면 "을"로 둔다', () => {
    expect(objectParticle('MVP')).toBe('을')
  })
})

// 사용자 지정 형식(2026-07-31): "지내우시님이 가디언 엔젤 슬라임(카오스)에서 가디언 엔젤링을
// 획득하였습니다."아이템만 강조 대상으로 떼어내 반환한다(고가면 화면이 골드 pill로 감싼다).
describe('formatDropHistoryLine', () => {
  it('캐릭터·보스·난이도·아이템으로 한 줄 문장을 만든다', () => {
    const line = formatDropHistoryLine(
      record({
        boss: '가디언 엔젤 슬라임',
        difficulty: '카오스',
        itemName: '가디언 엔젤링',
        slot: undefined,
      }),
      '지내우시',
    )

    expect(plain(line.prefix)).toBe('지내우시님이 가디언 엔젤 슬라임(카오스)에서 ')
    expect(line.box).toBeUndefined()
    expect(line.item).toBe('가디언 엔젤링')
    expect(line.particle).toBe('을')
    expect(line.suffix).toBe(' 획득하였습니다.')
    expect(plain(sentence(line))).toBe(
      '지내우시님이 가디언 엔젤 슬라임(카오스)에서 가디언 엔젤링을 획득하였습니다.',
    )
  })

  // 브라우저 실측(2026-07-31): 괄호는 UAX #14 에서 그 자체가 줄바꿈 지점이라 `word-break: keep-all`
  // 로도 "슬라임(카오스)⏎에서" 가 막히지 않는다. 띄어쓰기만 기준이 되게 word joiner 로 묶는다.
  it('난이도 괄호 양옆을 word joiner로 묶어 그 지점의 줄바꿈을 막는다', () => {
    const line = formatDropHistoryLine(
      record({ boss: '가디언 엔젤 슬라임', difficulty: '카오스', slot: undefined }),
      '지내우시',
    )

    expect(line.prefix).toContain(`가디언 엔젤 슬라임${WORD_JOINER}(카오스)${WORD_JOINER}에서`)
  })

  it('캐릭터명을 모르면 이름 부분을 비운다. ocid를 노출하지 않는다', () => {
    const line = formatDropHistoryLine(
      record({ boss: '스우', difficulty: '하드', itemName: '가디언 엔젤링', slot: undefined }),
      undefined,
    )

    expect(plain(line.prefix)).toBe('스우(하드)에서 ')
  })

  it('수량이 2 이상이면 개수를 아이템에 붙인다 (1은 붙이지 않는다)', () => {
    expect(
      formatDropHistoryLine(
        record({ itemName: '주문의 흔적', category: 'fixed', slot: undefined, quantity: 240 }),
        '지내우시',
      ).item,
    ).toBe('주문의 흔적 240개')

    expect(formatDropHistoryLine(record({ quantity: 1 }), '지내우시').item).toBe(
      '루즈 컨트롤 머신 마크',
    )
  })

  it('반지 등급이 기록돼 있으면 레벨을 붙인다', () => {
    const line = formatDropHistoryLine(
      record({
        itemName: '리스트레인트 링',
        category: 'consumable',
        slot: undefined,
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
      }),
      '지내우시',
    )

    expect(line.item).toBe('리스트레인트 링 3레벨')
    expect(line.particle).toBe('을') // 벨. 받침 ㄹ
  })

  it('상자 개봉 결과는 어떤 상자를 열었는지 함께 말한다', () => {
    const line = formatDropHistoryLine(
      record({
        boss: '스우',
        difficulty: '하드',
        itemName: '리스트레인트 링',
        category: 'consumable',
        slot: undefined,
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
      }),
      '지내우시',
    )

    // 상자명도 강조 대상이라 따로 뗀다(사용자 지정 2026-08-01). 조사는 connector가 들고 있어
    // 화면이 한국어 문법을 계산하지 않는다.
    expect(plain(line.prefix)).toBe('지내우시님이 스우(하드)에서 ')
    expect(line.box).toEqual({ name: '홍옥의 보스 반지 상자', connector: '를 열어 ' })
    expect(line.item).toBe('리스트레인트 링 3레벨')
    expect(plain(sentence(line))).toBe(
      '지내우시님이 스우(하드)에서 홍옥의 보스 반지 상자를 열어 리스트레인트 링 3레벨을 획득하였습니다.',
    )
  })
})

// 후속(사용자 확정 2026-08-01, 시안 W4): 미획득 기간이 길어질수록 요약이 "점점
// 슬퍼진다"단계는 문구와 시각 표현이 함께 쓰고, 문구 쪽만 여기서 검증한다.
describe('getValuableDroughtTier', () => {
  it('사용자가 말한 "N주차"는 미획득 N-1주다. 1주차(와따리)가 곧 먹은 그 주', () => {
    expect(getValuableDroughtTier(0)).toBe(0)
  })

  it('0~3주는 각자 한 단계, 4주 이상은 마지막 단계로 묶인다', () => {
    expect([0, 1, 2, 3].map(getValuableDroughtTier)).toEqual([0, 1, 2, 3])
    expect([4, 5, 16, 200].map(getValuableDroughtTier)).toEqual([4, 4, 4, 4])
  })
})

/** 그 주 수의 풀 전체. 인덱스를 0부터 개수만큼 돌려 모은다. */
function pool(weeksSince: number): string[] {
  return Array.from({ length: valuableDroughtHeadlineCount(weeksSince) }, (_, index) =>
    formatValuableDroughtHeadline(weeksSince, index),
  )
}

describe('formatValuableDroughtHeadline', () => {
  // 문구는 사용자 지정(2026-08-01·2026-08-17). 구현자가 톤을 다듬지 않는다.
  // 마지막 단계만 풀이던 것이 전 단계 풀이 됐다. 기존 문구는 각 풀의 **첫 항목**이라
  // 인덱스를 주지 않은 호출은 예전과 글자 하나 다르지 않다(회귀 가드).
  it('index 0은 단계마다 기존 문구를 그대로 준다', () => {
    expect(formatValuableDroughtHeadline(0, 0)).toBe('와따리! ㅇㄱㄱㄷ')
    expect(formatValuableDroughtHeadline(1, 0)).toBe('그래, 그럴 수 있지')
    expect(formatValuableDroughtHeadline(2, 0)).toBe('어?! 슬슬 쫌 그래!?')
    expect(formatValuableDroughtHeadline(3, 0)).toBe('선넘네?!')
    expect(formatValuableDroughtHeadline(9, 0)).toBe('이건 아니지...')
  })

  // 사용자가 고른 여섯이 각 풀에 얹혔다.
  it('0~3주도 풀이라 index로 다른 문구가 나온다', () => {
    expect(pool(0)).toEqual(['와따리! ㅇㄱㄱㄷ', '완전 럭키비키잖아', '폼 미쳤다'])
    expect(pool(1)).toEqual(['그래, 그럴 수 있지', '다음 주엔 되겠지'])
    expect(pool(2)).toEqual(['어?! 슬슬 쫌 그래!?', '슬슬 킹받는데', '이게 맞나?'])
    expect(pool(3)).toEqual(['선넘네?!', '이게 억까지 뭐야'])
  })

  it('4주 이상은 기존 다섯 줄 그대로다. 채택된 추가 문구가 없다', () => {
    expect(pool(9)).toEqual([
      '이건 아니지...',
      '적당히 해!',
      '제발 한 번만...',
      '이제 기대도 안 해',
      '내가 뭘 잘못했나',
    ])
  })

  it('풀 안에서 문구가 겹치지 않는다. 같은 말이 두 슬롯을 차지하면 랜덤이 덜 랜덤해진다', () => {
    for (const weeks of [0, 1, 2, 3, 9]) {
      expect(new Set(pool(weeks)).size).toBe(valuableDroughtHeadlineCount(weeks))
    }
  })

  it('index는 주 수와 무관하게 같은 문구를 준다. 4주와 200주가 같은 풀을 쓴다', () => {
    expect(formatValuableDroughtHeadline(4, 2)).toBe(formatValuableDroughtHeadline(200, 2))
  })

  // 호출부가 경계를 신경 쓰지 않아도 되는 성질. 단계마다 풀 크기가 달라져 더 중요해졌다.
  it('index가 범위를 벗어나도 단계마다 감싸서 고른다', () => {
    for (const weeks of [0, 1, 2, 3, 9]) {
      const count = valuableDroughtHeadlineCount(weeks)
      expect(formatValuableDroughtHeadline(weeks, count)).toBe(
        formatValuableDroughtHeadline(weeks, 0),
      )
      expect(formatValuableDroughtHeadline(weeks, -1)).toBe(
        formatValuableDroughtHeadline(weeks, count - 1),
      )
    }
  })

  it('index를 주지 않으면 항상 같은 문구다. 렌더마다 깜빡이지 않게 하는 기본값', () => {
    expect(formatValuableDroughtHeadline(9)).toBe(formatValuableDroughtHeadline(9))
    expect(formatValuableDroughtHeadline(0)).toBe(formatValuableDroughtHeadline(0, 0))
  })
})

// 화면이 무작위 인덱스를 고르려면 **그 단계의** 풀 크기를 알아야 한다. 마지막 단계만 알려주던 상수
// (`VALUABLE_DROUGHT_LATE_HEADLINE_COUNT`)로는 모자라 함수가 됐다.
describe('valuableDroughtHeadlineCount', () => {
  it('단계마다 자기 풀 크기를 준다', () => {
    expect([0, 1, 2, 3, 4].map(valuableDroughtHeadlineCount)).toEqual([3, 2, 3, 2, 5])
  })

  it('마지막 단계로 묶이는 주 수는 모두 같은 크기다', () => {
    expect([4, 5, 16, 200].map(valuableDroughtHeadlineCount)).toEqual([5, 5, 5, 5])
  })
})

describe('formatValuableDroughtItems', () => {
  it('하나면 그 이름만', () => {
    expect(formatValuableDroughtItems([record({ itemName: '루즈 컨트롤 머신 마크' })])).toBe(
      '루즈 컨트롤 머신 마크',
    )
  })

  it('여럿이면 첫 항목 + "외 N개"전부 나열하면 한 줄을 넘긴다', () => {
    expect(
      formatValuableDroughtItems([
        record({ itemName: '루즈 컨트롤 머신 마크' }),
        record({ itemName: '창세의 뱃지' }),
        record({ itemName: '생명의 연마석' }),
      ]),
    ).toBe('루즈 컨트롤 머신 마크 외 2개')
  })

  it('비면 빈 문자열. 호출부가 부재를 판단한다', () => {
    expect(formatValuableDroughtItems([])).toBe('')
  })
})
