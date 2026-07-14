# Step 0: period-lib

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 "ADR-023: 보스 수익 계산기 → "보스 수익" 페이지 개편" 전체 (결정 3, 5번 — 기간 네비게이터 라벨 규칙, 월간 탭 주차별 합계 구성)
- `/docs/UI_GUIDE.md`의 "보스 수익 — 주간/월간 탭 + 기간 네비게이터" 섹션 (기간 라벨 규칙: 최근 2개 기간만 상대 표현 "이번 주"/"지난 주"·"이번 달"/"지난 달", 그 이전은 "OO월 N주차" 또는 "OO년 O월")
- `src/lib/boss-profit-period.ts` (이번 step에서 확장할 파일 — 기존 `getCurrentBossProfitPeriod`를 그대로 두고 함수를 추가한다)
- `src/lib/__tests__/boss-profit-period.test.ts` (기존 테스트 스타일)
- `src/lib/reset-clock.ts` (`getMostRecentWeeklyResetKst` — KST 벽시계 계산 방식을 그대로 따른다: 로컬 타임존 getter를 쓰지 않고 절대 epoch에 KST 오프셋을 더한 뒤 UTC getter로 읽는다)
- `src/types/scheduler.ts` (`BossCycle` 타입)

## 작업

`src/lib/boss-profit-period.ts`에 아래 함수들을 추가하라. 기존 `getCurrentBossProfitPeriod`·`toKstWallClock`·`pad`는 그대로 재사용한다(중복 구현 금지).

```ts
/** periodKey를 한 칸 이동한다. weekly는 ±7일, monthly는 ±1개월. */
export function getAdjacentPeriodKey(
  cycle: BossCycle,
  periodKey: string,
  direction: 'prev' | 'next',
): string

/** periodKey가 now 기준 "현재" 기간(getCurrentBossProfitPeriod의 periodKey)보다 미래가 아닌지 확인한다.
 * true면 이 기간에서 next 방향 네비게이션 버튼을 비활성화해야 한다. */
export function isLatestPeriod(cycle: BossCycle, periodKey: string, now: Date): boolean

export interface BossProfitPeriodLabel {
  primary: string // "이번 주" | "지난 주" | "이번 달" | "지난 달" | "{M}월 {N}주차" | "{YYYY}년 {M}월"
  secondary: string // weekly: "{M}월 {D}일 ~ {M}월 {D}일" (그 주의 시작~끝 날짜), monthly: "{YYYY}년 {M}월" — primary와 무관하게 항상 정확한 날짜를 담는다
}

/** 기간 라벨을 계산한다. now 기준 최근 2개 기간(이번/지난)만 상대 표현을 쓰고, 그 이전은 절대 표현을 쓴다. */
export function formatBossProfitPeriodLabel(
  cycle: BossCycle,
  periodKey: string,
  now: Date,
): BossProfitPeriodLabel

/** monthPeriodKey(형식 "YYYY-MM")가 속한 달 안에 리셋(목요일)이 있는 weekly periodKey 목록을 오름차순으로 반환한다.
 * "주가 두 달에 걸치면 그 주가 시작하는 목요일이 속한 달 기준"이라는 규칙은 이미 weekly periodKey 정의(리셋 목요일의 KST 날짜) 자체에
 * 반영되어 있으므로, 이 함수는 단순히 그 달의 모든 목요일 날짜를 나열하면 된다. */
export function getWeeklyPeriodKeysInMonth(monthPeriodKey: string): string[]

/** 과거 기간 백필(스케줄러 API의 date 파라미터 조회) 시 사용할 조회 날짜(YYYY-MM-DD)를 계산한다.
 * 그 기간의 완료 현황이 가장 온전히 반영되는 시점 — 다음 리셋 직전(그 기간의 마지막 날) — 을 쓴다.
 * weekly: periodKey(리셋 목요일) + 6일. monthly: periodKey가 속한 달의 마지막 날. */
export function getBackfillQueryDate(cycle: BossCycle, periodKey: string): string
```

구현 시 유의할 점:

- `getAdjacentPeriodKey`의 weekly 이동은 periodKey 문자열("YYYY-MM-DD")을 `Date.UTC`로 파싱해 ±7일(`7 * 24 * 60 * 60 * 1000`ms)만큼 이동한 뒤 다시 "YYYY-MM-DD"로 포맷하면 된다 — `now`나 KST 오프셋 변환이 다시 필요 없다(periodKey 자체가 이미 KST 캘린더 날짜 문자열이기 때문).
- monthly 이동은 periodKey("YYYY-MM")을 파싱해 월을 ±1 하고, 12월→1월/1월→12월 경계에서 연도를 함께 조정한다.
- `formatBossProfitPeriodLabel`의 "N주차" 계산: weekly periodKey(목요일 날짜)가 속한 달의 1일부터 그 날짜까지 몇 번째 목요일인지 센다(`getWeeklyPeriodKeysInMonth`를 활용해도 좋다).
- 문자열 periodKey는 그대로 사전식 비교(`<`, `>`)가 가능하다(둘 다 zero-padded, "YYYY-MM-DD"/"YYYY-MM") — `isLatestPeriod`에서 날짜 파싱 없이 문자열 비교로 구현할 수 있다.
- 이 함수들은 전부 순수 함수다. `Date`는 인자로만 받고 내부에서 `new Date()`를 호출하지 마라(테스트 가능성).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `lib/` 레이어에만 변경이 있는가(다른 레이어를 건드리지 않았는가)?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/lib/__tests__/boss-profit-period.test.ts`에 케이스를 추가해 다음을 검증하라:
   - `getAdjacentPeriodKey('weekly', '2026-07-09', 'next')` === `'2026-07-16'`, `'prev'` === `'2026-07-02'`
   - `getAdjacentPeriodKey('monthly', '2026-07', 'next')` === `'2026-08'`, `'prev'` === `'2026-06'`, 연도 경계(`'2026-12'` → next `'2027-01'`, `'2026-01'` → prev `'2025-12'`)
   - `isLatestPeriod`: `now` 기준 현재 주(달)의 periodKey는 `true`, 다음 주(달) periodKey는 `false`, 지난 주(달) periodKey도 `true`가 아니라 `false`(현재 기간만 `true`) — 아니 정확히는 "이 기간에서 next 버튼을 눌러도 미래로 못 간다"는 의미이므로 "현재 기간 이상이면 true"로 정의하고 테스트도 그 정의를 검증한다(현재 기간=true, 미래=true는 애초에 도달 불가하므로 논외, 과거=false)
   - `formatBossProfitPeriodLabel`: `now`가 특정 목요일 직후일 때 그 주의 periodKey는 `{ primary: '이번 주', secondary: '7월 9일 ~ 7월 15일' }`류, 한 주 전은 `'지난 주'`, 두 주 전은 `'7월 N주차'`류(정확한 값은 구현하며 계산해 테스트에 명시)
   - `formatBossProfitPeriodLabel`: monthly도 동일하게 `'이번 달'`/`'지난 달'`/`'{YYYY}년 {M}월'` 분기 검증
   - `getWeeklyPeriodKeysInMonth('2026-07')`이 그 달에 속한 모든 목요일 날짜(4~5개)를 오름차순으로 반환하는지 검증 — 월 경계에 걸친 주(예: 목요일이 6/28이고 다음 리셋이 7/2 이후 등 실제 달력 기준 사례)로 최소 1건 이상 검증
   - `getBackfillQueryDate('weekly', '2026-06-04')` === `'2026-06-10'`(periodKey+6일), `getBackfillQueryDate('monthly', '2026-06')` === `'2026-06-30'`(그 달의 마지막 날, 30일/31일/윤년 2월 등 월별 일수 차이를 정확히 계산해야 한다)
4. 결과에 따라 `phases/boss-profit-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 `getCurrentBossProfitPeriod`의 시그니처나 동작을 바꾸지 마라.
- `lib/reset-clock.ts`를 수정하지 마라 — 이미 있는 `getMostRecentWeeklyResetKst`를 그대로 가져다 쓴다.
- `features/`·`app/`·`storage/`·`nexon/` 어떤 파일도 건드리지 마라(다음 step들에서 다룬다).
- 기존 테스트를 깨뜨리지 마라.
