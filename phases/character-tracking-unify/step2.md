# Step 2: boss-store-diff

이 step은 이슈 #31의 (b)(c)를 **보스 스케줄러 스토어**에 적용한다 — step 1에서 컨텐츠 스토어에 넣은 것과 동일한 규칙을 보스 스토어에 미러링한다. ADR-043 결정 2·3·4·5.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-043 전체**(결정 2·3·4·5)와 ADR-042.
- `/src/features/content-scheduler/store.ts` — **step 1에서 완성된 `saveTrackedOcids` diff 구현**. 이 규칙을 보스 스토어에 그대로 옮기는 것이 이 step의 핵심이다. 정독하라.
- `/src/features/boss-scheduler/store.ts` — 주 수정 대상. step 0에서 `kind` 인자가 제거된 상태. `saveTrackedOcids`·`refresh`·`loadTrackedOcids` 흐름을 확인하라. 뷰 타입·정렬 함수·refresh가 만드는 캐릭터 뷰 shape이 컨텐츠와 다르다는 점에 유의(보스용 뷰 빌더를 쓴다).
- `/src/features/schedule-sync/schedule-sync.ts` — `syncSchedules(ocids, onProgress)`.
- `/src/storage/scheduler-cache.ts` — `getCachedSchedulerState(ocid)`.
- `/src/features/boss-scheduler/__tests__/store.test.ts` — 테스트 컨벤션.

step 1의 컨텐츠 스토어 구현을 기준으로 삼되, 보스 스토어의 뷰 빌더/정렬은 보스 것을 그대로 쓴다.

## 작업

`src/features/boss-scheduler/store.ts`의 `saveTrackedOcids`만 수정한다. step 1과 **동일한 규칙**:

- `added = ocids.filter(o => !previousOcids.includes(o))`.
- `added.length === 0`: `syncSchedules`/`refresh` 전체 동기화 **미호출**, 메모리 `get().characters`를 `ocids` 집합으로 **필터링**만.
- `added.length > 0`: `syncSchedules(added, onProgress)`로 **added만** 조회, 유지 캐릭터(`previous ∩ ocids`)는 기존 메모리 뷰 재사용, 병합·정렬해 `set`. 병합 결과 ocid 집합 == `ocids`.
- 영속화·수동 시딩(added)·성공 토스트 유지.

**핵심 불변식(반드시 지켜라)**:
1. `added.length === 0`이면 `syncSchedules` **미호출**.
2. `added.length > 0`이면 `syncSchedules`는 **`added`만** 인자로 호출.
3. 최종 `get().characters`의 ocid 집합 == `ocids`.
4. `refresh`(전체 동기화)는 **변경 금지** — `loadTrackedOcids`가 씀. diff는 `saveTrackedOcids`만.

**보스 특유 주의**: 보스 스토어의 캐릭터 뷰에는 보스 목록·처치 카운트·파티 정보 등 보스 고유 필드가 붙는다. `added`만 sync해 병합할 때, 유지 캐릭터의 이런 필드가 재조회 없이 **기존 메모리 뷰 그대로 보존**돼야 한다(제거 동작에서 남은 보스 데이터가 바뀔 이유가 없음, ADR-043 트레이드오프). 보스 수익(boss-profit)은 자체 스토어/DB를 읽으므로 이 변경과 무관하다 — 건드리지 마라.

## Acceptance Criteria

```bash
npm run build
npm test        # boss 스토어 신규/수정 테스트 포함
npm run lint
```

## 검증 절차

1. 위 AC 실행.
2. 아키텍처 체크리스트:
   - ADR-043 불변식 1~4 충족(테스트로 syncSchedules 호출 인자·횟수 단언)?
   - step 1 컨텐츠 스토어와 **동일한 규칙**으로 구현했는가(비대칭 동작이 생기지 않았는가)?
   - `refresh`·`loadTrackedOcids` 전체 동기화 경로 불변?
   - CLAUDE.md CRITICAL(TDD) 준수?
3. `phases/character-tracking-unify/index.json`의 step 2 업데이트:
   - 성공 → `"completed"` + `summary`
   - 3회 실패 → `"error"` + `error_message`
   - 개입 필요 → `"blocked"` + `blocked_reason` 후 중단

### 이 step에서 추가/수정할 테스트

`boss-scheduler/__tests__/store.test.ts`에 step 1과 대칭되는 `saveTrackedOcids` 케이스(먼저 작성):
- (a) 무변경 시 `syncSchedules` 미호출.
- (b) 순수 제거 시 `syncSchedules` 미호출, `characters`가 제거 후 집합으로 필터.
- (c) 추가 시 `syncSchedules(added)` 1회, 유지 캐릭터 재조회 안 됨, 결과 집합 == `ocids`.
- (d) 최초 선택 시 전원 added로 조회.

## 금지사항

- `refresh`·`loadTrackedOcids`를 수정하지 마라. 이유: 전체 동기화가 필요한 경로(ADR-043 결정 4).
- `content-scheduler/store.ts`를 다시 건드리지 마라. 이유: step 1에서 완료됨. 이 step은 보스만.
- `src/features/schedule-sync/schedule-sync.ts`·`src/features/boss-profit/*`를 수정하지 마라. 이유: sync는 이미 전달분만 fetch하고, boss-profit은 자체 데이터 소스라 무관.
- 기존 테스트를 깨뜨리지 마라.
