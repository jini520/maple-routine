# Step 5: settings-account-modal

이 step 은 **설정의 계정 변경 모달**이 맞는 401 도 같은 무효화 경로로 보낸다. 이 phase 의 마지막
코드 변경이다. 만지는 것은 `src/features/settings/store.ts` + 그 테스트, 필요하면 모달 테스트뿐이다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — 아래 지정한 ADR 만 열어라. **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-115.md` — **step 0 이 만든 이 phase 의 결정**. 이 step 의 계약은 **결정 7**(설정 계정
  변경 모달도 같은 진입점을 부른다)과 **결정 8**(`changeApiKey` 는 배선하지 않는다)이다
- `/docs/adr/ADR-086.md` — **결정 6**(계정 변경은 캐릭터를 다시 고를 때까지 커밋하지 않는다 — 이
  step 이 그 커밋 규칙을 깨지 않아야 한다)
- `/docs/features/settings.md` — 계정 변경 절 + 폐기 이력(step 0 이 갱신했다)
- `/src/features/settings/store.ts` (전문 — `changeApiKey` 55~76행 · `refreshAccounts` 78~96행 ·
  `disconnect` 150~152행 은 이미 `useOnboardingStore` 를 쓴다)
- `/src/features/settings/state.ts` (`VERIFY_FAILED`·`RESET` 리듀서 동작)
- `/src/features/settings/__tests__/store.test.ts` (전문)
- `/src/app/settings/AccountModal.tsx` (전문 — **status 가 `idle` 로 돌아오면 모달이 스스로 닫힌다**)
- `/src/app/settings/AccountFlowStatus.tsx` · `/src/app/settings/error-message.ts`
- **step 1 이 만든 것**: `features/onboarding/store.ts#invalidateApiKey()` (멱등 가드 포함)

## 배경

계정 변경 모달은 열리자마자 `refreshAccounts()` 로 **저장된 키**를 써서 `character/list` 를 재조회한다
(`AccountModal.tsx` 의 마운트 effect). 그 호출이 401 을 맞으면 그것은 **사용자가 방금 입력한 키가
틀린 것이 아니라 저장된 키가 무효화된 것**이다 — 지금은 모달 안 인라인 에러로 끝나고, 거기서 키를
바꿀 방법이 없다(이슈 #157 이 지적한 막다른 길과 같은 종류다).

## 작업

TDD 다 — **테스트를 먼저 쓰고**, 그다음 구현이 통과하게 만들어라.

### 1. `settings/store.ts#refreshAccounts` — 401 이면 무효화 경로로 넘긴다

catch 블록을 이렇게 바꾼다:

```
error = toSettingsError(error)
if (error.kind === 'invalidApiKey'):
    await useOnboardingStore.getState().invalidateApiKey()
    set(RESET)              // status 를 idle 로 → AccountModal 이 스스로 닫힌다
    return
set(VERIFY_FAILED, error)   // 나머지 종류는 지금 그대로
```

핵심 규칙:

- **나머지 원인(`rateLimited`·`network`·`storageWriteFailed`)의 동작을 바꾸지 마라.** `AccountFlowStatus`
  의 인라인 에러 카드는 그 자리에 그대로 남는다([[ADR-063]] — 모달 본문 전체를 차지하므로 토스트로
  옮기면 빈 상자가 된다, [[ADR-114]] 결정 1·2).
- **`RESET` 을 쓰는 이유**: 무효화가 성립하면 화면은 곧 `/onboarding` 으로 간다([[ADR-115]] 결정 2).
  설정 스토어에 `error` 상태를 남겨 두면 나중에 사용자가 설정을 다시 열었을 때 지나간 실패가 되살아난다.
  `RESET` 은 `AccountModal` 의 닫힘 판정(idle 복귀)에도 걸려 모달이 정리된다.
- **`invalidateApiKey()` 를 `await` 하라** — 그 뒤 `RESET` 이 와야 모달 닫힘과 이동의 순서가 뒤집히지
  않는다. 멱등 가드는 그 함수 안에 있으니 **여기서 상태를 다시 확인하지 마라**.
- import 는 이미 있다 — `disconnect()` 가 `useOnboardingStore` 를 쓰므로 새 순환은 생기지 않는다.

### 2. `changeApiKey` 는 건드리지 않는다

[[ADR-115]] 결정 8 — 설정의 "API 키 변경" 행은 이번에 부활시키지 않고 #135(설정 구조 개선)와 함께
본다. 그 경로의 401 은 **사용자가 방금 나쁜 키를 입력한 것**이라 무효화와 성질이 다르다. 로직·테스트를
**그대로 두라**(지우지도 배선하지도 마라).

### 3. `app/settings/error-message.ts` 도 건드리지 않는다

`invalidApiKey` 문구(`'API 키가 유효하지 않습니다'`)는 `changeApiKey` 경로 때문에 남는다. 도달 빈도가
줄 뿐이다.

### 4. 테스트

**`src/features/settings/__tests__/store.test.ts`** 에 `refreshAccounts` 401 케이스를 추가:

1. `fetchCharacterList` 가 `NexonAuthError` 로 reject 하면 → `invalidateApiKey` 가 1회 불리고
   설정 스토어 status 가 **`idle`**(= `VERIFY_FAILED` 가 아니다)
2. **회귀 가드**: `NexonRateLimitError`·일반 에러는 지금 그대로 `VERIFY_FAILED` + 해당 `error.kind` 다
   (모달 안 인라인 카드가 남는다)
3. `changeApiKey` 의 401 은 **지금 그대로** `VERIFY_FAILED` 이고 `invalidateApiKey` 가 불리지 **않는다**
   (결정 8 의 단언 — 이 케이스가 없으면 나중에 누가 "일관성"을 이유로 배선한다)

`AccountModal.test.tsx` 는 401 에서 모달이 닫히는지 확인하는 케이스를 넣을 수 있으면 넣되,
**기존 케이스를 깨면서까지 넣지는 마라**(닫힘은 이미 idle 복귀 effect 가 담보한다).

## Acceptance Criteria

```bash
npm run build                                    # 컴파일 에러 없음
npm test                                         # 전부 통과
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# changeApiKey 는 배선되지 않았다 (결정 8)
grep -n 'invalidateApiKey' src/features/settings/store.ts     # refreshAccounts 안에서만 1건
# 이 step 은 settings 밖 제품 코드를 건드리지 않는다
git status --porcelain -- src/ | grep -v 'settings' | wc -l   # 0
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **판별력을 확인하라**: 401 분기를 지워 다시 `VERIFY_FAILED` 로 떨어지게 해보고 새 테스트 1 이
   실패하는지, 회귀 케이스 2·3 은 통과하는지 본다. 확인 후 되돌려라. 결과를 summary 에 적어라.
3. **이 phase 전체의 왕복을 한 번 확인하라**(수동 코드 추적이면 충분하다 — 새 테스트를 만들 필요는
   없다): `completed` 상태에서 401 → `invalidateApiKey` → status `awaitingApiKey` →
   `App.tsx` 가드가 `/onboarding` → `ApiKeyForm` → `submitApiKey(새 키)` → 대조 가드 통과 →
   `completed` → `/content`. 끊기는 고리가 있으면 summary 에 적어라.
4. 아키텍처 체크리스트:
   - `features/settings/` 가 `storage/` 를 우회하지 않는가? (CLAUDE.md CRITICAL)
   - [[ADR-086]] 결정 6 의 커밋 규칙(계정 전환은 `commitAccountChange` 한 지점에서만 쓴다)을 깨지
     않았는가?
5. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 5 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`changeApiKey` 를 배선하지 마라.** 이유: [[ADR-115]] 결정 8 — 그 경로의 401 은 사용자가 방금 입력한
  키가 틀린 것이고, 부활 여부는 #135 와 함께 볼 미정 사항이다.
- **설정에 "API 키 변경" 행이나 모달을 만들지 마라.** 같은 이유다.
- **`rateLimited`·`network` 의 인라인 에러 카드를 토스트로 옮기지 마라.** 이유: 모달 본문 전체를
  차지하는 자리라 옮기면 빈 상자가 된다([[ADR-063]]).
- **`features/settings/` 밖의 제품 코드를 건드리지 마라.** 이유: step 1~4 가 이미 끝냈다. 여기서
  손대면 어느 step 이 무엇을 바꿨는지 diff 로 구분할 수 없다.
- 기존 테스트를 깨뜨리지 마라.
