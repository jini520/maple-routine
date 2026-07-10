# Step 3: daily-screen-redesign

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/daily/DailyScreen.tsx`, `src/app/daily/__tests__/DailyScreen.test.tsx` — 지금 구현. 전부 다시 읽고 정확한 현재 구조를 파악하라.
- `src/components/CharacterChipTabs/CharacterChipTabs.tsx` — 이전 step(`character-chip-tabs`)에서 만든 컴포넌트. `{ characters: Array<{ ocid, characterName }>, selectedOcid, onSelect }` props.
- `src/features/daily-scheduler/store.ts` — `useDailySchedulerStore`. `DailyCharacterView`(`{ ocid, characterName, dailyContents, isStale, syncedAt, error }`)
- `src/features/schedule-sync/format.ts` — `formatScheduleSyncError`, `formatSyncedAt`

## 배경

사용자가 제공한 실제 와이어프레임을 검토한 결과, 일간 화면은 지금처럼 모든 캐릭터를 카드로 쭉 나열하는 게 아니라, **캐릭터 칩 탭으로 한 번에 한 캐릭터만 보여주는 구조**였다(그대로 옮김):

```
상단: "마지막 동기화 3분 전 · 새로고침" (동기화 시각 + 새로고침 액션)
칩 탭: [낟낟(활성)] [내옆에최성일]   ← 캐릭터 전환
콘텐츠 카드(선택된 캐릭터만): "몬스터파크  7/14" + 진행바(50% 채워짐)
콘텐츠 카드: 다른 항목 + 진행바
(항목이 없으면) 점선 박스: "게임에서 먼저 스케줄러에 등록해주세요"
```

핵심 변화 3가지: (1) 전체 캐릭터 나열 → 칩으로 전환해서 1명씩, (2) 캐릭터별 동기화 실패 안내가 카드마다 흩어져 있던 것 → 상단 한 곳(현재 선택된 캐릭터 기준)으로 모음, (3) 단순 "n/m" 텍스트만 있던 것 → 진행바 시각 요소 추가.

와이어프레임의 축소된 폰트 크기(9~13px)는 그대로 베끼지 말고 지금 쓰고 있는 크기(`text-sm` 등)를 유지하라 — **구조**만 맞추면 된다.

## 작업

`DailyScreen.tsx`를 다음과 같이 다시 작성하라:

1. 로컬 상태로 `selectedOcid`를 관리한다(`useState<string | null>`, 초기값 `null`). `characters`가 로드되고 `selectedOcid`가 `null`이거나 더 이상 `characters` 안에 없으면 첫 번째 캐릭터의 `ocid`로 맞춘다.
2. 상단 영역: 현재 선택된 캐릭터(`selected`)의 `formatSyncedAt(selected.syncedAt)`와 "새로고침" 버튼(클릭 시 `refresh()`)을 함께 배치한다. `selected.isStale`이면 같은 영역에 `formatScheduleSyncError(selected.error)`도 보여준다. **캐릭터별 개별 카드에 있던 stale/에러 안내는 이 상단 영역 하나로 옮기고 카드에서는 제거하라.**
3. `CharacterChipTabs`에 `characters`(각 캐릭터의 `ocid`/`characterName`)와 `selectedOcid`, 선택 변경 핸들러를 전달해 렌더링한다.
4. `selected.dailyContents`를 카드 목록으로 렌더링한다. 각 카드: 제목 + `nowCount`/`maxCount` 텍스트 + 그 아래 진행바(`maxCount > 0`이면 `width: (nowCount/maxCount)*100%`인 채움 바, `maxCount === 0`이면 진행바 없이 텍스트만).
5. `selected.dailyContents`가 비어있고 `selected.isStale`이 아니면 점선 박스 빈 상태 안내("게임에서 스케줄러에 등록해주세요" 등, 기존 문구 재사용 가능)를 보여준다.
6. `status`가 `'idle'`/`'loading'`/`'error'`일 때의 기존 분기는 그대로 유지한다(캐릭터 목록 자체를 못 가져온 경우).

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 화면에 캐릭터 전부가 동시에 나열되지 않고 칩으로 선택된 한 캐릭터만 보이는가?
   - `formatScheduleSyncError`/`formatSyncedAt`을 새로 만들지 않고 기존 걸 재사용했는가?
3. `DailyScreen.test.tsx`를 이번 구조에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. 최소한 다음을 검증하라:
   - 캐릭터가 여러 명이면 칩 탭이 캐릭터 수만큼 렌더링된다.
   - 기본으로 첫 번째 캐릭터가 선택돼 그 `dailyContents`만 보인다.
   - 다른 칩을 클릭하면 그 캐릭터의 `dailyContents`로 화면이 바뀐다.
   - 선택된 캐릭터가 `isStale: true`이면 상단에 에러 안내가 보인다.
   - "새로고침" 클릭 시 `refresh`가 호출된다.
4. 결과에 따라 `phases/wireframe-redesign/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 모든 캐릭터를 동시에 화면에 나열하지 마라. 이유: 와이어프레임은 칩으로 전환해 한 캐릭터씩 보여주는 구조다.
- `CharacterChipTabs`나 `format.ts`의 기존 시그니처를 바꾸지 마라. 이유: 다른 화면(주간)도 같은 컴포넌트/헬퍼를 그대로 재사용해야 한다.
- 와이어프레임의 축소된 폰트 크기를 그대로 쓰지 마라.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
