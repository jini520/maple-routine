/**
 * 컨텐츠 항목의 짧은 이름을 내는 함수. today 의 남은 스케줄이 항목을 낱개로 세울 때 쓴다.
 *
 * ```
 * [일일 퀘스트] 소멸의 여로 조사      →  소멸의 여로
 * [주간 퀘스트] 크리티아스 주간 임무  →  크리티아스
 * ```
 *
 * **두 축이 다른 규칙을 쓴다.** 일일은 지역명까지 줄인다. 지역당 하나뿐이라 안 겹치고 뒷말이 정보를
 * 안 더한다. 주간은 접두어만 뗀다. 같은 지역에 둘이 있어 **그 뒷말이 곧 구분**이라, 지역명까지
 * 줄이면 두 항목이 한 글자로 접혀 같은 칩이 둘 선다.
 *
 * 그 밖의 이름(`에픽 던전 : 하이마운틴` · `[길드] 지하 수로`)은 손대지 않는다. 줄이는 규칙을 새로
 * 지어내면 어디까지 맞는지 아무도 확인한 적 없는 값이 된다. 그 이름들은 이미 짧다.
 */

import {
  matchDailyQuestRegion,
  stripDailyQuestPrefix,
  stripWeeklyQuestPrefix,
} from '../../lib/scheduler/quest-region-matching'

export function shortDailyContentName(name: string): string {
  const stripped = stripDailyQuestPrefix(name)
  return matchDailyQuestRegion(stripped) ?? stripped
}

export function shortWeeklyContentName(name: string): string {
  return stripWeeklyQuestPrefix(name)
}
