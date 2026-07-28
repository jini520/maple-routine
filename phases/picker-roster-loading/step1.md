# Step 1: roster-emission

`getCharacterPickerRoster()`의 **방출 규칙**을 고친다 — `access_flag`가 확인되지 않은 캐릭터를 목록에 넣지 않고, 표시할 캐시가 하나도 없는 콜드 스타트에서는 중간 결과를 흘리지 않는다([[ADR-053]] 결정 1·2). UI(스피너)는 step 2~3에서 붙인다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-053.md` — **step 0에서 작성된 이번 작업의 결정.** 결정 1·2가 이 step의 규칙이다.
- `/docs/adr/ADR-016.md` — 캐시 우선 표시(SWR). step 0에서 추가된 정정 문단까지 읽어라. **캐시가 있을 때의 동작은 바뀌지 않는다.**
- `/docs/adr/ADR-017.md` — 결정 6(피커 열 때 캐시된 캐릭터 즉시 채우기)과 step 0의 정정.
- `/docs/foundation/error-resilience.md` — 401/429 전역 실패 vs 개별 실패 처리 원칙.
- `/src/features/schedule-sync/schedule-sync.ts` — **주 수정 대상.** `getCharacterPickerRoster`(`:83-187`)의 3단계 구조:
  - ① `:94-117` 캐시 stub — `cachedOcids.length > 0` 안에서 `stubEntries`를 만들고 `:114`의 `stubEntries.length > 0`일 때만 `onUpdate`
  - `:119-123` `resolveRegisteredCharacters()` → `characters.length === 0`이면 `onUpdate([])` 후 return
  - ② `:125-150` `liveEntries` 구성 + `:150` `onUpdate`. **`:130-137`이 캐시 없는 캐릭터를 `imageUrl: null`로 넣는 문제의 분기**
  - ③ `:152-183` `character/basic` 병렬 조회. 성공 시 `accessFlag`에 따라 upsert/delete 후 `:173` `onUpdate`. 401/429는 `globalError`에 담고(`:176-178`) 루프 종료 후 `:185-187`에서 throw
- `/src/features/schedule-sync/__tests__/schedule-sync.test.ts` — 갱신 대상. 이 함수의 방출 순서를 검증하는 테스트가 있으면 새 규칙에 맞게 고쳐야 한다.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`src/features/schedule-sync/__tests__/schedule-sync.test.ts`에 아래 케이스를 작성/갱신하고 실패를 확인한 뒤 구현하라. **`onUpdate` 호출 횟수와 각 호출의 인자**를 기록해 검증하는 형태가 좋다.

**(a) 웜 캐시 — 기존 SWR 동작 유지 (회귀 방지, 가장 중요)**
- 캐시에 활성 캐릭터가 있으면 `character/list` 응답 전에 **첫 `onUpdate`(stub)** 가 호출된다.
- 그 뒤 `character/list` 응답과 각 `character/basic` 응답마다 `onUpdate`가 **추가로** 호출된다(개별 patch).
- 즉 `onUpdate` 호출 횟수가 2회 이상이어야 한다.

**(b) 콜드 캐시 — 중간 방출 억제**
- 캐시가 완전히 비어 있으면 `character/list` 응답 시점에도, 개별 `character/basic` 응답 시점에도 `onUpdate`가 호출되지 **않는다**.
- 모든 조회가 끝난 뒤 **정확히 1회** 호출되고, 그 인자가 활성 캐릭터만 담은 완성된 목록이다.

**(c) `access_flag` 미상 캐릭터 비표시**
- 캐시가 없고 `character/basic`이 `accessFlag: false`를 반환한 캐릭터는 **어떤 `onUpdate` 인자에도 등장하지 않는다**(중간이든 최종이든).
- 웜 캐시 경로에서도, `character/list`에는 있지만 캐시가 없는 캐릭터는 ② 단계 방출 인자에 포함되지 않는다.

**(d) 전역 실패**
- 개별 `character/basic`이 `NexonAuthError`/`NexonRateLimitError`를 던지면 함수가 **그 에러를 throw**한다(기존 동작 유지).
- 콜드 캐시에서 전역 실패가 나면 **최종 방출을 하지 않고** throw한다 — 불완전한 목록을 "완성된 결과"처럼 내보내면 안 된다.

**(e) 기존 동작 유지**
- `characters.length === 0`이면 `onUpdate([])` 후 종료(`:120-123`).
- 개별 실패(401/429가 아닌 네트워크 오류 등)는 그 캐릭터만 이전 값 유지하고 전체를 막지 않는다.
- 정렬(`sortPickerEntries` — 레벨 내림차순, 동률 시 이름)은 그대로.

### 2. `src/features/schedule-sync/schedule-sync.ts` 수정

**(a) 콜드/웜을 구분하는 플래그를 함수 스코프에 둔다.**

```ts
// 시그니처 예시 — 이름은 재량, 의미는 "①에서 사용자에게 보여줄 것을 실제로 방출했는가"
let hasVisibleView = false
// ① stub 방출 지점에서 onUpdate와 함께 true로
```

`stubEntries`는 현재 `if (cachedOcids.length > 0)` 블록 안에서만 존재한다 — 플래그는 그 블록 **밖**에 선언해야 한다.

**(b) ② 단계에서 `access_flag` 미상 캐릭터를 넣지 않는다.**

`:130-137`의 `if (cached === null) { liveEntries.set(...) }` 분기를 **제거**한다. 결과적으로 ② 단계의 `liveEntries`에는 `cached !== null && cached.profile.accessFlag`인 캐릭터만 들어간다(`:138-146`의 기존 분기). `:147`의 설명 주석도 새 규칙에 맞게 현행화하라.

**(c) 중간 `onUpdate`를 콜드일 때 억제한다.**

- ② 단계의 `onUpdate`(`:150`)와 ③ 단계 개별 응답의 `onUpdate`(`:173`)를 `hasVisibleView`가 `true`일 때만 호출하게 한다.
- **③ 병렬 루프가 끝난 뒤, `globalError === null`인 경우에만 최종 `onUpdate`를 1회 호출한다.** 이 최종 방출은 웜/콜드 **양쪽 모두** 실행한다(웜에서는 마지막 patch와 같은 값이라 무해하고, 콜드에서는 이게 유일한 방출이다).
- `globalError !== null`이면 최종 방출 없이 기존대로 throw한다(`:185-187`).

**(d) 주석 갱신.** `:79-82`(함수 위)와 `:86-93`(① 위)의 설명 주석이 옛 규칙을 서술하고 있다. [[ADR-053]] 결정 1·2를 반영해 현행화하되, **[[ADR-016]]·[[ADR-017]]의 캐시 우선 표시가 웜 경로에서 유지된다는 사실**이 주석에서 읽혀야 한다.

**이 step에서 반드시 지켜야 할 규칙:**
- **`getCharacterPickerRoster`의 시그니처를 바꾸지 마라.** 호출부 3곳이 `Promise`의 완료/실패로 로딩 상태를 판정할 것이므로(step 3), 콜백 인터페이스와 반환 타입은 그대로여야 한다.
- **웜 캐시 경로의 방출 타이밍을 늦추지 마라.** ADR-016 SWR의 핵심은 "캐시가 있으면 즉시 보여준다"이다. 콜드 억제 로직이 웜 경로까지 막으면 이 step은 실패다 — 테스트 (a)가 그것을 고정한다.
- **401/429 전역 실패 처리(`globalError` 수집 후 throw)를 바꾸지 마라.**

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# access_flag 미상 캐릭터를 넣던 분기가 사라졌는지 확인 — getCharacterPickerRoster 안에
# 'cached === null'로 liveEntries에 넣는 코드가 없어야 한다
grep -n "cached === null" src/features/schedule-sync/schedule-sync.ts
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/*`가 `storage/`·`nexon/` 어댑터를 거치는 레이어 규칙을 유지하는가? (CLAUDE.md CRITICAL)
   - 웜 캐시 경로에서 [[ADR-016]] SWR이 **그대로** 동작하는가? (테스트 (a)로 확인)
   - 콜드 경로에서 `onUpdate`가 정확히 1회만 호출되는가? (테스트 (b))
   - 함수 시그니처가 그대로인가?
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/picker-roster-loading/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **웜/콜드 각각의 방출 횟수와 타이밍**, 제거한 분기, 최종 방출이 `globalError === null`일 때만 일어난다는 사실을 명시하라. step 2·3이 이 요약만 보고 "언제 스피너가 걷히는지"를 정확히 이해할 수 있어야 한다.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `getCharacterPickerRoster`의 시그니처(콜백 인자, 반환 타입)를 바꾸지 마라. 이유: step 3의 호출부가 `Promise` 완료/실패로 로딩을 판정한다. 시그니처가 바뀌면 호출부 3곳과 그 테스트가 동시에 깨진다.
- 웜 캐시 경로의 중간 방출을 없애지 마라. 이유: [[ADR-016]] 결정 4의 캐시 우선 표시는 **유지되는 정책**이다. "콜드에서 한 번에 그린다"를 "항상 한 번에 그린다"로 확대 적용하면 캐시가 있는 평상시에도 화면이 몇 초간 비게 된다.
- `Promise.all`을 순차 `await` 루프로 바꾸지 마라. 이유: [[ADR-016]]·[[ADR-008]] 정정(2026-07-17)이 병렬 호출을 명시적으로 채택했다. 콜드에서 마지막에 한 번 그리더라도 **조회 자체는 병렬**이어야 대기 시간이 최대값에 머문다.
- `src/components/CharacterTrackingPicker/`나 `src/app/` 아래를 건드리지 마라. 이유: UI(스피너·빈 상태)는 step 2, 호출부 배선은 step 3의 범위다.
- 401/429의 전역 실패 처리를 개별 실패로 강등하지 마라. 이유: `docs/foundation/error-resilience.md`가 정한 처리 원칙이고, 무효 키로 반복 호출하지 않기 위한 장치다.
- 기존 테스트를 깨뜨리지 마라(단, 옛 방출 규칙을 고정하던 단언은 새 정책에 맞춰 **의도적으로 갱신**한다).
