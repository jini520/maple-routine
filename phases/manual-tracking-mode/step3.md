# Step 3: seed-trigger-b-integration

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 14(b), 15
- **이전 step에서 만들어진 `/src/features/tracking-mode/seed.ts`**(`seedManualTrackedContent(ocid)`) — 정확한 시그니처
- **이전 step에서 만들어진 `/src/features/tracking-mode/store.ts`**(`useTrackingModeStore`, `mode` 필드)
- `/src/features/content-scheduler/store.ts` — `saveTrackedOcids(ocids, onProgress)` 전체 구현(수정 대상)
- `/src/features/boss-scheduler/store.ts` — 동일한 `saveTrackedOcids` 구현(수정 대상)
- `/src/app/content-scheduler/ContentScreen.tsx`의 `handleSaveTracking`/`ProgressModal` 사용부 — 저장 중 스피너가 이미 어떻게 유지되는지 확인(이 step에서 이 UI 코드 자체는 건드리지 않지만, 동작 방식을 이해해야 함)

이전 step들에서 만들어진 시드 함수와 트래킹 모드 스토어를 정확히 이해한 뒤 작업하라.

## 작업

ADR-035 결정 14(b): 이미 수동 모드인 상태에서 "캐릭터 관리"로 새 캐릭터가 추적 목록에 추가되는 순간, **그 캐릭터만** 개별 시드한다.

`features/content-scheduler/store.ts`와 `features/boss-scheduler/store.ts`의 `saveTrackedOcids`를 각각 수정한다(두 파일 모두 동일한 패턴 — 하나의 step에서 함께 처리해도 레이어가 같으므로 괜찮다):

```ts
async saveTrackedOcids(ocids, onProgress) {
  const previousOcids = get().trackedOcids ?? []
  try {
    await setTrackedCharacterOcids('content', ocids) // boss store는 'boss'
  } catch {
    useToastStore.getState().showError('저장하지 못했어요')
    return
  }
  set({ trackedOcids: ocids })

  // ADR-035 결정 14(b): 수동 모드에서 새로 추가된 캐릭터만 개별 시드
  if (useTrackingModeStore.getState().mode === 'manual') {
    const newOcids = ocids.filter((ocid) => !previousOcids.includes(ocid))
    await Promise.all(newOcids.map((ocid) => seedManualTrackedContent(ocid)))
  }

  await get().refresh(ocids, onProgress)
  useToastStore.getState().showSuccess('캐릭터 정보를 모두 불러왔어요')
}
```

- `previousOcids`는 반드시 `setTrackedCharacterOcids` 호출 **이전**의 `get().trackedOcids` 값으로 계산해야 한다(diff 기준).
- 시드는 `refresh` 호출보다 먼저 실행한다 — 이미 `saveTrackedOcids`가 끝날 때까지 `ContentScreen.tsx`/`BossScreen.tsx`가 저장 진행률 모달을 띄워둔 채 기다리므로(`handleSaveTracking`의 `try/finally`), 이 step에서 화면 코드를 건드리지 않아도 시드가 끝날 때까지 자연스럽게 스피너가 유지된다(ADR-035 결정 15 요건 충족).
- `seedManualTrackedContent`가 새로 추가된 각 ocid에 대해 자체적으로 `syncSchedules([ocid])`를 한 번 더 호출하는 것은 의도된 트레이드오프다 — 뒤이은 `refresh(ocids, ...)`가 같은 ocid를 다시 동기화하지만(중복 호출), 캐릭터 추가는 자주 일어나는 동작이 아니라 이 정도 중복은 감수한다. `refresh`의 내부 구조를 바꿔 시드와 동기화 결과를 공유하려는 리팩터링은 하지 마라(범위 초과).
- 기존 삭제(제거)된 캐릭터(`previousOcids`에는 있었지만 새 `ocids`에는 없는 경우)는 아무 처리도 하지 않는다 — 그 캐릭터의 `manualTrackedContent:{ocid}` 데이터는 그대로 남겨둔다(ADR-035 결정 10, 비파괴적 원칙과 동일한 정신 — 나중에 다시 추가하면 데이터가 남아있을 수도, 재시드로 덮어써질 수도 있으나 이는 이 step의 관심사가 아니다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `previousOcids`를 `setTrackedCharacterOcids` 호출 이전 값으로 정확히 계산했는가(diff 순서 오류로 이미 저장된 새 값과 비교하면 항상 빈 diff가 나온다)?
   - `auto` 모드일 때는 이 로직이 전혀 실행되지 않는가(기존 동작 100% 보존)?
   - `content-scheduler`/`boss-scheduler` 두 스토어 모두 동일하게 수정됐는가?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 3`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `refresh`나 `syncSchedules`의 내부 구현을 리팩터링해 시드와 동기화 호출을 공유하려 하지 마라. 이유: 이 step의 목표는 트리거 배선이지 성능 최적화가 아니다 — 캐릭터 추가는 드문 동작이라 API 중복 호출 한 번의 비용은 감수 가능하다(위 "작업" 절 설명 참고).
- `app/content-scheduler`, `app/boss-scheduler`의 화면 컴포넌트(`ContentScreen.tsx`/`BossScreen.tsx`)를 이 step에서 수정하지 마라. 이유: `saveTrackedOcids`가 끝날 때까지 기존 진행률 모달이 이미 열려 있으므로 화면 쪽 변경이 필요 없다.
- 삭제된(추적 해제된) 캐릭터의 `manualTrackedContent`를 이 step에서 지우거나 정리하지 마라. 이유: ADR-035에 그런 요구사항이 없고, 비파괴적 원칙과 상충하지 않는 범위에서 불필요한 삭제 로직을 추가하지 않는다.
- 기존 테스트를 깨뜨리지 마라.
