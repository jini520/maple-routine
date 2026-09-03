import { isObtainableDrop } from '../boss/boss-drops'
import { getCurrentBossProfitPeriod } from '../boss/boss-profit-period'
import { isValuableDrop } from './valuable-drops'
import type { BossCycle } from '../../types'
import type { RecordedDrop } from '../../types/drops'
import type { BossDifficulty } from '../../types/scheduler'

// 드롭 획득 히스토리(전 기간)의 순수 집계.
//
// 핵심 규약 하나. 드롭이 일어난 시점은 `periodKey` 이고 `recordedAt` 이 아니다. `recordedAt` 은
// 이 그룹을 마지막으로 쓴 시각이라 드롭 하나를 더 추가하면 기존 드롭들의 값까지 오늘로
// 갱신된다. 그래서 이 파일은 그 필드를 아예 받지 않는다.

/**
 * SQLite `boss_drop_records` 한 행에서 이 집계에 필요한 부분만 추린 모양. `recordedAt` 이 없는 것이
 * 의도다(위 규약). 저장 계층 타입을 쓰지 않는 이유는 `lib/` 가 `storage/` 를 의존하지 않기 위함이고
 * `RecordedDrop` 을 상속하는 형태는 `StoredDropRecord`(`lib/boss/boss-drops`)와 같은 관례다
 * 그래야 드롭 아이콘 스택·획득 가능 판정에 그대로 넘길 수 있다.
 */
export interface DropHistoryRecord extends RecordedDrop {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
}

export interface DropHistoryPeriodGroup {
  periodKey: string
  cycle: BossCycle
  records: DropHistoryRecord[]
}

export interface ValuableDroughtSummary {
  /** 마지막으로 고가 아이템을 먹은 기간 */
  periodKey: string
  cycle: BossCycle
  /** 그 기간 이후 지난 주 수(달력 기준). 0이면 이번 주에 먹었다는 뜻 */
  weeksSince: number
  /** 그 기간의 고가 기록. 아이콘 스택 표시용 */
  records: DropHistoryRecord[]
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * `periodKey` 형식이 주기를 말해준다. 주간은 리셋일 `YYYY-MM-DD`(3토막), 월간은 `YYYY-MM`(2토막).
 * 히스토리는 두 주기를 한 목록에 섞으므로 행마다 이 판정이 필요하다(기간 라벨 포맷이 갈린다).
 */
export function getPeriodCycle(periodKey: string): BossCycle {
  return periodKey.split('-').length === 3 ? 'weekly' : 'monthly'
}

/**
 * `periodKey` 가 가리키는 기간의 **시작 시점**(UTC ms). 주간은 그 리셋일 00:00 KST, 월간은 그 달
 * 1일 00:00 KST.
 *
 * 왜 필요한가: 두 형식을 문자열로 비교하면 시간순이 아니다. `'2026-07-09' >
 * '2026-07'` 이라 월간 7월이 그 달 주차들보다 뒤로 밀린다. 한 축(시점)으로 환산해야 섞어 정렬할 수
 * 있고, 미획득 주 수도 이 시점 차이로 센다.
 */
export function getPeriodStartUtcMs(periodKey: string): number {
  const [year, month, day] = periodKey.split('-').map(Number)
  return Date.UTC(year, month - 1, day ?? 1) - KST_OFFSET_MS
}

/**
 * 한국어 목적격 조사(을/를)를 마지막 한글 음절의 종성 유무로 고른다.
 *
 * "을(를)"로 도망가지 않는 이유: 히스토리 한 줄은 게임 로그 같은 완성된 문장이라("…가디언 엔젤링을
 * 획득하였습니다") 괄호 병기가 그 톤을 깬다.
 *
 * **마지막 글자가 아니라 마지막 한글 음절을 본다**. 슬롯별로 갈라진 익셉셔널 해머는 `)` 로 끝나고
 *  수량·레벨을 붙이면 숫자가 섞인다.
 */
export function objectParticle(word: string): '을' | '를' {
  const HANGUL_BASE = 0xac00
  const JONGSEONG_COUNT = 28

  for (let index = word.length - 1; index >= 0; index--) {
    const code = word.charCodeAt(index)
    if (code >= HANGUL_BASE && code <= 0xd7a3) {
      return (code - HANGUL_BASE) % JONGSEONG_COUNT === 0 ? '를' : '을'
    }
  }
  return '을'
}

/**
 * 줄바꿈을 금지하는 zero-width 문자(WORD JOINER, U+2060).
 *
 * `word-break: keep-all` 은 **글자 사이** 줄바꿈만 막는다. 괄호는 UAX #14 에서 그 자체가 줄바꿈
 * 지점이라(닫는 괄호 뒤·여는 괄호 앞) 그대로 두면 "가디언 엔젤 슬라임(카오스)⏎에서" 로 끊긴다
 * (브라우저 실측 2026-07-31). 띄어쓰기만 줄바꿈 기준이 되게 하려면 그 두 지점을 막아야 한다.
 *
 * 보이지 않는 문자라 `textContent` 비교에는 섞여 들어온다. 테스트는 이 문자를 걷어내고 비교한다.
 */
export const WORD_JOINER = '⁠'

/** 히스토리 한 줄을 강조 대상(상자명·아이템)만 떼어 나눈 것. */
export interface DropHistoryLine {
  /** 아이템 앞. "지내우시님이 가디언 엔젤 슬라임(카오스)에서 " */
  prefix: string
  /**
   * 상자 개봉 결과일 때만 있다. 상자명도 아이템처럼 강조 대상이라 문장에서 떼어 준다.
   * `connector` 는 상자명 뒤 연결부(`를 열어 `)로, 조사가 붙어 있어 화면이 한국어 문법을
   * 계산할 필요가 없다.
   */
  box?: { name: string; connector: string }
  /** 강조 대상. "가디언 엔젤링", "리스트레인트 링 3레벨", "주문의 흔적 240개" */
  item: string
  /**
   * 아이템에 붙는 목적격 조사. **`item` 과 따로 주는 이유**: 고가 아이템은 화면이 `item` 을 골드
   * pill(inline-flex)로 감싸는데, 원자적 인라인 박스는 그 경계에 줄바꿈 지점을 만든다. 한 덩어리로
   * 넘기면 조사만 다음 줄로 떨어져 "…마크 / 를 획득하였습니다" 가 된다. 화면이 pill 과 조사를 함께
   * 묶어 그리도록 조각을 나눠 준다.
   */
  particle: '을' | '를'
  /** 서술부. " 획득하였습니다." (앞 공백 포함. 여기서는 줄바꿈해도 된다) */
  suffix: string
}

/**
 * 기록 한 건을 한 줄 문장으로 만든다.
 * `지내우시님이 가디언 엔젤 슬라임(카오스)에서 가디언 엔젤링을 획득하였습니다.`
 *
 * 아이콘·난이도 배지·2단 레이아웃을 쓰지 않고 문장 하나로 두는 것이 요점이다. 한 기록이
 * 목록에서 큰 비중을 차지하지 않게 하려는 것이다. 고가 아이템만 화면이 `item` 조각을 골드로
 * 감싸 꾸미므로 이 함수는 `item` 을 따로 반환한다. 문자열 하나로 합쳐 주면 강조할 수 없다.
 *
 * `characterName` 이 없으면(캐시 미스) 이름 부분을 비운다. ocid 는 사용자에게 뜻이 없는
 * 값이라 대신 넣지 않는다.
 */
export function formatDropHistoryLine(
  record: DropHistoryRecord,
  characterName: string | undefined,
): DropHistoryLine {
  const who = characterName === undefined ? '' : `${characterName}님이 `
  // 상자 개봉 결과는 어떤 상자를 열었는지가 기록의 절반이다. 아이템 앞에 두되 상자명도
  // 강조 대상이라 따로 뗀다. 강조가 둘이어도 **가치를 정하는 쪽은 결과**라 pill(고가 판정)은 결과에만
  // 붙고 상자명은 굵기만 받는다.
  const box =
    record.boxOrigin === undefined
      ? undefined
      : { name: record.boxOrigin, connector: `${objectParticle(record.boxOrigin)} 열어 ` }

  const level = record.ringLevel === undefined ? '' : ` ${record.ringLevel}레벨`
  // 수량 1은 말하지 않는다. "주문의 흔적 240개"처럼 실제로 여러 개인 것만 센다.
  const count = record.quantity > 1 ? ` ${record.quantity}개` : ''
  const item = `${record.itemName}${level}${count}`

  // 난이도 괄호 양옆을 word joiner 로 묶는다. 괄호가 줄바꿈 지점이라 "슬라임(카오스)⏎에서" 로
  // 갈리는 것을 막는다(위 WORD_JOINER 주석).
  const where = `${record.boss}${WORD_JOINER}(${record.difficulty})${WORD_JOINER}에서`

  return {
    prefix: `${who}${where} `,
    box,
    item,
    particle: objectParticle(item),
    suffix: ' 획득하였습니다.',
  }
}

/** 획득 불가 판정·확정 난이도 조회에 쓰는 조합 키. */
export function confirmedDropKey(
  ocid: string,
  boss: string,
  difficulty: string,
  periodKey: string,
): string {
  return `${ocid}|${boss}|${difficulty}|${periodKey}`
}

/**
 * 기록을 기간별로 묶어 **최신 기간이 먼저** 오게 정렬한다.
 *
 * 같은 기간 안의 순서는 입력 순서를 그대로 보존한다. 조회 SQL(`period_key DESC, ocid, boss,
 * difficulty, drop_index`)이 정한 순서가 표시 순서이고, `Array.prototype.sort` 는 안정 정렬이라
 * 기간 단위로 재배열해도 그룹 내부가 흐트러지지 않는다.
 */
export function groupDropRecordsByPeriod(records: DropHistoryRecord[]): DropHistoryPeriodGroup[] {
  const byPeriodKey = new Map<string, DropHistoryPeriodGroup>()

  for (const record of records) {
    let group = byPeriodKey.get(record.periodKey)
    if (group === undefined) {
      group = { periodKey: record.periodKey, cycle: getPeriodCycle(record.periodKey), records: [] }
      byPeriodKey.set(record.periodKey, group)
    }
    group.records.push(record)
  }

  return [...byPeriodKey.values()].sort(
    (a, b) => getPeriodStartUtcMs(b.periodKey) - getPeriodStartUtcMs(a.periodKey),
  )
}

/**
 * 그 난이도에서 획득 불가한 기록을 거른다. **처치 난이도가 확정된 조합만**.
 *
 * 보스 수익 화면의 정리(`pruneUnobtainableDrops`)는 화면에 뜬 기간에서만 lazy 하게 돌아, 한 번도
 * 열지 않은 과거 기간에는 정리되지 않은 행이 남아 있다. 히스토리가 그걸 보여주면 같은 기록을 한
 * 화면은 거부하고 다른 화면은 보여주는 셈이라, 같은 술어를 표시 시점에 한 번 더 적용한다.
 *
 * `confirmedKeys` 밖의 조합은 손대지 않는다. 익스트림으로 등록해두고 실제로는 하드를 잡아 하드
 * 전용 아이템을 기록한 경우, 등록 난이도로 걸러버리면 나중에 난이도가 확정되면 이관되어 **살아남을**
 * 기록을 미리 숨기게 된다.
 *
 * **쓰지 않는다**. 거르기만 하고 DB 정리는 기존 lazy 경로에 맡긴다(읽기 화면에 쓰기를 넣지 않는다).
 */
export function filterUnobtainableConfirmedDrops(
  records: DropHistoryRecord[],
  confirmedKeys: Set<string>,
): DropHistoryRecord[] {
  return records.filter((record) => {
    if (!confirmedKeys.has(confirmedDropKey(record.ocid, record.boss, record.difficulty, record.periodKey))) {
      return true
    }
    return isObtainableDrop(record.boss, record.difficulty as BossDifficulty, record)
  })
}

/**
 * 마지막으로 고가 아이템을 먹은 기간과 그 뒤로 지난 주 수.
 *
 * - 고가 전체를 하나로 집계한다. 아이템별·세트별로 나누면 칠흑·광휘 구성원 수십 종이 대부분
 *   기록 없음 으로 채워져 정보가 아니라 소음이 된다.
 * - 달력 주 경과로 센다. 그 사이 실제로 처치한 주만 이 더 정확해 보이지만 백필 안 된 과거
 *   주는 처치 여부를 알 수 없어 셀 수도 뺄 수도 없는 주가 생긴다.
 * - 고가 여부는 화면 배지들과 같은 술어(`isValuableDrop(itemName)`)를 쓴다. 상자 개봉 결과는
 *   상자명이 아니라 나온 아이템 이름으로 판정된다.
 * - 고가 기록이 없으면 `null`. 기준점이 없는데 기간을 만들어내지 않는다.
 */
/**
 * 미획득이 길어질수록 요약이 점점 슬퍼지는 단계.
 *
 * 단계는 문구(여기)와 시각 표현(화면의 잎 색·기울기·투명도)이 함께 쓴다. 값 하나가 두 축을
 * 같이 움직여야 색은 슬픈데 문구는 신난 어긋남이 생기지 않는다.
 *
 * 0단계(이번 주 획득)가 기쁨의 기준점이다. 이게 없으면 아래 단계가 슬픔이 아니라 그냥 흐린
 * 화면으로 읽힌다.
 *
 * 경계값은 실제 물욕템 체감 주기가 아니라 구현자가 잡은 기본값이다. 바꿀 땐 이 배열 하나만
 * 고치면 문구·시각 표현이 함께 따라온다.
 */
/**
 * 문구는 **사용자가 직접 지정했다**(2026-08-01 다섯 줄 · 2026-08-17 추가 여섯 줄). 아이템 드롭 가뭄에
 * 대한 플레이어 반응을 단계로 옮긴 것이라 구현자가 톤을 다듬지 않는다.
 *
 * **단계마다 문구가 풀이다**. 처음엔 마지막 단계만 여럿이었는데, today 의
 * 위젯이 같은 요약을 자주 띄우게 되면서 전 단계로 넓혔다. 각 풀의 **첫 항목이 원래 있던 문구**라
 * 인덱스를 주지 않은 호출은 예전과 같은 문구를 준다.
 *
 * **무작위 선택은 이 파일이 하지 않는다.** `Math.random()` 을 여기서 부르면 순수 함수가 아니게 되고
 * 테스트가 값을 고정할 수 없다. 화면이 인덱스를 골라 넘긴다(마운트당 한 번. 매 렌더마다 고르면
 * 리렌더 때 문구가 깜빡인다).
 *
 * `maxWeeks` 는 **미획득 주 수**(`weeksSince`)다. 사용자가 말한 "N주차"보다 하나 작다(1주차 = 먹은
 * 그 주 = 0주 미획득).
 */
const VALUABLE_DROUGHT_TIERS: readonly { maxWeeks: number; headlines: readonly string[] }[] = [
  { maxWeeks: 0, headlines: ['와따리! ㅇㄱㄱㄷ', '완전 럭키비키잖아', '폼 미쳤다'] },
  { maxWeeks: 1, headlines: ['그래, 그럴 수 있지', '다음 주엔 되겠지'] },
  { maxWeeks: 2, headlines: ['어?! 슬슬 쫌 그래!?', '슬슬 킹받는데', '이게 맞나?'] },
  { maxWeeks: 3, headlines: ['선넘네?!', '이게 억까지 뭐야'] },
  {
    // 마지막 단계(4주 이상). 애원 · 포기 · 자기검열. 분노 다음에 오는 감정들이다.
    maxWeeks: Number.POSITIVE_INFINITY,
    headlines: ['이건 아니지...', '적당히 해!', '제발 한 번만...', '이제 기대도 안 해', '내가 뭘 잘못했나'],
  },
]

/**
 * 그 단계의 문구 개수. 화면이 이 범위에서 인덱스를 무작위로 고른다.
 *
 * 단계마다 풀 크기가 달라 "마지막 단계 개수" 상수로는 모자란다. 인덱스를 감싸므로
 * 틀린 개수를 줘도 문구는 나오지만, 그러면 뽑히지 않는 문구가 생긴다.
 */
export function valuableDroughtHeadlineCount(weeksSince: number): number {
  return VALUABLE_DROUGHT_TIERS[getValuableDroughtTier(weeksSince)].headlines.length
}

/** 미획득 주 수 → 슬픔 단계(0 = 이번 주 획득, 4 = 가장 슬픔). 화면이 이 값으로 잎 색·기울기를 고른다. */
export function getValuableDroughtTier(weeksSince: number): number {
  const index = VALUABLE_DROUGHT_TIERS.findIndex((tier) => weeksSince <= tier.maxWeeks)
  return index === -1 ? VALUABLE_DROUGHT_TIERS.length - 1 : index
}

/**
 * 요약 제목. 단계마다 문구가 여럿이라 `index` 로 고른다. 범위를 벗어난 값은 감싸므로 호출부가
 * 경계를 신경 쓰지 않아도 된다(기본값 0이라 인덱스를 안 주면 항상 그 단계의 원래 문구다).
 */
export function formatValuableDroughtHeadline(weeksSince: number, index = 0): string {
  const { headlines } = VALUABLE_DROUGHT_TIERS[getValuableDroughtTier(weeksSince)]
  const count = headlines.length
  return headlines[((index % count) + count) % count]
}

/**
 * 마지막에 먹은 고가 아이템 이름. 그 주에 여럿이면 첫 항목 + "외 N개" 로 줄인다. 전부 나열하면 한
 * 줄(요약의 아래 줄)을 넘긴다. 비면 빈 문자열이고 부재 판단은 호출부가 한다.
 */
export function formatValuableDroughtItems(records: DropHistoryRecord[]): string {
  if (records.length === 0) return ''
  const [first, ...rest] = records
  return rest.length === 0 ? first.itemName : `${first.itemName} 외 ${rest.length}개`
}

export function summarizeValuableDrought(
  records: DropHistoryRecord[],
  now: Date,
): ValuableDroughtSummary | null {
  const valuable = records.filter((record) => isValuableDrop(record.itemName))
  if (valuable.length === 0) {
    return null
  }

  let latestPeriodKey = valuable[0].periodKey
  let latestStartMs = getPeriodStartUtcMs(latestPeriodKey)
  for (const record of valuable) {
    const startMs = getPeriodStartUtcMs(record.periodKey)
    if (startMs > latestStartMs) {
      latestPeriodKey = record.periodKey
      latestStartMs = startMs
    }
  }

  // 기준점은 "지금 주차"의 시작이다. 주간 키끼리는 차이가 정확히 주 단위로 떨어지고, 월간 키처럼
  // 주 경계에 걸리는 시작점은 내림해 "적어도 N주"로 말한다.
  const currentWeekStartMs = getPeriodStartUtcMs(getCurrentBossProfitPeriod('weekly', now).periodKey)
  const weeksSince = Math.max(0, Math.floor((currentWeekStartMs - latestStartMs) / WEEK_MS))

  return {
    periodKey: latestPeriodKey,
    cycle: getPeriodCycle(latestPeriodKey),
    weeksSince,
    records: valuable.filter((record) => record.periodKey === latestPeriodKey),
  }
}
