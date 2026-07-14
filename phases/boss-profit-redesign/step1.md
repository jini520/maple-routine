# Step 1: date-param-api

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 "ADR-023" 중 "확인된 사실" 문단(`GET /maplestory/v1/scheduler/character-state`가 `date`(YYYY-MM-DD) 쿼리 파라미터를 지원한다는 공식 문서 확인 내용)과 [[ADR-007]] 관련 언급
- `/docs/PRD.md`의 "확인 필요" 항목 44번(`date` 파라미터로 실제 몇 일 전까지 조회 가능한지는 실측하지 않았다는 내용) — 이 step은 실측 없이 방어적으로 설계한다(아래 "작업" 참고)
- `src/nexon/schedule/client.ts` (이번 step에서 확장할 파일)
- `src/nexon/schedule/__tests__/client.test.ts` (기존 테스트 스타일 — `fetch`를 `vi.stubGlobal`로 모킹하는 패턴)
- `src/nexon/http.ts` (`requestJson` — 상태 코드별 에러 분류가 이미 되어있다: 401/403 → `NexonAuthError`, 429 → `NexonRateLimitError`, 그 외 실패 → `NexonNetworkError`)
- `src/nexon/errors.ts`

## 작업

`src/nexon/schedule/client.ts`의 `fetchSchedulerCharacterState`에 optional `date` 파라미터를 추가하라:

```ts
export async function fetchSchedulerCharacterState(
  apiKey: string,
  ocid: string,
  date?: string, // "YYYY-MM-DD", KST 기준. 생략 시 Nexon API가 오늘 날짜로 조회한다
): Promise<SchedulerCharacterState>
```

- `date`가 주어지면 쿼리스트링에 `&date=${encodeURIComponent(date)}`를 추가한다. 생략되면 기존과 동일하게 `ocid`만 보낸다(기존 호출부의 동작을 절대 바꾸지 않기 위함).
- 에러 처리는 새로 만들지 마라. `requestJson`이 이미 상태 코드별로 `NexonAuthError`/`NexonRateLimitError`/`NexonNetworkError`를 던진다 — 과거 날짜 조회가 실패해도(예: 조회 가능 기간을 벗어남) 이 세 타입 중 하나로 자연스럽게 분류된다. "날짜가 너무 오래돼서 실패"를 구분하는 새 에러 타입이나 로직을 추가하지 마라 — 호출하는 쪽(다음 step들)이 성공/실패만으로 판단하도록 둔다.
- `fetchSchedulerStatesForCharacters`는 이 step에서 건드리지 않는다. 과거 기간 백필은 "특정 한 캐릭터를 특정 날짜로" 조회하는 것이라 `fetchSchedulerCharacterState`를 직접 호출하는 게 맞고, 여러 캐릭터를 순회하는 `fetchSchedulerStatesForCharacters`는 이 용도에 맞지 않는다(수정도 호출도 하지 않는다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `nexon/` 레이어에만 변경이 있는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/nexon/schedule/__tests__/client.test.ts`에 케이스를 추가해 다음을 검증하라:
   - `fetchSchedulerCharacterState('key', 'ocid-123', '2026-06-01')` 호출 시 `fetch`가 `...character-state?ocid=ocid-123&date=2026-06-01` URL로 호출된다
   - `date`를 생략하면 기존 테스트("ocid를 쿼리 파라미터로 담아 호출")처럼 `date` 파라미터 없이 호출된다(기존 테스트가 계속 통과하는지로 확인 가능, 별도 테스트 불필요)
4. 결과에 따라 `phases/boss-profit-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `requestJson`/`http.ts`/`errors.ts`를 수정하지 마라 — 기존 에러 분류를 그대로 재사용한다.
- 새 에러 타입("날짜 조회 불가" 등)을 만들지 마라. 이유: 실제 조회 가능 기간이 실측되지 않아 정확한 경계를 코드로 판별할 수 없다 — 성공/실패만 다음 레이어에 전달한다.
- `fetchSchedulerStatesForCharacters`나 `features/schedule-sync/schedule-sync.ts`(현재 `date` 없이 "오늘" 기준으로만 동작)를 수정하지 마라 — 이 둘은 여전히 "현재" 동기화 전용이다.
- 기존 테스트를 깨뜨리지 마라.
