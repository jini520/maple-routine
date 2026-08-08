# Step 4: onboarding-banner-wiring

이 step 은 **`src/app/onboarding/ContentCharacterStep.tsx` 와 그 테스트**만 바꾼다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-114.md` — **결정 2·3**(429 액션 없음 · 배너 원인별 분기 표)
- `/docs/features/onboarding.md` — 캐릭터 선택 단계 절
- `/src/features/schedule-sync/format.ts` — `formatStaleRosterError(error, place)`(step 1 신설) 및
  기존 `formatRosterError`
- `/src/components/molecules/ErrorState/StaleBanner.tsx` — step 2 가 바꾼 시그니처
- `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx` — **step 3 이 이미
  같은 배선을 한 자리다. 그 형태를 그대로 따라라**(54~113행 `PickerBody`)
- `/src/app/onboarding/ContentCharacterStep.tsx` (전문 — 특히 **35~98행 `RosterBody`**)
- `/src/app/onboarding/__tests__/ContentCharacterStep.test.tsx` (있으면 전문)
- `/src/app/settings/AccountFlowStatus.tsx` (**82행** — 설정의 계정 변경도 이 컴포넌트를 재사용한다)

## 이전 step 산출물

- step 1: `formatStaleRosterError(error, place)` → `{ message, action?: { kind, label } }`
- step 2: `StaleBanner` 가 `{ message, action?: { label, onClick } }` 을 받고, `action` 이 없으면
  버튼을 렌더하지 않는다
- step 3: 피커에 같은 배선을 했다 — 액션 매핑(`openSettings` → `onOpenSettings`, `retry` → `onRetry`)의
  형태를 그대로 재사용하라

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. 46행의 하드코딩을 분기로 바꾼다

지금:

```tsx
{props.loadError !== null && <StaleBanner message="목록이 최신이 아닙니다" onRetry={props.onRetry} />}
```

`formatStaleRosterError(props.loadError, 'onboarding')` 의 결과로 바꾼다.

**온보딩의 액션 매핑은 피커보다 단순하다** — `place='onboarding'` 은 `openSettings` 를 반환하지
않으므로(온보딩·설정 모달 중에는 설정 화면으로 보낼 수 없다) 액션이 있으면 항상 `retry` 다.
69~79행의 `ErrorState` 분기가 같은 이유로 이미 그렇게 적혀 있다(71~72행 주석). 그래도
**`copy.action?.kind` 를 무시하고 무조건 `onRetry` 를 붙이지는 마라** — `kind` 를 확인해 매핑하고,
`openSettings` 가 올 수 없다는 사실은 주석으로 남겨라(포맷터가 바뀌면 여기서 드러나야 한다).

### 2. 주석을 갱신한다

31~34행의 `ADR-062` 주석("실패도 피커와 같은 공용 ErrorState를 쓰고 스탈 배너 분기도 같다")은 이제
**더 정확해질 수 있다** — 배너의 액션 규칙이 `ErrorState` 와 다르다는 것([[ADR-114]] 결정 3:
배너는 목록이 남아 있어 액션이 없어도 막다른 길이 아니지만 `ErrorState` 는 자리 전체가 실패라
온보딩 401 에서 액션을 빼면 화면에 아무 길도 없다)을 적어라.

### 3. 테스트

`/src/app/onboarding/__tests__/ContentCharacterStep.test.tsx` (없으면 신설, 있으면 그 관례를 따른다):

1. **429 배너** — 로스터가 stub 을 하나 방출한 뒤 429 로 reject 하면
   `'호출 한도를 초과했습니다 — 서비스 단계 키인지 확인해주세요'` 가 보이고, **스탈 배너 안에 버튼이
   없다**(`within(screen.getByTestId('stale-banner')).queryByRole('button')` 이 `null`). 그리드는
   남아 있다.
   - 이 화면은 페이지라 "계속하기" 버튼이 항상 있으므로 전역 `queryByRole('button')` 단언은 쓸 수
     없다.
   - 429 를 만드는 방법: `getCharacterPickerRoster` 를 목킹해 `onUpdate` 로 엔트리를 흘린 뒤
     `NexonRateLimitError` 로 reject 한다(`toScheduleSyncError` 가 `rateLimited` 로 변환한다).
     **기존 테스트 파일에 이미 있는 목킹 관례를 그대로 따라라** — 없으면
     `/src/app/boss-scheduler/__tests__/BossScreen.test.tsx:1254` 부근의 `deferRoster()` 패턴이 선례다.
2. **401 배너** — `invalidApiKey` 면 배너 안에 버튼이 **없다**(온보딩에는 설정으로 보낼 길이 없고,
   재시도는 같은 키를 다시 써서 또 401 이다). 문구는
   `'API 키가 유효하지 않아 목록을 갱신하지 못했습니다'`.
3. **network 회귀 가드** — `network` 면 지금까지처럼 `'목록이 최신이 아닙니다'` + `'다시 시도'`
   버튼이고, 누르면 재조회가 일어난다(`getCharacterPickerRoster` 가 2회 호출된다).

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과
npm run lint                                     # errors 0
git status --porcelain -- src/ | wc -l           # 2 이어야 한다 (컴포넌트 + 그 테스트)
grep -c '목록이 최신이 아닙니다' src/app/onboarding/ContentCharacterStep.tsx   # 0 — 하드코딩이 사라졌다
# 저장소 전체에서 스탈 배너 문구 하드코딩이 남아 있지 않다
grep -rn '목록이 최신이 아닙니다' src/ --include='*.tsx' | grep -v '__tests__' | wc -l   # 0
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: 배너의 `action` 을 무조건 `{ label: '다시 시도', onClick: props.onRetry }`
   로 되돌리면 새 케이스 1·2 가 실패하고 3 은 통과하는지 본다. 확인 후 되돌리고 결과를 summary 에
   적어라.
3. **설정 경로도 확인하라**: `AccountFlowStatus.tsx:82` 가 같은 `ContentCharacterStep` 을 쓴다.
   설정 모달에서 계정을 바꿀 때도 같은 배너가 나온다는 것을 코드로 확인하고(테스트를 새로 만들
   필요는 없다) summary 에 적어라. `place` 가 `'onboarding'` 인 것이 그 자리에서도 맞는지
   판단해라 — 설정 모달 안이라 **설정 화면으로 보내는 액션이 의미 없다**는 점에서 맞다.
4. 아키텍처 체크리스트:
   - CLAUDE.md CRITICAL: `app/` 코드가 저장소·네이티브 API 에 직접 접근하지 않는가?
   - `features/` → `app/` 역방향 import 가 생기지 않았는가?
5. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`CharacterTrackingPicker.tsx` 를 다시 건드리지 마라.** 이유: step 3 이 끝냈다.
- **`ErrorState` 분기(69~79행)의 액션을 바꾸지 마라.** 이유: 온보딩 401 의 재시도는 의도된 유지다
  ([[ADR-114]] 결정 3) — 목록이 없는 자리에서 액션을 빼면 화면에 아무 길도 없다.
- **`getCharacterPickerRoster` 나 `features/schedule-sync` 를 고치지 마라.** 이유: 이 step 은 배선만
  한다. 포맷터가 잘못됐다면 step 1 을 고칠 일이고, 그때는 그 사실을 summary 에 적어라.
- **온보딩 흐름(단계 전이·CTA 비활성 조건)을 바꾸지 마라.** 이유: [[ADR-086]] 결정 7·8 이고 이
  이슈와 무관하다.
- 기존 테스트를 깨뜨리지 마라.
