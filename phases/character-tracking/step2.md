# Step 2: daily-screen-tracking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/daily/DailyScreen.tsx`, `src/app/daily/__tests__/DailyScreen.test.tsx` — 지금 구현. 전부 다시 읽어라. 캐릭터 칩 탭으로 전환하는 구조, 상단 동기화 안내, 진행바 카드가 이미 있다.
- `src/storage/character-selection.ts` — 이전 step(`storage-character-selection`)에서 만든 `getTrackedCharacterOcids('daily')`/`setTrackedCharacterOcids('daily', ocids)`.
- `src/components/CharacterSelectDropdown/CharacterSelectDropdown.tsx`, `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — 이전 step(`character-tracking-components`)에서 만든 컴포넌트. 정확한 props는 그 파일에서 확인하라.
- `src/features/daily-scheduler/store.ts` — `DailyCharacterView`(`{ ocid, characterName, dailyContents, isStale, syncedAt, error }`)

## 배경

사용자가 추가한 정책 2가지를 일간 화면에 반영한다:
1. **추적 캐릭터 선택**: 사용자가 고른 캐릭터만 화면에 표시한다. 아직 아무것도 안 골랐으면(`getTrackedCharacterOcids('daily')`가 `null`이거나 `[]`) 빈 상태로 "캐릭터를 선택해주세요" 안내 + 캐릭터 관리 버튼만 보여준다.
2. **등록된 스케줄만 표시**: `dailyContents` 중 `isRegistered === true`인 항목만 화면에 표시한다(미등록 항목은 아예 안 보이게 필터링 — 흐리게 표시하는 게 아니라 목록에서 제거).
3. **드롭다운 전환**: 기존 `CharacterChipTabs`를 `CharacterSelectDropdown`으로 교체한다. 드롭다운에는 **추적 대상으로 고른 캐릭터만** 나온다(전체 캐릭터가 아니다).

## 작업

`DailyScreen.tsx`를 다음과 같이 수정하라:

1. 마운트 시(`useEffect`, 기존 `refresh()` 호출과 같은 곳이거나 별도 effect) `getTrackedCharacterOcids('daily')`를 호출해 추적 목록을 로컬 상태에 저장한다. 캐릭터 관리 피커에서 저장할 때도 이 로컬 상태를 갱신한다.
2. `characters`(스토어의 전체 캐릭터 목록)에서 추적 목록에 포함된 `ocid`만 걸러 `visibleCharacters`를 만든다.
3. **추적 목록이 비어있으면**(로드 전 `null`이거나 사용자가 `[]`로 저장했거나, `visibleCharacters`가 결과적으로 빈 배열이면) 로딩/에러 상태와 무관하게 "표시할 캐릭터가 없습니다 — 캐릭터를 선택해주세요" 안내와 "캐릭터 관리" 버튼만 보여주고 나머지 콘텐츠는 렌더링하지 마라.
4. 추적 목록이 있으면 기존 로딩/에러/로드 분기를 `visibleCharacters` 기준으로 그대로 유지하되:
   - `CharacterChipTabs` 대신 `CharacterSelectDropdown`을 `visibleCharacters`로 렌더링한다.
   - 선택된 캐릭터의 `dailyContents`를 `isRegistered === true`인 것만 걸러 `registeredContents`로 만들고, 이걸로 카드 목록을 렌더링한다. 빈 상태 판정("게임에서 스케줄러에 등록해주세요")도 `registeredContents.length === 0 && !isStale` 기준으로 바꿔라(기존엔 필터링 전 `dailyContents`를 기준으로 했었다).
5. 화면 상단 어딘가에 항상 보이는 "캐릭터 관리" 버튼을 추가한다. 클릭하면 `CharacterTrackingPicker`를 연다(`allCharacters={characters}`, `trackedOcids={현재 추적 목록}`). `onSave`에서 `setTrackedCharacterOcids('daily', ocids)`로 저장하고 로컬 추적 목록 상태를 갱신한 뒤 피커를 닫는다. `onClose`는 그냥 피커만 닫는다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `CharacterChipTabs`를 더 이상 import하지 않는가?
   - 추적 목록이 비어있을 때 로딩/에러 상태와 무관하게 안내+버튼만 보이는가?
   - 화면에 보이는 `dailyContents`가 전부 `isRegistered: true`인가(미등록 항목이 하나도 안 보이는가)?
3. `DailyScreen.test.tsx`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. `src/storage/character-selection`은 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - 추적 목록이 `null`이면 캐릭터 데이터 상태(로딩 중이든 로드 완료든)와 무관하게 빈 상태 안내가 보인다.
   - 추적 목록에 캐릭터 2명이 있으면 드롭다운에 그 2명만 옵션으로 나온다(전체 캐릭터가 더 많아도).
   - `isRegistered: false`인 `dailyContents` 항목은 화면에 렌더링되지 않는다.
   - 캐릭터 관리 버튼으로 피커를 열고 저장하면 `setTrackedCharacterOcids`가 호출되고 화면에 반영된다.
4. 결과에 따라 `phases/character-tracking/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 미등록(`isRegistered: false`) 항목을 흐리게 표시하는 식으로 남겨두지 마라. 이유: 이번 정책은 "표시 제한"이지 "흐리게 구분"이 아니다 — 목록에서 아예 빼야 한다.
- 드롭다운에 추적 대상이 아닌 캐릭터까지 옵션으로 넣지 마라.
- `CharacterChipTabs`를 이번 step에서 삭제하지 마라. 이유: 주간 화면이 아직 쓰고 있다 — 삭제는 다음 step(`weekly-screen-tracking`)에서 한다.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
