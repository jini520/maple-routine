# Step 2: tracked-character-storage-migration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-012]]와 [[ADR-013]] 전체. 특히 ADR-013의 "캐릭터 추적 목록 재구성" 단락에 있는 1회 마이그레이션 규칙(아래 "작업"에서 그대로 반복하지만, 배경 이해를 위해 원문을 꼭 읽어라)
- `src/storage/keys.ts` — 지금 구현 전체
- `src/storage/character-selection.ts` — 지금 구현 전체
- `src/storage/__tests__/character-selection.test.ts` — 기존 테스트. 이번 변경에 맞게 갱신해야 한다
- `src/app/daily/DailyScreen.tsx`, `src/app/weekly/WeeklyScreen.tsx` — `getTrackedCharacterOcids`/`setTrackedCharacterOcids` 호출부(각 파일에서 `'daily'`/`'weekly'` 리터럴을 넘기는 곳)

## 배경

지금 `SchedulerKind`는 `'daily' | 'weekly'`이고 `trackedCharacters:daily`/`trackedCharacters:weekly` 두 키를 쓴다. 화면이 컨텐츠/보스로 재편되므로 이 키도 `trackedCharacters:content`/`trackedCharacters:boss`로 바뀐다([[ADR-013]]). 기존 사용자가 이미 daily/weekly 추적 목록을 설정해뒀을 수 있으므로, 새 키를 처음 읽을 때 기존 값을 옮겨오는 1회 마이그레이션이 필요하다.

**이번 step은 storage 레이어만 완성한다.** `app/daily/DailyScreen.tsx`, `app/weekly/WeeklyScreen.tsx`는 아직 존재하고 빌드에 포함되므로, 이 두 파일의 `getTrackedCharacterOcids('daily'/'weekly')` 호출부는 새 타입에 맞춰 **컴파일이 통과하도록만 최소 수정**한다(실제 UX 재설계는 다음 step들에서 새 화면으로 완전히 대체되므로 신경 쓰지 않는다) — `scoped-sync` phase의 `scoped-refresh-stores` step에서 썼던 것과 같은 브릿지 패턴이다. `DailyScreen.tsx`는 `'content'`를, `WeeklyScreen.tsx`는 `'boss'`를 쓰도록 바꿔라(어느 쪽이든 이 두 화면은 곧 삭제되므로 정확한 의미 매칭보다 컴파일 통과가 목적이다).

## 작업

### 1. `src/storage/keys.ts`

```ts
export function trackedCharactersKey(kind: 'content' | 'boss'): string
```
반환값은 `trackedCharacters:content` / `trackedCharacters:boss`.

### 2. `src/storage/character-selection.ts`

```ts
export type SchedulerKind = 'content' | 'boss'
```

`getTrackedCharacterOcids(kind: SchedulerKind): Promise<string[] | null>`에 마이그레이션 로직을 추가한다. 정확한 알고리즘(그대로 구현하라 — 세부 규칙이 어긋나면 안 된다):

```
async function migrateLegacyTrackedCharacters(): Promise<void> {
  // 새 키(content)가 이미 있으면(Preferences.get이 null이 아닌 value 반환) 마이그레이션 이미 끝난 것 — 아무것도 안 함
  const contentRaw = await Preferences.get({ key: 'trackedCharacters:content' })
  if (contentRaw.value !== null) return

  const legacyDailyRaw = await Preferences.get({ key: 'trackedCharacters:daily' })
  const legacyWeeklyRaw = await Preferences.get({ key: 'trackedCharacters:weekly' })
  const legacyDaily = parse(legacyDailyRaw.value)   // 기존 파싱 로직 재사용, 손상된 JSON은 null
  const legacyWeekly = parse(legacyWeeklyRaw.value)

  if (legacyDaily === null && legacyWeekly === null) return // 옮길 데이터 없음

  const content = dedupeByOcid([...(legacyDaily ?? []), ...(legacyWeekly ?? [])])
  await Preferences.set({ key: 'trackedCharacters:content', value: JSON.stringify(content) })

  if (legacyWeekly !== null) {
    await Preferences.set({ key: 'trackedCharacters:boss', value: JSON.stringify(legacyWeekly) })
  }
  // legacyWeekly가 null이면 boss는 쓰지 않는다 — getTrackedCharacterOcids('boss')는 계속 null을 반환해야 한다(사용자가 weekly를 한 번도 설정 안 한 것과 동일한 상태이므로)

  await Preferences.remove({ key: 'trackedCharacters:daily' })
  await Preferences.remove({ key: 'trackedCharacters:weekly' })
}
```

`getTrackedCharacterOcids`는 함수 시작 부분에서 `await migrateLegacyTrackedCharacters()`를 호출한 뒤 기존 로직(정확한 `kind`의 키를 읽어 파싱)을 그대로 수행한다. `dedupeByOcid`는 배열 순서를 유지하면서 먼저 나온 ocid를 우선하는 단순 중복 제거면 충분하다(예: `Array.from(new Set(arr))`).

`setTrackedCharacterOcids`, `clearTrackedCharacterOcids`의 시그니처도 `SchedulerKind`가 `'content' | 'boss'`로 바뀐 것을 그대로 반영한다(마이그레이션 로직은 이 두 함수에는 필요 없다 — `getTrackedCharacterOcids`에서만 트리거).

### 3. `DailyScreen.tsx`/`WeeklyScreen.tsx` 최소 수정

`getTrackedCharacterOcids('daily')` → `getTrackedCharacterOcids('content')`, `setTrackedCharacterOcids('daily', ocids)` → `setTrackedCharacterOcids('content', ocids)` (DailyScreen). `WeeklyScreen`은 `'weekly'`였던 자리를 `'boss'`로 바꾼다. 그 외 로직은 건드리지 마라.

## 테스트 (TDD — 먼저 작성하라)

`src/storage/__tests__/character-selection.test.ts`를 갱신하라. 기존 `'daily'`/`'weekly'` 리터럴은 각각 `'content'`/`'boss'`로 바꾸고, 추가로 마이그레이션을 검증하는 새 테스트를 작성하라(레거시 키는 `Preferences.set({ key: 'trackedCharacters:daily', ... })`처럼 직접 써서 준비):
- 레거시 `daily`/`weekly` 둘 다 없으면 `getTrackedCharacterOcids('content')`/`('boss')` 둘 다 `null`.
- 레거시 `daily=['a','b']`만 있고 `weekly` 없으면 → `content`는 `['a','b']`, `boss`는 `null`.
- 레거시 `weekly=['b','c']`만 있고 `daily` 없으면 → `content`는 `['b','c']`, `boss`는 `['b','c']`.
- 레거시 `daily=['a','b']`, `weekly=['b','c']` 둘 다 있으면 → `content`는 중복 제거된 `['a','b','c']`(순서: daily 먼저, 그 다음 weekly의 새 항목), `boss`는 `['b','c']`.
- 레거시 `daily=[]`(명시적으로 전부 해제), `weekly` 없음 → `content`는 `[]`(null 아님), `boss`는 `null`.
- 마이그레이션 후 `Preferences.get({ key: 'trackedCharacters:daily' })`/`weekly`가 `null`을 반환한다(레거시 키 삭제 확인).
- 마이그레이션은 1회만 실행된다 — 마이그레이션 후 사용자가 `setTrackedCharacterOcids('content', [])`로 빈 배열을 명시 저장해도 그 값이 유지된다(레거시가 없으니 재마이그레이션으로 덮어써지지 않음).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `null`(미설정)과 `[]`(명시적 전부 해제)의 구분이 마이그레이션 이후에도 정확히 유지되는가?
   - 마이그레이션이 `getTrackedCharacterOcids` 호출마다 반복 실행되지 않는가(이미 `content` 키가 있으면 즉시 리턴)?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `DailyScreen.tsx`/`WeeklyScreen.tsx`의 UI나 다른 로직을 바꾸지 마라. 이유: 이번 step은 컴파일 통과를 위한 최소 브릿지 수정만 하고, 실제 화면 재설계는 이후 step에서 새 파일로 한다.
- 마이그레이션 로직을 `setTrackedCharacterOcids`나 `clearTrackedCharacterOcids`에 넣지 마라. 이유: 마이그레이션은 "아직 새 키를 쓴 적 없는 상태에서 조회할 때"만 트리거되어야 한다 — 쓰기 함수에 넣으면 의도치 않은 시점에 레거시 데이터를 덮어쓸 수 있다.
- `content`/`boss` 마이그레이션 결과 계산 순서(daily 먼저, weekly의 새 항목만 추가)를 바꾸지 마라. 이유: 테스트가 이 순서를 검증한다.
- 기존 테스트를 깨뜨리지 마라(단, `'daily'`/`'weekly'` 리터럴을 쓰던 부분은 이번 변경에 맞게 갱신해야 한다).
