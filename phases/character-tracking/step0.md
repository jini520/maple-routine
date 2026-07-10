# Step 0: storage-character-selection

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `storage/` 레이어 규칙(로컬 저장소 접근은 이 레이어를 거쳐야 한다)
- `src/storage/keys.ts` — 기존 저장 키 관리 방식(`STORAGE_KEYS` 상수, `schedulerCacheKey(ocid)` 같은 키 생성 함수 패턴)
- `src/storage/scheduler-cache.ts` — 기존 storage 모듈의 구조(Preferences 사용, JSON 직렬화, 손상된 값 방어, 쓰기 실패 전파) — 이번 step도 같은 패턴을 따른다

## 배경

사용자가 새 정책을 추가했다: 일간 스케줄러와 주간 스케줄러 각각에서 "추적할 캐릭터"를 사용자가 직접 고르고, 고른 캐릭터만 화면에 표시한다. 일간/주간은 **서로 독립적인 목록**을 가진다(일간에서 고른 캐릭터와 주간에서 고른 캐릭터가 다를 수 있다). 이번 step은 그 선택 목록을 로컬에 저장하는 어댑터만 만든다 — UI는 다음 step들의 몫이다.

## 작업

`src/storage/keys.ts`에 새 키 생성 함수를 추가하라(기존 `schedulerCacheKey`와 같은 패턴):
```ts
export function trackedCharactersKey(kind: 'daily' | 'weekly'): string {
  return `trackedCharacters:${kind}`
}
```

`src/storage/character-selection.ts` 신규 작성:
```ts
export type SchedulerKind = 'daily' | 'weekly'

export async function getTrackedCharacterOcids(kind: SchedulerKind): Promise<string[] | null>
export async function setTrackedCharacterOcids(kind: SchedulerKind, ocids: string[]): Promise<void>
export async function clearTrackedCharacterOcids(kind: SchedulerKind): Promise<void>
```
- `@capacitor/preferences`를 사용하고, `trackedCharactersKey(kind)`로 키를 만들어라.
- 값은 `ocid` 문자열 배열을 JSON으로 직렬화해 저장한다.
- 저장된 적 없으면 `null`을 반환한다(빈 배열 `[]`과 `null`은 의미가 다르다 — `null`은 "한 번도 설정 안 함", `[]`은 "사용자가 명시적으로 전부 해제함"이다. 둘 다 구분해서 유지하라).
- 손상된 JSON이면 예외를 던지지 말고 `null`을 반환한다(기존 `scheduler-cache.ts`와 동일한 방어적 처리).
- 쓰기 실패(`Preferences.set` reject)는 그대로 호출자에게 전파한다(삼키지 마라).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `src/storage/__tests__/character-selection.test.ts`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `@capacitor/preferences`는 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - `setTrackedCharacterOcids('daily', [...])` 후 `getTrackedCharacterOcids('daily')`로 그대로 읽힌다(round-trip).
   - `'daily'`와 `'weekly'`가 서로 다른 저장 키를 써서 독립적으로 저장된다(하나를 설정해도 다른 kind엔 영향 없음).
   - 저장된 적 없으면 `null`을 반환한다.
   - 저장된 JSON이 손상됐으면 `null`을 반환한다.
   - `Preferences.set`이 reject되면 에러가 그대로 전파된다.
3. 결과에 따라 `phases/character-tracking/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 함수를 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `storage/` 밖에 파일을 추가하지 마라.
- `null`(한 번도 설정 안 함)과 `[]`(전부 해제함)을 같은 값으로 취급하지 마라. 이유: 다음 step에서 "아직 아무 캐릭터도 고르지 않음"과 "일부러 전부 뺌"을 구분해야 한다.
- 기존 테스트를 깨뜨리지 마라.
