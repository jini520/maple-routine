# Step 1: period-lib

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/PRD.md`의 "4. 주간 보스 수익 계산기" 섹션 전체, 특히 "확인이 필요한 사항" #36(월간 보스 리셋 경계 미확인)
- `/docs/ARCHITECTURE.md`의 "엣지 케이스 — 리셋 경계" 서술, `lib/` 디렉토리 설명
- `src/types/scheduler.ts`의 `BossCycle` 타입(`'weekly' | 'monthly'`)

이 프로젝트에는 아직 `lib/reset-clock` 모듈이 존재하지 않는다(ARCHITECTURE.md 문서에는 계획돼 있으나 미구현 상태). 이번 step에서 이 phase에 필요한 최소 범위로 처음 만든다.

## 작업

주간 보스 수익 기록의 unique key(`ocid`+`boss`+`difficulty`+기간)에 쓸 "기간(period)"을 계산하는 순수 함수를 작성한다. 주간 보스와 월간 보스(검은마법사)는 리셋 주기가 다르므로 cycle별로 다른 기간 라벨을 쓴다.

1. **`src/lib/reset-clock.ts`**: 기기 타임존과 무관하게 항상 KST(UTC+9) 기준으로 계산하는 범용 리셋 시각 유틸.
   ```ts
   export function getMostRecentWeeklyResetKst(now: Date): Date
   ```
   - Nexon 서버 주간 리셋 시각은 **KST 목요일 00:00**(ARCHITECTURE.md 확인 완료 사항)이다. 주어진 `now` 시점 기준으로 가장 최근에 지난(또는 지금 막 지난) 목요일 00:00 KST를 반환하라.
   - 기기 로컬 타임존이 KST가 아니어도(예: UTC, 미국 타임존) 항상 KST 기준 목요일 00:00을 정확히 계산해야 한다 — `Date`를 다룰 때 로컬 타임존에 의존하지 말고 UTC 오프셋(+9시간)으로 명시적으로 환산하라.

2. **`src/lib/boss-profit-period.ts`**: 보스 수익 기록용 기간 키·라벨 계산.
   ```ts
   export interface BossProfitPeriod {
     periodKey: string   // 저장/조회 시 unique key로 쓰이는 안정적인 문자열
     label: string        // 화면 표시용 ("이번 주" | "이번 달")
   }

   export function getCurrentBossProfitPeriod(cycle: BossCycle, now: Date): BossProfitPeriod
   ```
   - `cycle === 'weekly'`: `getMostRecentWeeklyResetKst(now)`가 반환한 Date를 `YYYY-MM-DD` 형식(KST 기준 날짜)의 `periodKey`로, `label`은 `"이번 주"`로 한다.
   - `cycle === 'monthly'`: **월간 보스(검은마법사)의 정확한 Nexon 서버 리셋 시각은 아직 실측 확인되지 않았다(PRD #36)**. 확정 전까지는 **KST 기준 매월 1일 00:00**을 리셋 경계로 가정하라. `periodKey`는 `YYYY-MM`(KST 기준 연·월), `label`은 `"이번 달"`로 한다. 이 가정이 실측과 다를 수 있음을 코드 주석으로 명시하고 PRD #36을 참조하라(추후 실측 확정 시 이 함수만 수정하면 되도록 격리해뒀다는 점도 남겨라).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`lib/`에 순수 유틸로 배치, storage·features 의존 없음)
   - ADR.md 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `lib/reset-clock.ts`에 이번 phase에서 쓰지 않는 일간(daily) 리셋 계산 함수를 미리 추가하지 마라. 필요할 때(알림 기능 구현 시) 별도로 추가한다 — 지금은 주간 계산만 필요하다.
- `getCurrentBossProfitPeriod`가 `storage/`나 `features/`를 import하게 만들지 마라. 순수 함수로 유지해 어디서든(스토어·테스트) 재사용 가능해야 한다.
- 월간 리셋 경계를 실측된 값처럼 단정적으로 문서화하지 마라 — 반드시 "가정치, 추후 확인 필요"라고 코드 주석에 남겨라.
- 기존 테스트를 깨뜨리지 마라.
