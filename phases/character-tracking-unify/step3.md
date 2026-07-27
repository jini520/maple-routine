# Step 3: picker-save-guard

이 step은 이슈 #31의 (a)를 구현한다 — 캐릭터 관리 피커에서 선택 집합이 저장된 집합과 **같으면 "저장" 버튼을 비활성**한다. 컴포넌트 내부 상태·props만으로 판정하므로 스토어·저장 계층과 독립이다. ADR-043 결정 1.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `/docs/ADR.md` — **ADR-043 결정 1**(집합 동일성 비교, `Set` 필수, 배열/문자열 비교 금지).
- `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — 주 수정 대상. `selectedOcids` 상태(초기값 `props.trackedOcids`), 무조건 활성인 "저장" 버튼(`onClick={() => props.onSave(selectedOcids)}`).
- `/src/components/CharacterTrackingPicker/CharacterTrackingGrid.tsx` — `toggle`이 ocid를 **배열 끝에 append**(`[...checkedOcids, ocid]`)한다. 따라서 `['a','b']`와 `['b','a']`는 같은 집합이나 배열 순서가 다르다 → 반드시 집합 비교.
- `/src/components/CharacterTrackingPicker/__tests__/CharacterTrackingPicker.test.tsx` — 테스트 컨벤션(렌더·클릭·onSave 단언 방식).

이 step은 스토어를 읽거나 수정하지 않는다. 컴포넌트 props/state만 다룬다.

## 작업

`src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` 수정:

- 현재 `selectedOcids`(state)와 `props.trackedOcids`(저장된 집합)가 **집합으로 동일**한지 판정하는 값을 만든다 — 순서·중복 무시. `Set` 기반으로: 크기가 같고, 한쪽의 모든 원소가 다른 쪽에 있으면 동일.
- 동일하면 "저장" 버튼을 `disabled` 처리한다. 시각적으로도 비활성임이 드러나게 하되(예: `disabled:opacity-50 disabled:cursor-not-allowed` 또는 프로젝트의 기존 비활성 버튼 패턴 재사용 — `AccountSelectionList`/`ContentCharacterStep`의 "계속하기" 비활성 스타일 참고), **기존 활성 스타일·레이아웃은 유지**한다.
- "닫기" 버튼과 `onSave`/`onClose` 콜백 시그니처는 바꾸지 않는다.

**주의**:
- **배열 비교(`===`, `JSON.stringify`, 길이만 비교 등)를 쓰지 마라.** 이유: Grid의 toggle이 순서를 바꾸므로 같은 집합도 배열이 달라 "변경됨"으로 오판해 비활성이 동작하지 않는다(ADR-043 결정 1). 반드시 멤버십(집합) 비교.
- 초기 상태(아무것도 안 바꿈)에서 `selectedOcids === props.trackedOcids`이므로 저장 버튼은 처음에 비활성이어야 한다.

## Acceptance Criteria

```bash
npm run build
npm test        # 피커 신규/수정 테스트 포함
npm run lint
```

## 검증 절차

1. 위 AC 실행.
2. 아키텍처 체크리스트:
   - `Set` 기반 집합 비교인가(배열 순서에 의존하지 않는가)?
   - 컴포넌트가 스토어/저장 계층을 직접 호출하지 않는가(props/state만)?
   - 기존 `onSave`/`onClose` 계약을 바꾸지 않았는가?
   - CLAUDE.md CRITICAL(TDD) 준수?
3. `phases/character-tracking-unify/index.json`의 step 3 업데이트:
   - 성공 → `"completed"` + `summary`
   - 3회 실패 → `"error"` + `error_message`
   - 개입 필요 → `"blocked"` + `blocked_reason` 후 중단

### 이 step에서 추가/수정할 테스트

`__tests__/CharacterTrackingPicker.test.tsx`에 케이스 추가(먼저 작성):
- 초기 렌더(선택=저장된 집합)에서 "저장" 버튼이 `disabled`.
- 캐릭터를 하나 추가로 체크하면 "저장" 버튼이 활성.
- 체크했다가 다시 해제해 원래 집합으로 되돌리면 "저장" 버튼이 다시 `disabled`.
- 순서만 다른 동일 집합(예: 저장된 게 `['a','b']`, 선택이 `['b','a']`가 되는 토글 시퀀스)에서 `disabled` 유지 — **집합 비교 회귀 방지**.
- 활성 상태에서 "저장" 클릭 시 `onSave`가 현재 선택으로 호출됨(기존 동작 보존).

## 금지사항

- `CharacterTrackingGrid.tsx`의 toggle 로직(append 방식)을 바꾸지 마라. 이유: 순서가 아니라 **비교 방식**을 집합으로 하는 게 이 step의 해법이다. Grid를 바꾸면 다른 사용처(온보딩 `ContentCharacterStep`)에 파급된다.
- 스토어(`features/*/store.ts`)나 저장 계층을 수정하지 마라. 이유: 이 step은 순수 컴포넌트 변경이다.
- 기존 테스트를 깨뜨리지 마라.
