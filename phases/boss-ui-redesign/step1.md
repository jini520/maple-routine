# Step 1: boss-card-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "디렉토리 구조"의 `components/BossPortrait`·`assets/bosses`·`lib/boss-icons` 항목, "게임 레퍼런스 데이터"의 `boss-portrait-crops.json` 항목)
- `/docs/ADR.md`의 ADR-018 전문 — 특히 마지막의 "정정 — 보스 초상화 에셋 컨벤션 변경 (2026-07-13)" 섹션. 이 정정으로 보스 초상화가 난이도별 파일에서 보스당 1장(`{portraitSlug}.webp`)으로 이미 통합되었고, `lib/boss-icons.ts`의 `getBossPortraitUrl(portraitSlug)`는 이미 `difficulty` 파라미터가 없는 새 시그니처로 구현되어 있다(이번 step에서 다시 바꿀 필요 없음, 그대로 사용).
- `/docs/UI_GUIDE.md`의 "탭 토글(주간/월간, 일간/주간 등)" 섹션과 "보스 카드" · "난이도 뱃지" 섹션 — 이 step에서 만들 UI의 정확한 클래스/색상 값이 여기 명시되어 있다. 이 문서의 값을 그대로 쓰고 임의로 색을 바꾸지 마라.
- `/docs/PRD.md`의 "2. 보스 스케줄러" 항목의 "UI 개편(확정, 2026-07-13, [[ADR-018]])" 문단
- `src/app/boss-scheduler/BossScreen.tsx` — 현재 구현. 탭 버튼, `BossList`, `StatusDot` 함수를 꼼꼼히 읽어라.
- `src/lib/boss-icons.ts` — `getBossPortraitUrl(portraitSlug: string | null): string | null`과 `getBossPortraitCrop(portraitSlug: string | null): BossPortraitCrop`(`{ size: string, position: string }`) 두 함수가 이미 존재한다.
- `src/types/scheduler.ts`의 `BOSS_DIFFICULTIES`(`['이지', '노멀', '하드', '카오스', '익스트림']`)
- `src/lib/boss-matching.ts`의 `MatchedBoss` 타입(`apiName`, `difficulty`, `cycle`, `isRegistered`, `isComplete`, `matchedBossName`, `portraitSlug`)

## 작업

`src/app/boss-scheduler/BossScreen.tsx`를 아래와 같이 개편하라.

### 1. 탭에 pill 스타일 적용

기존 주간/월간 탭 버튼(현재 `activeTab === 'weekly' ? 'text-sm font-semibold text-primary' : 'text-sm font-medium text-text-muted'` 형태)을 아래로 바꾼다:
- 활성 탭: `rounded-full bg-primary/15 text-primary px-3 py-[5px] text-sm font-semibold`
- 비활성 탭: `text-sm font-medium text-text-muted px-3` (좌우 패딩을 활성 탭과 동일하게 유지해 탭 전환 시 다른 탭이 밀리지 않게 한다)

카운트 배지(`{selected.weeklyBossClearCount}/{selected.weeklyBossClearLimitCount}`, 현재 주간 탭에서만 표시)는 탭 버튼들과 같은 flex 행에 두고 `justify-between`으로 오른쪽 끝에 배치한다(현재는 탭 아래 별도 `<section>`에 분리되어 있음 — 탭과 같은 행으로 옮긴다).

### 2. 보스 카드 개편

기존 `StatusDot` 함수와 `BossList` 함수를 삭제하고, 그 자리에 아래 두 로컬 컴포넌트로 교체한다(파일 내 로컬 함수로 — 별도 파일로 분리하지 않는다):

```tsx
function DifficultyBadge(props: { difficulty: BossDifficulty }): React.JSX.Element
function BossCard(props: { boss: MatchedBoss }): React.JSX.Element
```

**`DifficultyBadge`**: `docs/UI_GUIDE.md`의 "난이도 뱃지" 표에 명시된 5종(이지/노멀/하드/카오스/익스트림) 각각의 `background`(gradient)/`border`/`color`/`text-shadow` 값을 그대로 사용해 캡슐형(`rounded-full`, height 20px, padding `0 10px`, `font-size: 10px`, `font-weight: 800`, `letter-spacing: .03em`) 뱃지를 렌더링한다. 색상값은 인라인 `style`로 적용해도 되고 각 난이도별 상수 맵으로 관리해도 된다 — 문서의 정확한 hex/gradient 값을 임의로 근사하거나 바꾸지 마라.

**`BossCard`**:
- 카드: `rounded-[14px] border border-border bg-surface`, height 80px, `overflow-hidden`, `position: relative`
- `getBossPortraitUrl(boss.portraitSlug)`가 null이 아니면 절대위치(`position: absolute; inset: 0`) 배경 레이어를 깔되:
  - `background-image: url(...)`, `background-size`/`background-position`은 `getBossPortraitCrop(boss.portraitSlug)`가 반환하는 `{ size, position }` 값을 인라인 style로 그대로 적용
  - `filter: saturate(.85) brightness(.8)`, `opacity: .65`
  - 페이드: `mask-image: linear-gradient(90deg, #000 0%, #000 38%, transparent 76%)` — Safari/WebView 호환을 위해 `-webkit-mask-image`도 동일하게 함께 지정
  - blur 필터는 절대 쓰지 마라(아래 금지사항 참고)
  - url이 null이면 이 배경 레이어 자체를 생략한다(플레이스홀더 배경색만, 즉 카드의 기본 `bg-surface`만 남김)
- 콘텐츠 행: `flex items-center justify-between`, `padding: 0 14px`
  - 왼쪽: `<DifficultyBadge difficulty={boss.difficulty} />` 다음에 보스명(`boss.matchedBossName ?? boss.apiName`), `text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.6)`
  - 오른쪽: `boss.isComplete`가 true일 때만 완료 뱃지(`rounded-full bg-secondary text-bg text-xs font-bold px-2.5 py-1`, 텍스트 "완료"). false면 아무 것도 렌더링하지 않는다.

보스 목록 렌더링은 각 `BossCard`를 `space-y-2`로 나열하고, 이를 감싸는 상위 카드(`<ul className="rounded-[14px] bg-surface border ...">` 같은 wrapper)는 두지 않는다.

주간 탭 목록(`registeredWeeklyBosses`)과 월간 탭 목록(`registeredMonthlyBosses`)을 렌더링하던 기존 두 곳 모두 새 `BossCard`로 교체한다. 빈 상태(`표시할 항목이 없습니다 ...`) 처리 로직은 그대로 유지한다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm run test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `ARCHITECTURE.md` 디렉토리 구조를 따르는가? (이 step은 `app/boss-scheduler/BossScreen.tsx`만 수정한다)
   - `ADR.md`/`ARCHITECTURE.md` 기술 스택·설계를 벗어나지 않았는가?
   - `CLAUDE.md` CRITICAL 규칙을 위반하지 않았는가? (특히 `src/data/boss-portrait-crops.json`에 실제 크롭 값을 채워 넣지 않았는지 — 여전히 빈 객체 `{}`여야 한다)
3. `src/app/boss-scheduler/__tests__/BossScreen.test.tsx`를 새 마크업에 맞게 갱신한다. 기존 테스트가 검증하려던 내용(완료/미완료 표시, 난이도 노출, 캐릭터별 목록 분리, 빈 상태 처리 등)은 그대로 유지하되, `StatusDot`/`BossList` 관련 selector(예: `role="img"` 체크 아이콘 등)를 새 카드 마크업(난이도 뱃지, 완료 뱃지 텍스트 "완료")에 맞는 selector로 바꿔라.
4. 결과에 따라 `phases/boss-ui-redesign/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- blur 필터(`filter: blur(...)`)를 절대 쓰지 마라. 이유: ADR-018에서 사용자가 흐림 없이 선명하게 유지하기로 명시적으로 확정했다.
- `src/components/BossPortrait/BossPortrait.tsx`(원형, 보스 수익 계산기·물욕 아이템 화면용)를 수정하지 마라. 이유: ADR-018 결정 9는 크롭 설정이 새 보스 카드 전용이며 원형 컴포넌트는 이번 개편의 영향을 받지 않는다고 명시한다.
- `src/app/content-scheduler/ContentScreen.tsx`를 수정하지 마라. 이유: 컨텐츠 스케줄러의 탭 pill 적용은 이 phase의 step 2가 별도로 담당한다.
- `src/data/boss-portrait-crops.json`에 실제 크롭 값을 채우지 마라. 이유: ADR-018 결정 8에 따라 이 값은 AI가 임의로 추정하지 않고 사용자가 각 일러스트를 눈으로 확인하며 직접 채운다. 빈 객체 `{}`로 그대로 둬라.
- 난이도 뱃지 색상을 `docs/UI_GUIDE.md`에 명시된 값과 다르게 임의로 조정하지 마라.
- 기존 테스트를 깨뜨리지 마라(단, `BossScreen.test.tsx` 자체를 새 마크업에 맞게 갱신하는 것은 이 step의 필수 작업이다).
