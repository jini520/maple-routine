# Step 6: settings-tracking-mode-toggle

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 1, 2, 10, 14(a), 15
- `/docs/UI_GUIDE.md` — "설정 리스트 행 + 모달" 절
- `/src/app/settings/SettingsScreen.tsx` — `SettingsRow` 나열, `OpenModal` 타입, 모달 열기/닫기 패턴(수정 대상)
- `/src/app/settings/ThemeModal.tsx`, `/src/app/settings/ThemeSelector.tsx` — 이 step이 그대로 따라야 할 "선택 후 즉시 반영 + 모달 닫힘" 패턴
- `/src/app/settings/ThemeSwatchDots.tsx` — 행 오른쪽에 현재 값을 배지로 보여주는 패턴
- **이전 step에서 만들어진 `/src/features/tracking-mode/store.ts`**(`useTrackingModeStore`, `mode`, `setMode`) — `setMode`가 수동 전환 시 시드(ADR-035 결정 14(a))가 끝날 때까지 resolve되지 않는다는 것을 반드시 이해할 것
- `/src/components/MapleSpinner/MapleSpinner.tsx` 또는 `ApiKeyForm.tsx`의 버튼 스피너 사용부 — 저장 중 로딩 표현 참고

## 작업

ADR-035 결정 1: 설정 화면에 자동/수동 트래킹 모드를 전역으로 전환하는 UI를 추가한다.

### 1. `src/app/settings/TrackingModeSelector.tsx` 신규

`ThemeSelector.tsx`와 동일한 패턴(옵션 버튼 목록, `aria-pressed`, 선택 시 `border-primary bg-primary/15`)으로 작성하되, 옵션은 온보딩의 `TrackingModeStep`(step 4)과 **동일한 카피**를 재사용한다(제목·본문 문구를 다시 베껴 쓰지 말고, 가능하면 `TrackingModeStep`과 공용 카피 상수로 추출해 두 곳이 어긋나지 않게 한다 — 예: `features/tracking-mode/copy.ts` 같은 작은 상수 모듈).

```ts
export interface TrackingModeSelectorProps {
  mode: TrackingMode
  isApplying: boolean // 결정 14(a) 시드 진행 중에는 옵션을 비활성화한다
  onSelect: (mode: TrackingMode) => void
}
```

### 2. `src/app/settings/TrackingModeModal.tsx` 신규

`ThemeModal.tsx`와 같은 구조:

```tsx
export interface TrackingModeModalProps {
  onClose: () => void
}
```

- `useTrackingModeStore()`에서 `mode`, `setMode`를 가져온다.
- 내부에 `isApplying` state를 둔다. `handleSelect(next)`: `next === mode`면 아무 것도 안 하고 `onClose()`만 호출. 다르면 `isApplying(true)` → `await setMode(next)`(트리거 (a) 시드가 있다면 이 await가 끝날 때까지 대기 — ADR-035 결정 15) → `onClose()`.
- `isApplying`이 `true`인 동안 `TrackingModeSelector`의 옵션 버튼들을 비활성화하고, 모달 안에 로딩 상태를 표시한다(예: 옵션 리스트 아래 `MapleSpinner` + "적용하고 있어요" 문구 — 정확한 문구는 자유, 톤만 기존과 맞출 것). **이 로딩 중에는 오버레이 클릭으로 모달이 닫히지 않게 한다**(`components/Modal`이 이미 지원하는 방식이 있다면 그걸 쓰고, 없다면 `isApplying`일 때 `onClose`를 무시하도록 감싼다) — `docs/UI_GUIDE.md`의 "캐릭터 관리 저장 진행률 모달" 원칙(저장 도중엔 닫을 수 없다)과 동일한 이유다.

### 3. `SettingsScreen.tsx` 수정

- `OpenModal` 유니온에 `'trackingMode'` 추가.
- 새 `SettingsRow`를 "테마" 행 근처(테마 행 바로 위 또는 아래 — 자유)에 추가한다. `rightContent`에 현재 모드를 배지로 보여준다(`rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted`, 테마 행과 동일한 배지 스타일). 라벨 텍스트는 "트래킹 모드"(또는 더 자연스러운 한글 표현 — 자유).
- `{openModal === 'trackingMode' && <TrackingModeModal onClose={() => setOpenModal(null)} />}` 추가.

### 테스트 (TDD)

- `app/settings/__tests__/TrackingModeModal.test.tsx` 신규: (1) 다른 모드 선택 시 `setMode`가 호출되는지, (2) `setMode`가 resolve되기 전까지 옵션이 비활성 상태를 유지하는지(미해결 Promise로 모킹해 검증), (3) 같은 모드를 다시 선택하면 `setMode`를 호출하지 않고 바로 닫히는지.
- `app/settings/__tests__/SettingsScreen.test.tsx`(있다면 확장): "트래킹 모드" 행 클릭 시 모달이 열리는지.

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 카피가 `TrackingModeStep`(온보딩)과 중복 작성되지 않고 공유되는가?
   - 시드 진행 중 오버레이 클릭으로 모달이 닫히지 않는가(`docs/UI_GUIDE.md` 기존 원칙과 일관성)?
   - `docs/UI_GUIDE.md` "설정 리스트 행 + 모달" 절에 이번에 추가한 행/모달을 간단히 기록했는가?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 6`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `setMode`가 반환하는 Promise를 기다리지 않고 모달을 먼저 닫지 마라. 이유: ADR-035 결정 15 — 시드가 끝나기 전에 모달이 닫히면 사용자가 방금 고른 모드가 아직 준비 안 된 상태(시드 전)로 화면을 보게 될 수 있다.
- 온보딩의 `TrackingModeStep` 카피를 다시 타이핑해 중복시키지 마라 — 공유 상수/모듈로 추출해라.
- `features/tracking-mode/store.ts`의 `setMode` 자체 로직(시드 트리거 조건 등)을 이 step에서 변경하지 마라. 이유: 이미 완성된 이전 step의 범위다.
- 기존 테스트를 깨뜨리지 마라.
