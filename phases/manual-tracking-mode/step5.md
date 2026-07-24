# Step 5: onboarding-content-character-step

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-035 결정 13, 14(b), 15
- **이전 step에서 수정된 `/src/features/onboarding/state.ts`**(`OnboardingStatus`, `SELECT_TRACKING_MODE` 이벤트) — 이 step이 `'completed'`로 향하던 전이를 바꾼다
- **이전 step에서 수정된 `/src/features/onboarding/store.ts`**(`selectTrackingMode`)
- **이전 step에서 만들어진 `/src/features/tracking-mode/seed.ts`**(`seedManualTrackedContent`)와 `/src/features/tracking-mode/store.ts`(`useTrackingModeStore`)
- `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — 재사용 대상 컴포넌트(현재는 모달 전용, `fixed inset-0` 오버레이 + `rounded-[14px] border bg-surface` 카드로 감싸여 있음)
- `/src/features/schedule-sync/schedule-sync.ts`의 `getCharacterPickerRoster(onUpdate)` — 후보 목록(캐릭터 이미지·레벨·access_flag 반영) 조회 함수
- `/src/app/content-scheduler/ContentScreen.tsx`의 `roster`/`getCharacterPickerRoster`/`handleSaveTracking` 사용부(583~680줄 부근) — 이 화면이 피커를 여는 기존 패턴
- `/src/storage/character-selection.ts`의 `setTrackedCharacterOcids('content', ocids)`
- `/src/app/onboarding/OnboardingScreen.tsx`(직전 step에서 수정됨)

## 작업

ADR-035 결정 13: 온보딩에 "컨텐츠 추적 캐릭터 선택" 단계를 신규로 추가한다. `trackedCharacters:content`에 **1개 이상**이 저장돼야 온보딩이 완료된다(이 강제는 이 단계에서만 적용 — 기존 `CharacterTrackingPicker` 모달의 "0개 저장 가능" 동작은 절대 바꾸지 않는다, 아래 "금지사항" 참고).

### 1. `CharacterTrackingPicker`에서 그리드 내용을 재사용 가능하게 분리

`CharacterTrackingPicker.tsx`는 현재 오버레이(`fixed inset-0 ... bg-bg/70`) + 카드(`rounded-[14px] border bg-surface p-6`) 안에 "제목/설명 + 그리드"를 전부 한 컴포넌트로 갖고 있다. 이 오버레이·카드 안의 실제 그리드 렌더링(정렬·즐겨찾기 토글·얼굴 크롭·월드 엠블럼 등 `sortForDisplay`/`toggle` 로직 전체)을 별도 컴포넌트(예: `CharacterTrackingGrid`, 이름은 자유)로 추출해, 기존 `CharacterTrackingPicker`(모달)와 이번 step에서 만들 온보딩 페이지가 **동일한 로직을 공유**하도록 한다.

- 추출한 그리드 컴포넌트의 props/동작(entries, trackedOcids, 선택 토글)은 지금과 완전히 동일해야 한다 — 로직을 복제하지 말고 그대로 옮겨라.
- 기존 `CharacterTrackingPicker`의 오버레이·카드·`useBodyScrollLock` 호출은 그대로 유지한다(이 컴포넌트를 쓰는 기존 화면들의 동작·기존 테스트가 변하면 안 된다).

### 2. `src/app/onboarding/ContentCharacterStep.tsx` 신규

```tsx
export interface ContentCharacterStepProps {
  isSubmitting: boolean
  onSubmit: (ocids: string[]) => void
}

export function ContentCharacterStep(props: ContentCharacterStepProps): React.JSX.Element
```

- `getCharacterPickerRoster`로 후보 목록을 조회한다(`ContentScreen.tsx`의 기존 패턴과 동일 — 캐시 우선 stub 표시 포함).
- 위에서 추출한 그리드 컴포넌트를 오버레이·모달 카드 없이 **페이지 레이아웃**(`w-full space-y-4`)으로 렌더링한다. 제목("추적할 캐릭터를 선택해주세요" 등 — ADR-035에 정확한 카피 지정 없음, `CharacterTrackingPicker`의 기존 문구 "체크한 캐릭터만 스케줄러 목록에 표시됩니다."와 톤을 맞춰 자연스럽게 작성)과 CTA 버튼("계속하기", `AccountSelectionList.tsx`/`TrackingModeStep.tsx`와 동일한 클래스)을 둔다.
- **1개 이상 선택해야 CTA가 활성화된다**(`disabled={selectedOcids.length === 0 || props.isSubmitting}`) — 이 제약은 이 온보딩 페이지 컴포넌트에만 존재하고, 그리드 자체나 기존 `CharacterTrackingPicker` 모달에는 추가하지 않는다.
- `isSubmitting`일 때 CTA는 `TrackingModeStep`/`ApiKeyForm` 등 기존 스텝과 동일하게 스피너로 바뀐다(`MapleSpinner` 재사용, `aria-busy` 포함).

### 3. `features/onboarding/state.ts` 수정 (직전 step 결과 수정)

- `OnboardingStatus`에 `'selectingContentCharacters'`와 `'seedingTracking'`을 추가한다.
- `SELECT_TRACKING_MODE` 이벤트의 전이 대상을 `'completed'`에서 `'selectingContentCharacters'`로 바꾼다.
- 새 이벤트 `{ type: 'SUBMIT_CONTENT_CHARACTERS' }` → `'seedingTracking'`으로 전이(수동 모드일 때만 이 상태를 거친다 — 아래 store 로직 참고), `{ type: 'ONBOARDING_FINISHED' }` → `'completed'`로 전이.

### 4. `features/onboarding/store.ts` 수정

`submitContentCharacters(ocids: string[]): Promise<void>` 메서드를 추가한다:
1. `setTrackedCharacterOcids('content', ocids)`로 저장.
2. `useTrackingModeStore.getState().mode === 'manual'`이면 `SUBMIT_CONTENT_CHARACTERS`를 디스패치해 `'seedingTracking'`으로 전이한 뒤, `ocids` 전원에 대해 `seedManualTrackedContent(ocid)`를 병렬로 실행하고 끝날 때까지 기다린다(ADR-035 결정 14(b)·15 — 스피너 유지, 템플릿 기본값으로 먼저 그리지 않음).
3. 위 시드가 끝나면(또는 `auto` 모드라 애초에 시드가 필요 없으면) `ONBOARDING_FINISHED`를 디스패치해 `'completed'`로 전이한다.

### 5. `app/onboarding/OnboardingScreen.tsx` 수정

- `'selectingContentCharacters'` 케이스: `ContentCharacterStep` 렌더링, `onSubmit`을 `submitContentCharacters`에 연결.
- `'seedingTracking'` 케이스: `'prefetching'` 케이스와 동일한 스타일의 중앙 정렬 스피너 화면(문구는 "체크리스트를 준비하고 있어요" 등 자연스럽게 — 진행률 숫자는 없다, ADR-035 결정 15는 퍼센트 진행률이 아니라 단순 로딩 상태만 요구한다).

### 테스트 (TDD)

- `features/onboarding/__tests__/state.test.ts`: 새 전이(`selectingContentCharacters`→`seedingTracking`→`completed`) 검증.
- `features/onboarding/__tests__/store.test.ts`: `submitContentCharacters`가 (1) `auto` 모드면 시드 없이 바로 완료로 전이하는지, (2) `manual` 모드면 `seedManualTrackedContent`를 각 ocid에 대해 호출하고 끝난 뒤에만 완료로 전이하는지(모킹으로 순서 검증).
- `app/onboarding/__tests__/ContentCharacterStep.test.tsx` 신규: 0개 선택 시 CTA 비활성, 1개 이상 선택 시 활성화되고 클릭 시 선택된 ocid 배열로 `onSubmit` 호출.
- 기존 `components/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx`가 그대로 통과하는지 반드시 확인(그리드 추출 리팩터링이 기존 동작을 깨지 않았는지의 회귀 검증).

테스트를 먼저 작성하고 실패를 확인한 뒤 구현으로 통과시켜라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과 (기존 CharacterTrackingPicker.test.tsx 포함)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 그리드 로직이 복제가 아니라 추출·공유됐는가(같은 정렬/크롭/토글 코드가 두 파일에 중복돼 있지 않은가)?
   - `auto` 모드에서는 `'seedingTracking'` 상태를 거치지 않고 바로 완료되는가(불필요한 대기 화면 방지)?
   - 1개 이상 선택 강제가 이 온보딩 페이지에만 있고 기존 "캐릭터 관리" 모달에는 없는가(회귀 없음)?
3. 결과에 따라 `phases/manual-tracking-mode/index.json`의 `step: 5`를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 기존 `CharacterTrackingPicker`(모달)에 "1개 이상 선택 필수" 제약을 추가하지 마라. 이유: 온보딩 이후에는 사용자가 추적 캐릭터를 전부 해제할 수 있어야 한다(예: 잠시 스케줄러를 안 보고 싶을 때) — 이 제약은 온보딩 신규 페이지 전용이다.
- 그리드 렌더링 로직(정렬·얼굴 크롭·즐겨찾기·월드 엠블럼)을 온보딩 페이지용으로 새로 복제해서 짜지 마라. 이유: 두 곳에서 다르게 동작하면(예: 정렬 기준이 갈라짐) 사용자에게 혼란을 준다 — 반드시 공유 컴포넌트를 추출해서 재사용해라.
- `auto` 모드에서도 `seedManualTrackedContent`를 호출하지 마라. 이유: ADR-035 결정 5·15 — 시드는 수동 모드 전용 개념이다.
- 기존 테스트를 깨뜨리지 마라(특히 `CharacterTrackingPicker.test.tsx`).
