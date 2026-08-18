/**
 * 컨텐츠 항목의 **짧은 이름** — today 의 「남은 스케줄」 아코디언이 항목을 낱개로 세울 때 쓴다.
 *
 * 원문은 한 줄에 여러 개를 세울 수 없다:
 *
 *   `[일일 퀘스트] 소멸의 여로 조사`  →  `소멸의 여로`
 *   `[주간 퀘스트] 크리티아스 주간 임무`  →  `크리티아스`
 *
 * ## 지역명까지만 줄인다 — 그 밖은 접두어만 뗀다
 *
 * 「지역명만 써도 된다」는 사용자 지정이고, 그 판정은 이미 있는 지역 매칭([[ADR-020]])이 그대로
 * 한다. 그 밖의 이름(`에픽 던전 : 하이마운틴` · `[메이플 유니온] 주간 드래곤 퇴치` ·
 * `[길드] 지하 수로`)은 **손대지 않는다** — 줄이는 규칙을 새로 지어내면 그 규칙이 어디까지 맞는지
 * 아무도 확인한 적이 없는 값이 된다([[ADR-006]] 의 태도). 실제로 그 이름들은 이미 짧다.
 *
 * ## 카드가 쓰는 이름과 다를 수 있다
 *
 * 컨텐츠 카드는 배경·배지까지 함께 정하느라 자기 표기를 갖는다(`content-badges` 계열). 여기서는
 * **아코디언 한 줄에 들어가는 글자**만 필요하므로 그 분기를 따라가지 않는다. 둘이 갈리면 그때
 * 표기를 하나로 모으는 것이 맞고, 그 판단은 이 파일이 아니라 화면의 일이다.
 */

import { matchDailyQuestRegion, stripDailyQuestPrefix } from '@core/lib/daily-quest-matching'
import { matchWeeklyQuestRegion, stripWeeklyQuestPrefix } from '@core/lib/weekly-quest-matching'

export function shortDailyContentName(name: string): string {
  const stripped = stripDailyQuestPrefix(name)
  return matchDailyQuestRegion(stripped) ?? stripped
}

export function shortWeeklyContentName(name: string): string {
  const stripped = stripWeeklyQuestPrefix(name)
  return matchWeeklyQuestRegion(stripped) ?? stripped
}
