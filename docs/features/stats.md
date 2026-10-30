# 통계

보스 수익과 가계부에 쌓인 기록을 기간 단위로 모아 보는 화면이다. 수익·지출 그룹의 세 번째 하위 탭이고,
기록을 읽기만 한다. 왜 이렇게 만들었는지는 [[ADR-002]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app/stats/StatsScreen.tsx` | 머리(주간 · 월간) · 기간 줄 · 카드 일곱. 전 기간의 줄을 `ledgerDays` 쿼리로 든다 |
| `app/stats/StatsSection.tsx` | 카드 틀 |
| `app/stats/TrendSection.tsx` · `CharacterSection.tsx` · `CategorySection.tsx` · `BossSection.tsx` · `CumulativeSection.tsx` | 카드 |
| `lib/stats/slice-steps.ts` | 도넛 조각의 명도 단계 · `그 외` 색 · 조각 안 글자색과 조각 수 상한. today 이번 주 수익 도넛도 쓴다 |
| `app/stats/StatsSkeleton.tsx` | 값을 읽는 동안의 스켈레톤 |
| `app/stats/reveal.ts` | 화면에 들어온 카드의 그래프를 자라게 하는 진행값 |
| `features/stats/aggregate.ts` | 합계 · 추이 · 누적 · 캐릭터별 · 항목별 · 보스별 집계 |
| `features/stats/periods.ts` | 고른 기간에서 추이 범위(8주 · 6개월)와 누적 범위를 만든다 |
| `features/stats/load.ts` | 캐릭터 그림 주소 · 누적 시작 날짜 |
| `features/cashbook/ledger-query.ts` | 날짜별 줄 쿼리 `ledgerDays(from, to)`. 기록 표의 판이 오르면 다시 읽는다([[ADR-142]] 결정 6) |
| `storage/stats-cumulative-start.ts` | 누적 시작 날짜(Preferences `statsCumulativeStart`) |
| `theme/theme-vars.ts` 의 `resolveStatsSection` | 카드 바탕색 |
| `navigation/bar-groups.ts` · `navigation/routes.ts` | 수익·지출 그룹의 세 번째 하위 탭(`Stats`, `/stats`) |

## 화면

머리에서 주간 · 월간을 고르고, 기간 줄에서 기간을 옮긴다. 모든 카드가 이 기간 하나를 따른다.

| 카드 | 보여 주는 것 | 누르면 |
|---|---|---|
| 순 수익 | 수입 − 지출, 옆에 수입 · 지출 | |
| 추이 | 주간 8주 · 월간 6개월 막대, 구간 평균 | 막대: 그 기간 값 말풍선 |
| 캐릭터별 | 캐릭터마다 가로 막대, 상위 세 명 단상 | |
| 수입 내역 | 반원 도넛(보스 결정석 · 보스 드롭 · 아이템 판매 · 사냥 · 기타) | 조각: 세부 줄 팝오버 |
| 지출 내역 | 반원 도넛(강화 다섯 · 손으로 적은 지출 분류) | 조각: 세부 줄 팝오버 |
| 보스별 수익 | 초상화 타일 가로 스크롤, 난이도별 · 보스별 | |
| 누적 순수익 | 큰 숫자, 누적 선, 시작 날짜 알약 | 선: 그 기간까지의 누적 · 알약: 시작 날짜 고르기 |

넥슨이 결산 중이면 머리글 아래에 today 와 같은 안내 줄이 선다. 통계는 처치 날짜가 있는 기록만 세는데, 결산 중에는
날짜를 정하는 조회가 막혀서 자정 뒤에 잡은 보스가 아직 반영되지 않는다. 그래서 둘째 줄에
`오늘 잡은 보스 수익은 결산이 끝난 뒤 반영됩니다.` 를 적는다.

## 금액을 세는 기준

가계부와 같다. 메포는 시세로 환산해 넣고 캐시는 뺀다. 강화 금액은 읽을 때 계산하고, 계산하지 못한 기록은 뺀다.
보스 금액은 내 몫의 결정석이고 완료하지 않은 보스 행은 뺀다. 자세한 기준은 [[ADR-002]] 결정 13 에 있다.
