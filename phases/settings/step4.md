# Step 4: settings-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md`의 "컴포넌트" 섹션 전체(카드/버튼/캐릭터 카드 그리드 스타일), "색상" 섹션의 "데이터/시맨틱 색상" 표
- `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` (오버레이 모달 마크업 패턴 — `DisconnectConfirm`이 그대로 재사용할 구조)
- `src/app/onboarding/ApiKeyForm.tsx`, `src/app/onboarding/AccountSelectionList.tsx` (카드 스타일 `rounded-[14px] bg-surface border border-border p-6` — `ThemeSelector`도 동일 스타일을 쓴다). **이 두 컴포넌트는 이번 step에서 수정하지 않는다 — 다음 step에서 그대로 import해서 재사용한다.**
- `src/types/theme.ts` (Step 0에서 만든 `ThemeName`)
- `src/app/onboarding/__tests__/ApiKeyForm.test.tsx` (컴포넌트 테스트 스타일 — `@vitest-environment jsdom`, `@testing-library/react`, `userEvent` 사용법)

## 작업

이번 step은 프레젠테이션 컴포넌트만 만든다 — 상태는 전부 props로 받고, `features/settings`나 `features/theme`을 직접 import하지 않는다(다음 step에서 `SettingsScreen`이 연결한다).

### 1. `src/app/settings/ThemeSelector.tsx` (신규)

```ts
export interface ThemeSelectorProps {
  theme: ThemeName
  onSelect: (theme: ThemeName) => void
}

export function ThemeSelector(props: ThemeSelectorProps): React.JSX.Element
```

- `rounded-[14px] bg-surface border border-border p-6 space-y-4` 카드 안에 "레테"/"렌" 두 개 버튼을 나란히 배치한다.
- 각 버튼은 `CharacterTrackingPicker`의 카드 토글 패턴을 따른다 — `aria-pressed={theme === '레테' | '렌'}`, 선택 시 `border-primary bg-primary/15`, 미선택 시 `border-border hover:bg-primary/15`. 체크박스 엘리먼트는 쓰지 않는다.
- 클릭 시 `props.onSelect('레테' | '렌')` 호출.

### 2. `src/app/settings/DisconnectConfirm.tsx` (신규)

```ts
export interface DisconnectConfirmProps {
  isOpen: boolean
  isDisconnecting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DisconnectConfirm(props: DisconnectConfirmProps): React.JSX.Element | null
```

- `props.isOpen`이 `false`면 `null`을 반환한다(마운트는 항상 되어 있고 조건부로 안 그리는 방식 — `SettingsScreen`이 `isOpen`만 토글).
- `CharacterTrackingPicker`와 동일한 오버레이 마크업 구조를 재사용한다: 바깥 div `fixed inset-0 flex items-center justify-center bg-bg/70` + `onClick={props.onCancel}`, 안쪽 카드 `onClick={(e) => e.stopPropagation()}` + `w-full max-w-sm rounded-[14px] border border-border bg-surface p-6`.
- 카드 내용: 제목("연결을 해제할까요?"), 설명 문구(API 키와 계정 연결이 해제되고 온보딩 화면으로 돌아간다는 안내, 보스 수익·드랍 기록은 삭제되지 않는다는 안내 — `docs/PRD.md` "6. 설정 화면"의 계정 변경 항목 문구를 참고해 톤을 맞춘다), 취소 버튼(`props.onCancel`), 확인 버튼(`props.onConfirm`, `props.isDisconnecting`이면 disabled + 진행 중 표시).
- 확인 버튼은 위험한 동작이므로 Primary 버튼 색(`bg-primary`)이 아니라 `text-error`/`border-error` 계열로 시각적으로 구분한다(다른 화면의 에러 텍스트가 쓰는 `text-error` 토큰 재사용, 새 색상 값을 만들지 않는다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 두 컴포넌트 모두 `features/`를 import하지 않는가(순수 프레젠테이션 컴포넌트인가)?
   - `docs/UI_GUIDE.md`의 라운딩 스케일(카드 14px)·색상 토큰(`bg-surface`/`border-border`/`text-error` 등)을 하드코딩된 hex 값 대신 그대로 썼는가?
3. `src/app/settings/__tests__/ThemeSelector.test.tsx`(신규)에 다음을 검증한다:
   - `theme='렌'`일 때 "렌" 버튼에 `aria-pressed="true"`, "레테" 버튼에 `aria-pressed="false"`
   - "레테" 버튼 클릭 시 `onSelect`가 `'레테'`로 호출됨
4. `src/app/settings/__tests__/DisconnectConfirm.test.tsx`(신규)에 다음을 검증한다:
   - `isOpen=false`면 아무것도 렌더링되지 않음(`container.firstChild === null` 또는 동등한 검증)
   - `isOpen=true`일 때 확인 버튼 클릭 시 `onConfirm` 호출, 취소 버튼 또는 오버레이 바깥 클릭 시 `onCancel` 호출
   - `isDisconnecting=true`면 확인 버튼이 disabled 상태
5. 결과에 따라 `phases/settings/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/app/onboarding/ApiKeyForm.tsx`·`AccountSelectionList.tsx`를 복사하거나 수정하지 마라 — 다음 step에서 원본 그대로 import해서 쓴다.
- 이 step에서 `features/settings/`, `features/theme/`를 import하거나 실제 상태 관리 로직을 넣지 마라 — 전부 props로만 동작해야 한다.
- 기존 테스트를 깨뜨리지 마라.
