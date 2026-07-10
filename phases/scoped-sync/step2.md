# Step 2: daily-screen-scoped-fetch

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/daily/DailyScreen.tsx`, `src/app/daily/__tests__/DailyScreen.test.tsx` — 지금 구현 전체를 읽어라. 지금은 마운트 시 인자 없이 `refresh()`를 호출해 계정 전체 캐릭터를 동기화한 뒤, 화면에서 `characters.filter(c => trackedOcids.includes(c.ocid))`로 걸러서 보여주고 있다.
- `src/features/daily-scheduler/store.ts` — 이전 step(`scoped-refresh-stores`)에서 바뀐 `refresh(ocids: string[]): Promise<void>`.
- `src/features/schedule-sync/schedule-sync.ts` — `getRegisteredCharacters(): Promise<MapleCharacter[]>`(캐릭터 목록만 조회, 스케줄 동기화 없음 — API 호출 1번).
- `src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — `allCharacters` prop이 `Array<{ ocid: string; characterName: string }>`를 받는다는 것 확인.

## 배경

지금 화면은 "필터링은 화면에서, 동기화는 전체를 대상으로"라는 구조였다. 이번 step은 이걸 뒤집는다 — **동기화 자체를 추적 대상 캐릭터로만 제한**한다. 그러면 "캐릭터 관리" 피커에 보여줄 전체 후보 목록은 더 이상 (동기화된) `characters`에서 뽑을 수 없다 — 스케줄 동기화를 하지 않은 캐릭터는 그 배열에 아예 없을 것이기 때문이다. 그래서 피커용 전체 목록은 `getRegisteredCharacters()`로 **별도** 조회해야 한다(이건 스케줄 동기화가 아니라 캐릭터 목록 조회라 API 호출이 가볍다).

## 작업

`DailyScreen.tsx`를 다음과 같이 수정하라:

1. **캐릭터 후보 목록(로스터)을 별도로 관리**: `const [roster, setRoster] = useState<MapleCharacter[]>([])`를 추가하고, 마운트 시 `useEffect`로 `getRegisteredCharacters()`를 호출해 채운다(스케줄 동기화와 무관하게 항상 조회 — 피커가 쓸 후보 목록이다). 이 호출이 실패해도 화면 전체를 깨뜨리지 마라(피커의 후보 목록이 비어 보이는 정도로 그친다 — 과도한 에러 UI를 새로 만들지 마라).
2. **동기화를 추적 목록에 맞춰 트리거**: 기존의 인자 없는 `useEffect(() => { refresh() }, [])`를 제거하고, 대신 `trackedOcids`가 로드된 뒤(즉 `null`이 아니게 된 뒤) `refresh(trackedOcids)`를 호출하는 `useEffect`를 추가하라(의존성 배열에 `trackedOcids` 포함). "새로고침" 버튼도 `refresh(trackedOcids ?? [])`로 호출하도록 바꿔라.
3. **필터링 로직 제거**: `characters.filter(...)`로 만들던 `visibleCharacters`는 더 이상 필요 없다 — `refresh`가 이미 추적 대상만 동기화해오므로 스토어의 `characters`가 곧 표시할 목록이다. `visibleCharacters`를 쓰던 자리를 전부 `characters`로 바꾸되, 빈 상태 판정은 `characters`가 아니라 **`trackedOcids === null || trackedOcids.length === 0`** 기준으로 하라(추적 목록 자체가 없으면 동기화를 시도하지도 않았을 것이므로).
4. **`CharacterTrackingPicker`의 `allCharacters`를 `characters` 대신 `roster`로 바꿔라** — 피커는 이제 (동기화된 일부가 아니라) 계정 전체 캐릭터 후보를 보여줘야 한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 추적 목록이 비어있을 때 `refresh`가 아예 호출되지 않거나(또는 빈 배열로 호출되어 네트워크 요청 없이 끝나거나) 최소한 캐릭터별 스케줄 API가 호출되지 않는가?
   - "캐릭터 관리" 피커가 `roster`(전체 후보)를 보여주는가, 동기화된 `characters`(추적 대상만)를 보여주는 게 아닌가?
3. `DailyScreen.test.tsx`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. `getRegisteredCharacters`도 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - 추적 목록이 로드되면 그 배열 그대로 `refresh`가 호출된다(계정 전체가 아니라).
   - 피커를 열면 `getRegisteredCharacters`로 얻은 전체 후보가 보인다(추적 여부와 무관하게).
   - "새로고침" 클릭 시 현재 추적 목록으로 `refresh`가 다시 호출된다.
   - 추적 목록을 바꿔 저장하면(피커의 "저장") 새 목록으로 `refresh`가 다시 호출된다.
4. 결과에 따라 `phases/scoped-sync/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 계정의 전체 캐릭터에 대해 스케줄 동기화를 트리거하지 마라. 이유: 이번 task의 핵심 목적이 "추적 대상만 동기화"다.
- "캐릭터 관리" 피커의 후보 목록을 동기화된 `characters`에서 뽑지 마라. 이유: 동기화 대상이 아닌 캐릭터는 그 배열에 없어서 피커에 나타나지 않게 된다.
- `getRegisteredCharacters()` 실패를 이유로 화면 전체를 에러 상태로 만들지 마라. 이유: 이건 피커용 부가 정보일 뿐, 메인 콘텐츠 동기화(`refresh`)와는 별개다.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
