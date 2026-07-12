# Step 3: weekly-screen-tracking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/weekly/WeeklyScreen.tsx`, `src/app/weekly/__tests__/WeeklyScreen.test.tsx` — 지금 구현. 전부 다시 읽어라.
- `src/app/daily/DailyScreen.tsx` — 이전 step(`daily-screen-tracking`)에서 이미 반영한 패턴(추적 목록 로드, 빈 상태 분기, 드롭다운 교체, 캐릭터 관리 버튼). 이번 주간 화면도 **같은 구조**를 따른다 — 직접 읽고 동일한 패턴을 반복하라.
- `src/storage/character-selection.ts` — `getTrackedCharacterOcids('weekly')`/`setTrackedCharacterOcids('weekly', ocids)`. **주의**: 일간은 `'daily'`, 주간은 `'weekly'` — 서로 다른 kind로 독립된 목록이다.
- `src/components/CharacterSelectDropdown/CharacterSelectDropdown.tsx`, `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx`

## 배경

일간 화면에 적용한 정책(추적 캐릭터 선택 + 드롭다운 전환 + 등록된 항목만 표시)을 주간 화면에도 그대로 적용한다. 주간은 콘텐츠가 두 종류(퀘스트 `weeklyContents`, 보스 `bosses`)라는 점만 다르다 — **둘 다** `isRegistered === true`인 것만 표시해야 한다(보스도 예외 없이 미등록이면 필터링).

## 작업

`WeeklyScreen.tsx`를 `DailyScreen.tsx`와 같은 구조로 수정하라:

1. 마운트 시 `getTrackedCharacterOcids('weekly')`로 추적 목록을 로드한다.
2. `characters`에서 추적 목록에 포함된 `ocid`만 걸러 `visibleCharacters`를 만든다.
3. 추적 목록이 비어있으면(`null` 또는 `[]`, 또는 `visibleCharacters`가 결과적으로 빈 배열) 상태와 무관하게 빈 상태 안내 + "캐릭터 관리" 버튼만 보여준다.
4. `CharacterChipTabs` 대신 `CharacterSelectDropdown`을 `visibleCharacters`로 렌더링한다.
5. 선택된 캐릭터의 `weeklyContents`와 `bosses`를 각각 `isRegistered === true`인 것만 걸러 렌더링한다(둘 다 필터링 대상). 빈 상태 판정도 필터링된 배열 기준으로 바꿔라.
6. "캐릭터 관리" 버튼 추가 — `setTrackedCharacterOcids('weekly', ocids)`로 저장(kind가 `'weekly'`인 것에 주의).

**`CharacterChipTabs` 삭제**: 이 step까지 끝나면 `CharacterChipTabs`를 쓰는 화면이 하나도 남지 않는다. `src/components/CharacterChipTabs/`(컴포넌트 파일 + 테스트 파일 전부)를 삭제하라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/components/CharacterChipTabs/` 디렉토리 자체가 삭제됐는가(레포 전체에서 더 이상 참조되지 않는가)?
   - 화면에 보이는 `weeklyContents`/`bosses`가 전부 `isRegistered: true`인가?
   - 일간(`'daily'`)과 주간(`'weekly'`)의 추적 목록이 서로 다른 storage 키를 쓰는가(하나를 저장해도 다른 화면에 영향 없는가)?
3. `WeeklyScreen.test.tsx`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. 최소한 다음을 검증하라:
   - 추적 목록이 `null`이면 빈 상태 안내가 보인다.
   - `isRegistered: false`인 `weeklyContents`/`bosses` 항목이 화면에 렌더링되지 않는다.
   - 드롭다운에 추적 목록의 캐릭터만 옵션으로 나온다.
4. 결과에 따라 `phases/character-tracking/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 보스 목록에서 `isRegistered` 필터링을 빠뜨리지 마라. 이유: 사용자 정책은 "일간/주간 스케줄러에는 등록된 스케줄만" — 주간 화면의 보스도 스케줄의 일부다.
- 일간과 주간의 추적 목록을 같은 storage 키로 저장하지 마라. 이유: 화면별로 독립적으로 관리하기로 확정했다.
- `CharacterChipTabs` 삭제를 빠뜨리지 마라. 이유: 아무도 안 쓰는 죽은 코드를 남겨두면 안 된다.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신, `CharacterChipTabs` 테스트는 컴포넌트와 함께 삭제).
