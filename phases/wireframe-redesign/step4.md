# Step 4: weekly-screen-redesign

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/app/weekly/WeeklyScreen.tsx`, `src/app/weekly/__tests__/WeeklyScreen.test.tsx` — 지금 구현. 전부 다시 읽어라.
- `src/app/daily/DailyScreen.tsx` — 이전 step(`daily-screen-redesign`)에서 만든 구조(칩 탭으로 캐릭터 전환, 상단에 동기화 시각+새로고침+에러 안내). 이번 주간 화면도 같은 골격을 따른다.
- `src/components/CharacterChipTabs/CharacterChipTabs.tsx` — 재사용한다.
- `src/components/BossPortrait/BossPortrait.tsx`, `src/components/BossPortrait/__tests__/BossPortrait.test.tsx` — **이번 step에서 이 컴포넌트 자체를 수정한다**(아래 참고).
- `src/features/weekly-scheduler/store.ts` — `WeeklyCharacterView`(`{ ocid, characterName, weeklyContents, bosses: MatchedBoss[], weeklyBossClearCount, weeklyBossClearLimitCount, isStale, syncedAt, error }`)

## 배경

사용자가 제공한 실제 와이어프레임을 검토한 결과, 주간 화면도 일간과 마찬가지로 칩 탭 구조였고, 추가로 다음과 같은 차이가 있었다(그대로 옮김):

```
상단: (전 step과 동일한 골격) 동기화 시각 + 새로고침 + 에러 안내, 칩 탭
"주간 퀘스트" 섹션 제목
  체크 아이콘 + "에픽 던전 : 악몽선경" (한 줄)
  ... (weeklyContents 항목마다 반복)
"주간 보스" 섹션 제목 + "8/12" 뱃지
  체크(완료) + 작은 원형 초상화(20px) + "보스명 · 난이도" (한 줄)
  체크(미완료, 빈 원) + 원형 플레이스홀더(초상화 없음) + "자쿰 · 카오스" (한 줄)
  ... (bosses 항목마다 반복)
```

지금 구현은 보스 하나당 큰 정사각형 초상화(64px, `w-16 h-16`) + 별도 줄에 "보스명 · 난이도 · 등록됨/미등록 · 완료/미완료" 텍스트로 돼 있다. 와이어프레임은 훨씬 컴팩트하다 — 체크 아이콘(완료 여부) + **작은 원형** 초상화(20px) + 보스명·난이도만 한 줄에 압축돼 있다.

**등록 여부(`isRegistered`) 표시 규칙**: 와이어프레임 저충실도 목업엔 등록 안 된 상태의 예시가 명확히 그려져 있지 않지만, 실제 데이터는 미등록 항목도 존재할 수 있다([[ADR-007]] — API 응답엔 미등록 콘텐츠도 포함됨). 이 정보를 지우지 말고, 체크 아이콘은 **완료 여부(`isComplete`)**만 나타내고(완료=채워진 체크, 미완료=빈 원), **미등록(`isRegistered: false`)인 항목은 텍스트 색을 흐리게**(예: `text-[#B7A490]`, UI_GUIDE 비활성 색상) 해서 구분하라.

와이어프레임의 축소된 폰트 크기(9~13px)는 그대로 베끼지 말고 지금 크기(`text-sm` 등)를 유지하라.

## 작업

### 1. `BossPortrait.tsx` 수정 — 정사각형 → 원형 컴팩트로

지금 `rounded-[14px]`(정사각형에 둥근 모서리)로 돼 있는 `<img>`와 플레이스홀더 `<div>`를 `rounded-full`(완전한 원)로 바꿔라. 크기는 부모가 wrapper로 정하는 방식(지금처럼)을 유지해도 되고, 컴포넌트 자체에 작은 고정 크기(예: `w-5 h-5`)를 내장해도 된다 — 재량. 이미지가 있을 때 원 안에 꽉 차 보이도록 `object-cover`도 추가하라. 플레이스홀더(이미지 없을 때)의 텍스트는 원 안에 다 안 들어갈 테니, 텍스트 대신 물음표(`?`) 같은 짧은 기호로 바꾸고 `label`은 `title` 속성(툴팁)이나 `aria-label`로만 남겨도 된다 — 재량.

### 2. `WeeklyScreen.tsx` 재작성

`DailyScreen`과 같은 골격(칩 탭으로 캐릭터 전환, 상단에 동기화 시각+새로고침+에러 안내)을 따르되, 콘텐츠 부분을 다음과 같이 바꿔라:
- "주간 퀘스트" 섹션 제목 아래, 선택된 캐릭터의 `weeklyContents` 각 항목을 체크 아이콘(`isRegistered`가 아니라 이 항목엔 완료 개념이 명확하지 않으니 재량 — 등록 여부로 체크 표시해도 됨, 아래 보스 섹션과 다르게 판단해도 무방) + 이름을 한 줄로 렌더링한다.
- "주간 보스" 섹션 제목 + (`weeklyBossClearCount`/`weeklyBossClearLimitCount` 둘 다 있을 때만) "n/12" 뱃지를 함께 표시한다.
- `bosses` 각 항목을 체크 아이콘(`isComplete` 기준, 완료=채워짐/미완료=빈 원) + `BossPortrait`(원형, 작게) + "보스명 · 난이도" 한 줄로 렌더링한다. `isRegistered`가 `false`면 그 줄 텍스트를 흐린 색으로 표시한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - 캐릭터 전체 나열이 아니라 칩으로 전환해 한 캐릭터씩 보이는가?
   - 보스 항목이 큰 정사각형이 아니라 작은 원형 초상화 + 한 줄 텍스트로 압축됐는가?
   - `BossPortrait`가 `rounded-full`로 바뀌었는가?
3. `BossPortrait.test.tsx`와 `WeeklyScreen.test.tsx`를 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. 최소한 다음을 검증하라:
   - `BossPortrait`가 이미지 있을 때 원형 클래스(`rounded-full`)를 갖는다.
   - 캐릭터 칩 전환 시 그 캐릭터의 `weeklyContents`/`bosses`로 화면이 바뀐다.
   - `isComplete: true`인 보스는 채워진 체크, `false`인 보스는 빈 체크로 구분된다.
   - `isRegistered: false`인 보스 항목은 흐린 텍스트색이 적용된다.
   - `weeklyBossClearCount`/`weeklyBossClearLimitCount`가 둘 다 있을 때만 "n/12" 뱃지가 보인다.
4. 결과에 따라 `phases/wireframe-redesign/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- 보스 항목의 등록 여부(`isRegistered`) 정보를 화면에서 완전히 지우지 마라. 이유: 실제 API 데이터의 일부이고, 흐린 텍스트색 등으로라도 구분해서 보여줘야 한다.
- 난이도를 숨기거나 같은 보스의 여러 난이도를 하나로 합치지 마라. 이유: 이전 task에서 이미 확정한 규칙([[ADR-011]]은 물욕 아이템 화면 얘기이지 이 화면과 무관)이고 이번 재설계도 그대로 유지한다.
- 와이어프레임의 축소된 폰트 크기를 그대로 쓰지 마라.
- 기존 테스트를 깨뜨리지 마라(단, 이번 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
