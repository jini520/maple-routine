# Step 1: content-store-diff

이 step은 이슈 #31의 (b)(c)를 **컨텐츠 스케줄러 스토어**에 적용한다 — 캐릭터 저장 시 추가된 캐릭터만 동기화하고, 제거·무변경이면 네트워크를 아예 태우지 않는다. ADR-043의 결정 2·3·4를 구현한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-043 전체**(특히 결정 2·3·4·5)와 **ADR-042**(단일 저장 계층 전제). 배경으로 ADR-035(수동 시딩·캐시 우선 표시)·ADR-016(stale-while-revalidate)도 참고.
- `/src/features/content-scheduler/store.ts` — 주 수정 대상. step 0에서 `kind` 인자가 제거된 상태다. 특히 `saveTrackedOcids`·`refresh`·`loadTrackedOcids`의 현재 흐름을 정독하라.
- `/src/features/schedule-sync/schedule-sync.ts` — `syncSchedules(ocids, onProgress)`의 시그니처와 "전달된 ocid만 개별 fetch"함을 확인하라(전달된 목록 밖은 조회하지 않음).
- `/src/storage/scheduler-cache.ts` — `getCachedSchedulerState(ocid)`(표시용 캐시). refresh가 이미 캐시 우선 표시에 쓴다.
- `/src/storage/character-selection.ts` — step 0 산출물. `getTrackedCharacterOcids()`/`setTrackedCharacterOcids(ocids)` 인자 없는 시그니처.
- `/src/features/content-scheduler/__tests__/store.test.ts` — 테스트 컨벤션(syncSchedules 모킹 방식).

step 0 산출물(단일 저장 계층·인자 제거된 스토어)을 꼼꼼히 읽고, `saveTrackedOcids`가 현재 `refresh(ocids)`로 **전체를 동기화**한다는 사실을 확인한 뒤 작업하라.

## 작업

`src/features/content-scheduler/store.ts`의 `saveTrackedOcids`만 수정한다(ADR-043 결정 2·3).

현재 흐름:
```
saveTrackedOcids(ocids, onProgress):
  previousOcids = get().trackedOcids ?? []
  setTrackedCharacterOcids(ocids)              // 영속
  set({ trackedOcids: ocids })
  if manual mode: 새 ocid(added)만 seedManualTrackedContent  // 유지
  refresh(ocids, onProgress)                   // ← 전체 sync (여기가 문제)
  showSuccess(...)
```

바꿀 규칙:

- `added = ocids.filter(o => !previousOcids.includes(o))`를 도출한다(수동 시딩이 이미 계산하는 것과 동일 집합 — 재사용 가능).
- **`added.length === 0`(순수 제거 또는 무변경)**: `syncSchedules`/`refresh` 전체 동기화를 **호출하지 않는다**. 대신 메모리의 `get().characters`를 **`ocids` 집합으로 필터링**해(`characters.filter(c => ocids.includes(c.ocid))`) `set`하고 `status: 'loaded'`로 둔다. 네트워크 0회. (`ocids`가 빈 배열이면 기존처럼 `characters: []`.)
- **`added.length > 0`**: 새로 추가된 캐릭터만 네트워크 조회한다.
  - `syncSchedules(added, onProgress)`로 **added만** 동기화한다(전체 `ocids`가 아님).
  - 유지되는 캐릭터(`previousOcids ∩ ocids`)의 뷰는 **기존 `get().characters`에서 재사용**한다(재조회 금지).
  - added의 sync 결과 뷰 + 유지 캐릭터 뷰를 병합해 **정확히 `ocids` 집합**이 되도록 만들고, 기존과 동일한 정렬 함수로 정렬해 `set`한다.
  - 유지 캐릭터 중 메모리에 뷰가 없는 예외적 경우(캐시만 있는 경우)는 `getCachedSchedulerState`로 채우되, **네트워크는 added에만** 쓴다.
- 영속화(`setTrackedCharacterOcids(ocids)`)·`set({ trackedOcids: ocids })`·수동 시딩(added 대상)·성공 토스트는 그대로 유지한다.

**핵심 불변식(반드시 지켜라)**:
1. `added.length === 0`이면 `syncSchedules`가 **한 번도 호출되지 않는다**.
2. `added.length > 0`이면 `syncSchedules`는 **`added`만** 인자로 받아 호출된다(유지 캐릭터는 재조회하지 않음).
3. 최종 `get().characters`의 ocid 집합은 **정확히 `ocids`와 일치**한다(누락·잔존 없음).
4. `refresh`(전체 동기화) 함수 자체는 **변경하지 마라** — `loadTrackedOcids`(초기 로드)가 계속 전체 동기화로 쓴다. diff는 `saveTrackedOcids` 안에서만.

## Acceptance Criteria

```bash
npm run build
npm test        # content 스토어 신규/수정 테스트 포함
npm run lint
```

## 검증 절차

1. 위 AC 실행.
2. 아키텍처 체크리스트:
   - ADR-043 불변식 1~4 충족? (테스트로 syncSchedules 호출 인자·횟수를 단언했는가)
   - `refresh`·`loadTrackedOcids` 전체 동기화 경로를 건드리지 않았는가?
   - `storage/`·`schedule-sync` 어댑터 계층을 우회하지 않았는가?
   - CLAUDE.md CRITICAL(TDD) 준수?
3. `phases/character-tracking-unify/index.json`의 step 1 업데이트:
   - 성공 → `"completed"` + `summary`(변경 요지·"boss 스토어에도 동일 규칙 필요[step 2]" 명시)
   - 3회 실패 → `"error"` + `error_message`
   - 개입 필요 → `"blocked"` + `blocked_reason` 후 중단

### 이 step에서 추가/수정할 테스트

`content-scheduler/__tests__/store.test.ts`에 `saveTrackedOcids` 케이스(먼저 작성):
- (a) 무변경(같은 집합, 순서만 달라도) 저장 시 `syncSchedules` **미호출**, `characters`가 그대로 유지.
- (b) 순수 제거 저장 시 `syncSchedules` **미호출**, `characters`가 제거 후 집합으로 필터됨.
- (c) 추가 저장 시 `syncSchedules`가 **added만** 인자로 1회 호출, 유지 캐릭터는 재조회 안 됨, 결과 `characters` 집합 == `ocids`.
- (d) 최초 선택(previous 빈 배열→N개 추가) 시 전원이 added라 `syncSchedules(added)`로 조회.

## 금지사항

- `refresh`·`loadTrackedOcids`를 수정하지 마라. 이유: 전체 동기화가 필요한 초기 로드·새로고침 경로다. diff 최적화는 저장 시점(`saveTrackedOcids`)만 대상(ADR-043 결정 4).
- `boss-scheduler/store.ts`를 건드리지 마라. 이유: 대칭 작업이지만 step 2의 범위다(스토어별로 분리).
- `src/features/schedule-sync/schedule-sync.ts`를 수정하지 마라. 이유: `syncSchedules`는 이미 "전달된 ocid만 fetch"한다 — 최적화는 호출부(스토어)가 `added`만 넘기는 것으로 충분하다. sync 내부에 캐시 단락을 넣는 건 이번 범위가 아니다.
- 수동 모드 시딩 로직(`seedManualTrackedContent` 배선)을 바꾸지 마라. 이유: 이미 `added`만 시드하며(ADR-035 결정 14b) #31과 정합한다.
- 기존 테스트를 깨뜨리지 마라.
