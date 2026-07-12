# Step 0: schedule-sync-scoped

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/features/schedule-sync/schedule-sync.ts` — 지금 구현 전체를 읽어라. `getRegisteredCharacters()`(계정의 전체 캐릭터 목록을 `fetchCharacterList`로 라이브 조회, API 호출 1번)와 `syncAllSchedules()`(그 전체 목록의 캐릭터마다 `fetchSchedulerCharacterState`를 순차 호출)가 있다.
- `src/features/schedule-sync/__tests__/schedule-sync.test.ts` — 기존 테스트. 이번 변경에 맞게 갱신해야 한다.
- `/docs/ADR.md` — [[ADR-008]](여러 캐릭터 동기화 시 순차 호출, 401/403/429는 전역 실패로 이후 캐릭터 API 호출 중단)

## 배경

사용자가 발견한 문제: 지금은 "캐릭터 관리"에서 몇 명만 추적 대상으로 골라도, 실제로는 **계정의 전체 캐릭터**(예: 30명 이상)에 대해 스케줄 API를 순차 호출한다 — 화면에는 추적 대상만 필터링해서 보여줄 뿐, API 호출 자체는 전부 캐릭터를 대상으로 일어난다. 캐릭터가 많으면 이 불필요한 순차 호출 때문에 화면 로딩이 매우 느려진다.

이번 step은 이 문제의 근본 원인(`syncAllSchedules()`가 항상 "전체"를 동기화하는 구조)을 고친다. **"어떤 캐릭터를 동기화할지"를 호출자가 명시적으로 지정**하도록 바꾸고, 지정된 캐릭터에 대해서만 스케줄 API를 호출한다. `getRegisteredCharacters()`(캐릭터 목록 자체 조회, "캐릭터 관리" 피커가 보여줄 후보 목록에 필요)는 그대로 둔다 — 이건 API 호출이 1번뿐이라 문제가 아니다.

## 작업

`syncAllSchedules(): Promise<CharacterScheduleSync[]>`를 다음 시그니처로 바꿔라:

```ts
export async function syncSchedules(ocids: string[]): Promise<CharacterScheduleSync[]>
```

**동작 규칙**:
1. `ocids`가 빈 배열이면 **`getRegisteredCharacters()`조차 호출하지 말고** 곧바로 `[]`를 반환하라(추적 대상이 없으면 어떤 네트워크 호출도 하지 않는다).
2. `ocids`가 비어있지 않으면 기존처럼 `resolveRegisteredCharacters()`(내부 헬퍼, 그대로 둬도 됨)로 전체 캐릭터 목록 + apiKey를 얻은 뒤, 그중 `ocids`에 포함된 캐릭터만 걸러서(`characters.filter(c => ocids.includes(c.ocid))`) 그 부분집합만 순차로 스케줄 동기화한다.
3. 나머지 로직(401/403/429 전역 실패 시 이후 캐릭터는 캐시 폴백만, 캐시 폴백 처리, `setCachedSchedulerState` 갱신 등)은 기존과 동일하게 유지하되, 대상이 "전체"가 아니라 "걸러진 부분집합"이라는 점만 바뀐다.
4. `ocids`에 있지만 실제 계정 캐릭터 목록에는 없는 ocid(예: 오래돼서 더 이상 없는 캐릭터)는 조용히 결과에서 빠진다(에러 던지지 않음) — 필터링 결과이므로 자연히 그렇게 된다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `ocids`가 빈 배열일 때 `fetchCharacterList`/`fetchSchedulerCharacterState` 둘 다 전혀 호출되지 않는가?
   - `ocids`에 없는 캐릭터에 대해 `fetchSchedulerCharacterState`가 호출되지 않는가?
3. `schedule-sync.test.ts`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. 최소한 다음을 검증하라:
   - 빈 배열을 넘기면 `fetchCharacterList`가 아예 호출되지 않고 `[]`가 반환된다.
   - 계정에 캐릭터가 5명 있는데 `ocids`로 2명만 넘기면, `fetchSchedulerCharacterState`가 정확히 그 2명에 대해서만(2번만) 호출된다.
   - 기존에 검증하던 401/403/429 전역 실패·캐시 폴백 동작이 부분집합에 대해서도 동일하게 유지된다.
4. 결과에 따라 `phases/scoped-sync/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `ocids`가 빈 배열일 때도 `resolveRegisteredCharacters()`/`fetchCharacterList`를 호출하지 마라. 이유: 추적 대상이 없으면 네트워크 호출 자체가 불필요하다.
- `getRegisteredCharacters()`(캐릭터 목록 자체 조회 함수)의 동작이나 시그니처를 바꾸지 마라. 이유: "캐릭터 관리" 피커가 여전히 전체 후보 목록을 보여줘야 하므로 이 함수는 그대로 필요하다.
- 기존 테스트를 깨뜨리지 마라(단, 시그니처 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
