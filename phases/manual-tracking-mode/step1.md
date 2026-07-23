# Step 1: tracking-mode-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 1, 2, 10
- `/docs/ARCHITECTURE.md` — "상태 관리" 절, `features/theme` 설명
- `/docs/persistence/lifecycle.md` — "부팅 시 하이드레이션" 절(현재 apiKey/selectedAccountId·theme 딱 2가지만 부팅 시 복원한다는 서술 — 이 step으로 3번째가 추가된다)
- `/src/features/theme/store.ts` — 이번 step이 그대로 따라야 할 Zustand 스토어 패턴(가장 단순한 "저장값 하나 복원 + 설정" 스토어)
- **이전 step(`storage-tracking-layer`)에서 만들어진 `/src/storage/tracking-mode.ts`** — 정확한 함수 시그니처를 그대로 가져다 쓸 것
- `/src/App.tsx` — `AppShell`의 부팅 하이드레이션 `useEffect` 부분(어디에 새 스토어 복원 호출을 추가해야 하는지)

이전 step에서 만들어진 `storage/tracking-mode.ts`의 `TrackingMode`/`getTrackingMode`/`setTrackingMode`를 정확히 이해한 뒤 작업하라.

## 작업

`src/features/tracking-mode/store.ts` 신규 파일을 `features/theme/store.ts`와 동일한 구조로 작성한다.

```ts
export interface TrackingModeStore {
  mode: TrackingMode
  restoreFromStorage(): Promise<void>
  setMode(mode: TrackingMode): Promise<void>
}
```

- 초기 상태 `mode: 'auto'`.
- `restoreFromStorage()`: `storage/tracking-mode`의 `getTrackingMode()`를 호출해 `mode`를 설정한다. (`theme/store.ts`의 `restoreFromStorage`처럼 OS 설정 등 추가 판정 로직은 없다 — ADR-035에 그런 요구사항이 없다.)
- `setMode(mode)`: 이 step에서는 `storage/tracking-mode`의 `setTrackingMode(mode)`를 호출해 저장하고 상태를 갱신하는 것까지만 한다. **시드 트리거(ADR-035 결정 14) 로직은 이 step에 넣지 마라** — 다음 step(`manual-tracking-seed`)이 이 함수를 확장한다.

`src/App.tsx`의 `AppShell`에 `useTrackingModeStore`를 import하고, 기존 `restoreFromStorage()`/`restoreThemeFromStorage()`가 호출되는 동일한 `useEffect` 블록 안에서 `restoreTrackingModeFromStorage()`도 함께 호출한다(딱 이 세 가지 — apiKey/selectedAccountId, theme, trackingMode — 가 부팅 시 즉시 복원되는 상태가 된다).

`docs/persistence/lifecycle.md`의 "부팅 시 하이드레이션" mermaid 다이어그램(딱 두 가지만 즉시 복원)을 갱신해 세 번째 항목(`trackingMode`)을 반영한다.

### 테스트 (TDD)

`src/features/tracking-mode/__tests__/store.test.ts` 신규 작성. `features/theme/__tests__/store.test.ts`(있다면)의 모킹 패턴을 참고해 `storage/tracking-mode`를 모킹하고 다음을 검증한다:
- `restoreFromStorage()`는 저장된 모드를 그대로 반영한다(저장값 없으면 `'auto'`).
- `setMode('manual')`은 `setTrackingMode`를 호출하고 상태를 `'manual'`로 갱신한다.

`App.tsx`의 부팅 하이드레이션 테스트가 이미 있다면(예: `App.test.tsx`) `restoreTrackingModeFromStorage`가 호출되는지 검증하는 assertion을 추가한다. 테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/tracking-mode/`가 `storage/tracking-mode.ts`만 거쳐 데이터에 접근하는가(CLAUDE.md CRITICAL — features가 storage를 직접 우회하지 않는가는 이미 storage 어댑터를 쓰므로 해당 없음, 다른 storage 파일에 직접 접근하지 않는지만 확인)?
   - `setMode`에 시드 로직을 미리 넣지 않았는가(다음 step 범위 침범 금지)?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 1`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `setMode`에 ADR-035 결정 14(시드 트리거)를 미리 구현하지 마라. 이유: 다음 step(`manual-tracking-seed`)의 범위이며, storage/seed 로직과 상태 관리를 한 커밋에 섞으면 리뷰·롤백 단위가 커진다.
- `features/onboarding`이나 `app/settings`를 이 step에서 수정하지 마라(온보딩 화면·설정 토글 UI는 각각 이후 별도 step의 범위).
- `theme/store.ts`의 기존 로직(OS 다크모드 판정 등)을 건드리지 마라.
- 기존 테스트를 깨뜨리지 마라.
