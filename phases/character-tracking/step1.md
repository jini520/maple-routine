# Step 1: character-tracking-components

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/components/CharacterChipTabs/CharacterChipTabs.tsx` — 지금 일간/주간 화면이 캐릭터 전환에 쓰고 있는 컴포넌트. **이번 정책 변경으로 드롭다운으로 교체되며, 이 컴포넌트는 다음다음 step(`weekly-screen-tracking`)에서 삭제될 예정이다** — 지금은 참고만 하고 건드리지 마라.
- `/docs/UI_GUIDE.md` — 색상 토큰

## 배경

사용자가 추가한 정책: (1) 일간/주간 화면에서 추적할 캐릭터를 사용자가 직접 고를 수 있어야 하고, (2) 고른 캐릭터들 사이의 전환은 칩이 아니라 **드롭다운**으로 한다. 이번 step은 이 두 가지를 위한 재사용 컴포넌트 2개를 만든다. 화면(`DailyScreen`/`WeeklyScreen`)에 실제로 연결하는 건 다음 step들의 몫이다.

## 작업

### 1. `src/components/CharacterSelectDropdown/CharacterSelectDropdown.tsx`

```ts
export interface CharacterSelectDropdownProps {
  characters: Array<{ ocid: string; characterName: string }>
  selectedOcid: string
  onSelect: (ocid: string) => void
}
export function CharacterSelectDropdown(props: CharacterSelectDropdownProps): React.JSX.Element
```
- 네이티브 `<select>` 엘리먼트로 구현하라(커스텀 드롭다운 라이브러리를 새로 추가하지 마라 — 접근성과 모바일 웹뷰 호환성 모두 네이티브가 낫다).
- `characters` 각각을 `<option value={ocid}>{characterName}</option>`로 렌더링하고, `value={selectedOcid}`로 제어 컴포넌트로 만든다.
- `onChange` 시 선택된 `ocid`로 `onSelect`를 호출한다.

### 2. `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx`

```ts
export interface CharacterTrackingPickerProps {
  allCharacters: Array<{ ocid: string; characterName: string }>
  trackedOcids: string[]
  onSave: (ocids: string[]) => void
  onClose: () => void
}
export function CharacterTrackingPicker(props: CharacterTrackingPickerProps): React.JSX.Element
```
- 모달/시트 형태(화면을 덮는 오버레이 + 콘텐츠 박스)로 렌더링한다. 배경 오버레이 클릭이나 닫기 버튼으로 `onClose`를 호출한다(저장하지 않고 취소).
- `allCharacters` 각각에 체크박스를 렌더링하고, 초기 체크 상태는 `trackedOcids`에 포함 여부로 정한다.
- 체크박스 상태는 **로컬 상태**로만 관리하다가(부모의 `trackedOcids`를 직접 변경하지 않음), "저장" 버튼을 눌렀을 때만 그 시점의 체크된 `ocid` 배열로 `onSave`를 호출하고 닫는다(저장 전까지는 취소 가능해야 한다).
- 캐릭터가 많을 수 있으니(수십 명) 목록 영역은 스크롤 가능하게 만들어라(예: `max-h-[...] overflow-y-auto`).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 테스트를 먼저 작성한 뒤(TDD) 구현하라(둘 다 `// @vitest-environment jsdom`, `@testing-library/react` 사용).
   - `CharacterSelectDropdown.test.tsx`: 캐릭터 수만큼 옵션이 렌더링된다. 값을 바꾸면 그 `ocid`로 `onSelect`가 호출된다.
   - `CharacterTrackingPicker.test.tsx`: `trackedOcids`에 있는 캐릭터의 체크박스가 초기에 체크돼 있다. 체크박스를 토글해도 즉시 `onSave`가 호출되지 않는다(로컬 상태만 바뀜). "저장" 클릭 시 그 시점의 체크 상태로 `onSave`가 호출된다. 닫기/취소 시 `onSave` 없이 `onClose`만 호출된다.
3. 결과에 따라 `phases/character-tracking/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 동작을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 커스텀 드롭다운 UI 라이브러리를 새로 설치하지 마라. 이유: 네이티브 `<select>`로 충분하고 접근성·호환성이 낫다.
- `CharacterTrackingPicker`가 체크박스 토글마다 즉시 `onSave`를 호출하게 만들지 마라. 이유: "저장" 버튼을 눌러야 확정되는 흐름이어야 사용자가 실수로 목록을 바꾸는 걸 막는다.
- `CharacterChipTabs`를 이번 step에서 건드리거나 삭제하지 마라. 이유: 아직 화면들이 그걸 쓰고 있어서, 삭제는 그 화면들을 다 교체한 뒤(`weekly-screen-tracking` step)에 한다.
- 기존 테스트를 깨뜨리지 마라.
