# Step 2: manual-tracking-seed

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 3, 6, 14, 15 (시드 트리거·로딩 계약의 핵심)
- `/docs/ARCHITECTURE.md` — "데이터 흐름" 절 중 스케줄 동기화 부분
- **이전 step에서 만들어진 `/src/storage/manual-tracked-content.ts`**(`ManualTrackedItem`, get/set) — 정확한 타입을 그대로 쓸 것
- **이전 step에서 만들어진 `/src/features/tracking-mode/store.ts`** — 이 step이 확장할 `setMode` 구현을 확인할 것
- `/src/features/schedule-sync/schedule-sync.ts` — `syncSchedules(ocids, onProgress)`의 반환 타입(`CharacterScheduleSync[]`, `state: SchedulerCharacterState | null`)을 정확히 확인할 것 — 이 step의 시드 함수가 그대로 재사용한다
- `/src/storage/character-selection.ts` — `getTrackedCharacterOcids(kind)` 시그니처
- `/src/types/scheduler.ts` — `DailyContent`/`WeeklyContent`/`BossContent`의 `isRegistered`/`name`/`difficulty` 필드

이전 step들에서 만들어진 storage 어댑터와 스토어를 정확히 이해한 뒤 작업하라.

## 작업

ADR-035 결정 3: 캐릭터가 처음 수동 모드로 편입될 때, **그 시점의 최신 동기화 결과**(스테일 캐시가 아니라)를 기준으로 인게임에 등록돼 있던 항목을 수동 추적 목록에 1회 복사해 채운다.

### 1. `src/features/tracking-mode/seed.ts` 신규

```ts
// ADR-035 결정 3·15: ocid 하나에 대해 최신 동기화 결과를 기준으로 manualTrackedContent를
// 1회 채운다(기존 값이 있어도 덮어쓴다 — "최초 편입 시 1회 시드"이므로 매번 새로 계산).
// syncSchedules 호출이 실패하거나 state가 null이면(전역 인증 실패 등) 에러를 던진다 —
// 빈 배열로 조용히 시드하면 "정말 아무것도 등록 안 한 사용자"와 구분이 안 된다(결정 15 취지).
export async function seedManualTrackedContent(ocid: string): Promise<void>
```

구현 가이드:
- `syncSchedules([ocid])`를 호출해 `[result] = await syncSchedules([ocid])`를 얻는다(내부에서 이미 `storage/scheduler-cache`도 최신값으로 갱신해준다 — 별도로 캐시를 다시 쓸 필요 없음).
- `result?.state`가 `null`이거나 `result`가 없으면 `Error`를 던진다.
- `result.state.dailyContents`와 `result.state.weeklyContents` 중 `isRegistered === true`인 항목을 `{ contentName: content.name, kind: 'content' }`로 변환한다(이 시점엔 `maxCount`를 채우지 않는다 — 실제 값은 항상 표시 시점에 schedulerCache에서 조회하므로, 결정 6에 따라 멤버십 목록에는 동기화 유래 값을 중복 저장하지 않는다. `maxCount` 필드는 "한 번도 동기화된 적 없는 항목"의 템플릿 폴백 전용이며 이 시드 경로에서는 필요 없다).
- `result.state.bossContents` 중 `isRegistered === true`인 항목을 `{ contentName: boss.name, difficulty: boss.difficulty, kind: 'boss' }`로 변환한다.
- 두 목록을 합쳐 `setManualTrackedContent(ocid, items)`로 저장한다(덮어쓰기).

### 2. `features/tracking-mode/store.ts`의 `setMode` 확장 (ADR-035 결정 14(a))

이전 step이 만든 `setMode`에 트리거 (a)를 추가한다: **이미 자동 모드였다가 수동 모드로 전환되는 순간**, 그 시점에 이미 추적 중인 캐릭터 전원(`trackedCharacters:content` + `trackedCharacters:boss`의 합집합, 중복 제거)에 대해 `seedManualTrackedContent`를 병렬로 실행한다.

```ts
async setMode(mode) {
  const previousMode = get().mode
  await setTrackingMode(mode)
  set({ mode })

  if (mode === 'manual' && previousMode !== 'manual') {
    const [contentOcids, bossOcids] = await Promise.all([
      getTrackedCharacterOcids('content'),
      getTrackedCharacterOcids('boss'),
    ])
    const ocids = Array.from(new Set([...(contentOcids ?? []), ...(bossOcids ?? [])]))
    await Promise.all(ocids.map((ocid) => seedManualTrackedContent(ocid)))
  }
}
```

- `mode === previousMode`(이미 manual인 상태에서 다시 manual을 선택하는 등)면 시드하지 않는다.
- `manual → auto` 전환은 시드하지 않는다(ADR-035 결정 10 — 모드 전환은 비파괴적, auto 모드는 기존 자동 로직을 그대로 쓸 뿐 수동 목록을 건드릴 필요가 없다).
- 이 함수가 반환하는 Promise는 시드가 전부 끝난 뒤에만 resolve된다 — 호출부(이후 step의 설정 토글 UI)가 이 Promise를 그대로 await하며 스피너를 유지하면 결정 15의 "시드 완료 전까지 로딩 유지" 요구사항이 자연스럽게 충족된다. 이 step에서 스피너 UI 자체를 만들 필요는 없다(설정 UI는 step 6의 범위).

### 테스트 (TDD)

`src/features/tracking-mode/__tests__/seed.test.ts` 신규 작성:
- `syncSchedules`를 모킹해 `isRegistered: true`/`false`가 섞인 `dailyContents`/`weeklyContents`/`bossContents`를 반환하도록 하고, `seedManualTrackedContent(ocid)` 호출 후 `setManualTrackedContent`가 등록된(`isRegistered: true`) 항목만으로 호출됐는지 검증한다.
- `syncSchedules`가 `state: null`을 반환하면 함수가 에러를 던지는지 검증한다.

`src/features/tracking-mode/__tests__/store.test.ts`에 추가:
- `auto → manual` 전환 시 현재 추적 중인 모든 ocid에 대해 시드가 실행되는지(예: `trackedCharacters:content`/`:boss` 모킹 + `seedManualTrackedContent` 스파이).
- `manual → manual`(변화 없음)이나 `manual → auto` 전환 시 시드가 실행되지 않는지.

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `seedManualTrackedContent`가 `manualTrackedContent`에 `nowCount`/`isComplete` 같은 값 필드를 넣지 않는가(멤버십+difficulty(+maxCount는 템플릿 폴백 전용, 여기선 미사용)만 저장하는가, ADR-035 결정 6)?
   - `setMode`가 트리거 (a) 조건(오직 `auto→manual` 전환)에서만 시드를 실행하는가?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 2`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 시드 시 `manualTrackedContent`에 `nowCount`/`maxCount`(카운트형 제외)/`questState`/`isComplete` 같은 동기화 값 필드를 저장하지 마라. 이유: ADR-035 결정 6(단일 진실 공급원) — 값은 항상 표시 시점에 `schedulerCache`에서 조회해야 모드 전환 시 값이 어긋나 보이는 문제가 구조적으로 발생하지 않는다.
- `syncSchedules` 실패를 조용히 삼켜 빈 배열로 시드하지 마라. 이유: ADR-035 결정 15 — 시드는 최종 값이 확정된 뒤에만 이뤄져야 하며, 실패를 빈 상태로 위장하면 "정말 아무것도 등록 안 한 사용자"와 구분이 안 된다.
- `app/onboarding`이나 `app/settings`의 스피너 UI를 이 step에서 만들지 마라(각각 step 5, step 6의 범위) — 이 step은 `setMode`/`seedManualTrackedContent`가 반환하는 Promise가 시드 완료 시점에 정확히 resolve되는 것까지만 보장하면 된다.
- 기존 테스트를 깨뜨리지 마라.
