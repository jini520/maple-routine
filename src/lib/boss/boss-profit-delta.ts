import type { BossCycle } from '../../types'
import { getAdjacentPeriodKey, getWeeklyPeriodKeysInMonth } from './boss-profit-period'

/**
 * 보스 수익 "직전 기간 대비 증감" 계산.
 *
 * **이 모듈에는 "모른다"라는 입력이 없다.** 직전 기간을 조회한 적이 없어도 store 가 기록 합(= 0)을
 * 넘긴다(결정 3, 사용자 결정) — 0메소와 미확인을 같은 표기로 통일했기 때문이다. 그 대가로 증감
 * 표시가 기간 상태 기계에서 완전히 분리되고, 여기서는 두 숫자만 다룬다.
 */

export interface ProfitDelta {
  /** 'same' 이면 방향 표식을 그리지 않는다 — 표기 "-" 자체가 표식이라 대시 아이콘까지 얹으면 겹친다. */
  direction: 'up' | 'down' | 'same'
  /** 직전 기간이 0이면 나눌 수 없어 `null` — 그때는 절대 증감이 표시를 대신한다. 부호를 유지한다. */
  percent: number | null
  diffMeso: number
}

export function computeProfitDelta(currentMeso: number, previousMeso: number): ProfitDelta {
  const diffMeso = currentMeso - previousMeso
  if (diffMeso === 0) {
    return { direction: 'same', percent: 0, diffMeso: 0 }
  }
  const direction = diffMeso > 0 ? 'up' : 'down'
  // 0으로 나누지 않는다. 직전이 0이면 "몇 배"가 정의되지 않으므로 퍼센트를 포기하고 금액으로 말한다.
  const percent = previousMeso === 0 ? null : (diffMeso / previousMeso) * 100
  return { direction, percent, diffMeso }
}

/**
 * 큰 메소를 억/만으로 접는다. 칩 한 칸에 10자리가 그대로 들어가면 금액 자체를 밀어낸다.
 * `withSign` 이 false 인 이유는 호출부가 화살표를 이미 그리기 때문이다 — `↑ +12.8억` 은 두 번 말한다.
 */
export function formatMesoShort(meso: number, withSign = false): string {
  const sign = !withSign ? '' : meso > 0 ? '+' : meso < 0 ? '−' : ''
  const absolute = Math.abs(meso)
  if (absolute >= 100_000_000) return `${sign}${(absolute / 100_000_000).toFixed(1)}억`
  if (absolute >= 10_000) return `${sign}${Math.round(absolute / 10_000).toLocaleString()}만`
  return `${sign}${absolute.toLocaleString()}`
}

/** 칩 안에 들어가는 글자. 같으면 사용자 지정 "-", 퍼센트가 없으면 절대 증감이 대신한다. */
export function formatProfitDeltaBody(delta: ProfitDelta): string {
  if (delta.direction === 'same') return '-'
  if (delta.percent === null) return formatMesoShort(delta.diffMeso)
  return `${Math.abs(delta.percent).toFixed(1)}%`
}

/**
 * 스크린리더용 문장. 화살표는 `aria-hidden` 이고 색은 의미를 전하지 못하므로 여기서 다시 말한다.
 * `periodLabel` 은 비교 대상 기간의 이름("지난 주"·"지난 달"·"6월 3주차" 등)이다.
 */
export function formatProfitDeltaLabel(delta: ProfitDelta, periodLabel: string): string {
  // "{기간}와 동일"로 쓰지 않는다 — 기간 이름은 "지난 달"(받침 있음)일 수도 "7월 3주차"(없음)일 수도
  // 있어 와/과가 갈리는데, 그 조사 계산을 위해 여기서 한글 음절을 파고들 이유가 없다. 다른 분기와
  // 같은 "대비" 어법으로 맞추면 조사 문제 자체가 사라진다.
  if (delta.direction === 'same') return `${periodLabel} 대비 변화 없음`
  const word = delta.direction === 'up' ? '증가' : '감소'
  if (delta.percent === null) {
    return `${periodLabel}에는 수익이 없었습니다. ${formatMesoShort(delta.diffMeso)} 메소 ${word}`
  }
  return `${periodLabel} 대비 ${Math.abs(delta.percent).toFixed(1)}퍼센트 ${word}`
}

/**
 * 직전 기간의 합계를 구하려면 어떤 periodKey 들을 읽어야 하는지.
 *
 * **그 화면의 총액 산식과 짝을 맞춘다** — 월간 탭 총액은 `monthly` 보스 행 + 그 달의 주차별 합계라
 * (`groupTotalMeso`), 직전 달 합계도 `직전 달 monthly 기록 + 직전 달에 속한 weekly 기록`이다.
 * 주간 탭은 직전 주 하나뿐이다.
 */
export function getComparisonPeriodKeys(tab: BossCycle, periodKey: string): string[] {
  const previousKey = getAdjacentPeriodKey(tab, periodKey, 'prev')
  if (tab === 'weekly') {
    return [previousKey]
  }
  return [previousKey, ...getWeeklyPeriodKeysInMonth(previousKey)]
}
