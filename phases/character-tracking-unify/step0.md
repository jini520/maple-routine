# Step 0: storage-unify

이 step은 ADR-042(추적 목록·현재 선택 단일화)를 **기계적으로만** 반영한다 — 저장 계층 시그니처를 통합하고, 그 시그니처를 쓰는 **모든 호출부의 `kind` 인자를 제거**해 프로젝트 전체가 다시 빌드·테스트되게 만든다. #31(저장 버튼 비활성·diff 동기화) 같은 **동작 변경은 이 step에서 하지 않는다**(step 1~3 범위). 저장 시그니처는 한 번 바뀌면 전 호출부가 동시에 깨지므로, 시그니처 변경과 호출부 정리를 한 step에 묶는다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-042 전체**(단일 키, 4키 합집합 마이그레이션, content 우선 lastSelected). 배경인 ADR-012 결정1·ADR-013 마이그레이션도 읽어라.
- `/docs/ARCHITECTURE.md` — `storage/` 어댑터 계층 규칙(features가 Preferences에 직접 접근하지 않고 어댑터를 거침)
- `/src/storage/character-selection.ts` — 주 수정 대상. 현재 `SchedulerKind='content'|'boss'`로 갈린 get/set/clear + 레거시 daily/weekly 마이그레이션.
- `/src/storage/keys.ts` — `trackedCharactersKey(kind)`(21-23), `lastSelectedCharacterKey(kind)`(25-27).
- `/src/storage/__tests__/character-selection.test.ts` — 테스트 컨벤션(Preferences 모킹). 재작성 대상.
- **호출부 5곳**(인자 제거 대상):
  - `/src/features/content-scheduler/store.ts` — `getTrackedCharacterOcids('content')`·`getLastSelectedCharacter('content')`(loadTrackedOcids), `setTrackedCharacterOcids('content', ocids)`(saveTrackedOcids), `setLastSelectedCharacter('content', ocid)`(selectCharacter)
  - `/src/features/boss-scheduler/store.ts` — 동일하게 `'boss'` 인자
  - `/src/features/boss-profit/store.ts` — `getTrackedCharacterOcids('boss')`(loadTrackedOcids)
  - `/src/features/tracking-mode/store.ts` — `getTrackedCharacterOcids('content')`·`getTrackedCharacterOcids('boss')` **합집합** 계산(setMode 시드)
  - `/src/features/onboarding/store.ts` — `setTrackedCharacterOcids('content', ocids)`(submitContentCharacters)
- 위 5개 스토어의 테스트 파일(`__tests__/store.test.ts`) — `'content'`/`'boss'` 인자를 단언하는 부분 갱신 대상.
- `/src/storage/manual-tracked-content.ts` — **건드리지 마라**(금지사항 참조). `ManualTrackedItem.kind`는 별개 개념.

이 phase의 첫 step이라 이전 step 산출물은 없다.

## 작업

### 1. `src/storage/keys.ts`

- `trackedCharactersKey(kind)` → `trackedCharactersKey(): string`, `'trackedCharacters'` 반환.
- `lastSelectedCharacterKey(kind)` → `lastSelectedCharacterKey(): string`, `'lastSelectedCharacter'` 반환.

### 2. `src/storage/character-selection.ts`

`SchedulerKind`와 모든 `kind` 파라미터를 제거해 아래 시그니처로:

```ts
export async function getTrackedCharacterOcids(): Promise<string[] | null>
export async function setTrackedCharacterOcids(ocids: string[]): Promise<void>
export async function clearTrackedCharacterOcids(): Promise<void>
export async function getLastSelectedCharacter(): Promise<string | null>
export async function setLastSelectedCharacter(ocid: string): Promise<void>
export async function clearLastSelectedCharacter(): Promise<void>
```

- `null`(미설정) vs `[]`(전부 해제) 구분·손상 JSON→`null`(기존 `parseOcids`) 동작 유지.

### 3. 마이그레이션 재작성 (ADR-042 "마이그레이션(1회)")

기존 `migrateLegacyTrackedCharacters`를 폐기하고 **통합 1회 마이그레이션**으로 대체한다. `getTrackedCharacterOcids()`와 `getLastSelectedCharacter()` **양쪽 시작부에서** 호출한다(무엇이 먼저 불려도 이관 후 읽도록).

- **가드**: `trackedCharacters` 키가 이미 존재하면(`Preferences.get`이 non-null) 즉시 반환(1회만, 덮어쓰기 금지).
- **추적 목록**: `trackedCharacters:content`·`:boss`·`:daily`·`:weekly` 4개를 읽어, 존재하는 값들을 `ocid` 기준 **중복 제거 합집합**으로 `trackedCharacters`에 쓴다. **4개 전부 `null`이면 아무것도 쓰지 않고 반환**.
  - daily/weekly까지 흡수하는 이유: 통합 후 `content` 키를 안 쓰므로 기존 daily/weekly→content/boss 체인이 끊긴다. 그 시대에서 바로 올라오는 설치본의 목록 손실 방지.
- **현재 선택**: `lastSelectedCharacter:content`가 있으면 그 값, 없으면 `:boss` 값을 단일 `lastSelectedCharacter`로 이관(content 우선, 둘 다 없으면 이관 안 함).
- **레거시 삭제**: 이관 후 `trackedCharacters:content`·`:boss`·`:daily`·`:weekly`, `lastSelectedCharacter:content`·`:boss` 전부 `remove`.
- **멱등성**: 두 번 실행돼도(get이 병렬로 부르는 등) 합집합이 결정적이라 같은 결과 — 안전해야 한다.

### 4. 호출부 5곳 인자 제거 (기계적, 동작 불변)

- content/boss/boss-profit/onboarding 스토어: `getTrackedCharacterOcids('content')` → `getTrackedCharacterOcids()` 등 **인자만 제거**한다. 로직·제어 흐름은 그대로 둔다(특히 `saveTrackedOcids`의 `refresh(ocids)` 전체 동기화 호출은 **변경 금지** — #31 diff는 step 1~2 몫).
- tracking-mode 스토어 `setMode`: 현재 `getTrackedCharacterOcids('content')`와 `('boss')`를 각각 읽어 합집합을 만든 뒤 시드한다. 이제 **단일 `getTrackedCharacterOcids()` 한 번**만 읽어 그 목록을 시드 대상으로 쓴다(합집합 계산 제거). 시드 동작 자체는 불변.

### 5. 테스트 갱신 (TDD)

- `character-selection.test.ts` 재작성: 기존 `content/boss 독립성`·`레거시 daily/weekly 마이그레이션`·`마지막 선택 캐릭터`의 분리 전제 블록을 폐기하고 통합 스펙으로. 최소 케이스:
  - round-trip / 미저장→null / 명시적 `[]` / 손상 JSON→null / set reject 전파 / clear→null
  - 마이그레이션 (a) content∪boss 합집합·중복 제거 (b) daily/weekly만 있어도 흡수 (c) 네 키 전부 없으면 미기록(→null) (d) lastSelected content 우선 (e) 이관 후 레거시 키 삭제 (f) `trackedCharacters` 이미 있으면 덮어쓰지 않음
- 5개 스토어 테스트에서 `setTrackedCharacterOcids('content', ...)` 같은 인자 단언을 인자 없는 형태로 갱신한다. 스토어의 **동기화 동작(전체 sync)은 이 step에서 불변**이므로 sync 관련 단언은 그대로 둔다(그 단언은 step 1~2에서 #31에 맞게 바뀐다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(전 호출부 인자 제거 완료)
npm test        # 전체 테스트 통과
npm run lint    # 경고 0
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `storage/` 어댑터 계층 규칙 유지(features가 어댑터만 거침)?
   - ADR-042 마이그레이션 규칙(4키 합집합·content 우선·1회·레거시 삭제) 정확?
   - 동작 변경 없음(#31 diff·저장 버튼 등은 손대지 않음)?
   - CLAUDE.md CRITICAL(어댑터 우회 금지, TDD) 준수?
3. `phases/character-tracking-unify/index.json`의 step 0 업데이트:
   - 성공 → `"completed"`, `"summary"`에 변경 파일·새 시그니처·마이그레이션 요지·**"saveTrackedOcids의 refresh는 아직 전체 sync(변경 안 함)"** 명시(step 1~2가 인지하도록).
   - 3회 실패 → `"error"` + `error_message`
   - 개입 필요 → `"blocked"` + `blocked_reason` 후 중단

## 금지사항

- `src/features/content-scheduler/store.ts`·`boss-scheduler/store.ts`의 `saveTrackedOcids`/`refresh` **로직을 바꾸지 마라**. 이유: added만 동기화하는 #31 diff는 step 1~2의 범위다. 이 step은 인자만 제거하고 전체 sync 동작을 그대로 둔다.
- `src/components/CharacterTrackingPicker/*`를 건드리지 마라. 이유: 저장 버튼 비활성(#31 a)은 step 3 범위.
- `src/storage/manual-tracked-content.ts`를 수정하지 마라. 이유: `ManualTrackedItem.kind: 'content'|'boss'`는 "수동 추적 항목이 컨텐츠/보스인지" 분류로, 제거 대상 `SchedulerKind`(어느 화면의 추적 목록)와 전혀 다르다. 혼동해 건드리면 수동 추적 모델이 깨진다.
- `keys.ts`의 ocid 단위 키 헬퍼(`schedulerCacheKey`·`characterBasicCacheKey`·`manualTrackedContentKey`)를 건드리지 마라. 이유: 애초에 content/boss 구분이 없어 통합과 무관.
- 기존 테스트를 깨뜨리지 마라(단, `character-selection.test.ts`의 content/boss 분리 전제 테스트와 스토어 테스트의 kind 인자 단언은 통합 스펙으로 **의도적으로 갱신**하는 것이라 예외).
