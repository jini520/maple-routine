# Step 6: docs-verify

이 step 은 **문서만** 바꾼다. 제품 코드(`src/`)·테스트 파일은 한 줄도 건드리지 마라.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-114.md` — **step 0 이 '설계 확정 · 구현 전'으로 쓴 이 phase 의 ADR. 이 step 이
  마감한다**
- `/docs/ADR.md` (인덱스 — ADR-114 행)
- `/docs/foundation/error-resilience.md` · `/docs/foundation/nexon-api.md` ·
  `/docs/foundation/design-system.md` · `/docs/features/content-scheduler.md` ·
  `/docs/features/settings.md` — step 0 이 갱신한 문서들. **실제 구현과 어긋나는 곳이 없는지
  코드로 대조하는 것이 이 step 의 본체다**
- 이 phase 가 바꾼 제품 코드 전부:
  - `/src/features/schedule-sync/format.ts`
  - `/src/components/molecules/ErrorState/StaleBanner.tsx`
  - `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
  - `/src/app/onboarding/ContentCharacterStep.tsx`
  - `/src/features/onboarding/format.ts` · `/src/app/settings/error-message.ts` ·
    `/src/app/settings/AccountFlowStatus.tsx`

## 작업

### 1. `git diff` 로 실제 변경을 확인한다

```bash
git diff --stat main...HEAD -- src/
git diff main...HEAD -- src/
```

**문서를 고치기 전에 코드가 실제로 무엇을 하는지 읽어라.** step 들의 summary 는 요약이고, 진실은
diff 다.

### 2. 실측 수치를 모은다

```bash
npm run build
npm test        # 테스트 수 / 파일 수
npm run lint    # errors / warnings
```

기준선(이 phase 시작 시점, main): **테스트 2,548개 / 172파일 · build 성공 · lint 0 errors 17 warnings**.
순증과 삭제를 구분해 적어라 — 삭제한 케이스가 있으면 **무엇을 왜 지웠는지** 밝혀라(뒤집힌 옛 계약은
갱신이 아니라 삭제가 맞다).

### 3. `/docs/adr/ADR-114.md` 를 마감한다

- **상태 줄**을 `설계 확정 · 구현 전` → **`구현 완료 · 실기기 미검증`**(2026-08-08, 이슈 #158)으로
  바꿔라. 실기기에서 개발 단계 키로 실제 429 를 재현한 것이 아니므로 **'검증 완료'라고 쓰지 마라.**
- **`## 검증` 절을 실측으로 채워라**:
  - 실측 수치(테스트 수·파일 수·순증·build·lint)
  - **신규 테스트가 사는 파일 × 담보하는 결정** 대조표
  - **자동 테스트가 담보하는 것**(문구 문자열, 429·401 에 액션이 없다는 것, `network` 문구 회귀,
    설정 카드의 버튼 분기 등)
  - **실기기·실사용으로만 확인되는 것** — 최소 아래 3건은 반드시 포함하라:
    1. 개발 단계 키로 실제 429 를 내 배너가 새 문구로 뜨는지(이슈 #158 "검증" 절의 첫 항목)
    2. 새 문구를 본 사용자가 실제로 서비스 단계 신청에 도달하는지(A안이 감지 대신 안내를 택한 값이
       여기서만 확인된다)
    3. 429 자체가 줄었는지 — **이 phase 는 429 를 줄이지 않는다.** 문구만 고쳤다는 사실을 명시하라
- **구현하며 정정한 것**이 있으면 절을 만들어 적어라(step summary 들과 diff 를 대조해 찾아라).
  각 항목은 "무엇을 어떻게 정정했고 왜"의 형태로.
- **미해결로 남기는 사실**을 절로 적어라. 최소 아래를 포함:
  - **(c) 자격 스윕이 429 를 삼켜 캐릭터가 조용히 사라지는 문제**(`character-eligibility.ts:90-102`)
    — 이 phase 는 손대지 않았다. 이슈 #158 스크린샷에서 "추적 중 1명만 남은" 원인은 문구가 아니라
    이쪽이다. **문구를 고쳐도 목록은 여전히 빈다.**
  - **로스터·예열 경로의 프리플라이트·동시성 캡 부재** — [[ADR-008]] 전제 재검토와 함께 별건.
  - **일 한도 소진과 초당 한도를 구분하지 않는다** — 429 응답에 그 구분이 없다.
  - **서비스 단계 키 사용자도 같은 문구를 본다** — A안의 대가.
- **이슈 #158 대조표**를 만들어라 — 이슈의 "수정 방향 > 필수" 2개 · "열린 결정" 1개 ·
  "검증" 3개 · "별건으로 분리" 4개 각각에 **했다/안 했다 + 이유**를 붙여라.

### 4. `/docs/ADR.md` 인덱스 행을 동기화한다

ADR-114 행의 상태 표기를 본문과 맞춰라(`구현 완료 · 실기기 미검증`). 결정이 구현 중에 바뀌었다면
요약도 고쳐라.

### 5. 나머지 문서를 코드와 대조해 정정한다

step 0 은 **구현 전에** 썼으므로 실제와 어긋날 수 있다. 아래를 **코드를 열어** 확인하고 다르면
문서를 고쳐라:

- `error-resilience.md` 원칙 3 · 429 행 — 실제 문구·액션과 일치하는가?
- `design-system.md` 스탈 배너 절 — `StaleBanner` 의 실제 props(`message` + 옵셔널 `action`)와
  일치하는가? 액션이 없을 수 있다는 것이 적혀 있는가?
- `content-scheduler.md` 의 배너 표 — `formatStaleRosterError` 의 실제 반환과 한 글자도 다르지
  않은가?
- `features/settings.md` 의 429 정책 — `AccountFlowStatus` 의 실제 분기와 일치하는가?
- `nexon-api.md` — 옛 전제가 history 로 갔고 본문이 사실인가?

**문서를 코드에 맞추는 것이 원칙이다.** 다만 코드가 [[ADR-114]] 의 결정에서 벗어난 것이라면
문서가 아니라 그 사실을 ADR 의 "구현하며 정정한 것" 절에 적어라.

### 6. 열린 질문 정리

`docs/features/*.md` 의 "열린 질문" 절을 읽고 **이 phase 로 닫힌 항목이 있으면 제거하라**
(CLAUDE.md 규칙). 없으면 손대지 마라.

## Acceptance Criteria

```bash
grep -q '구현 완료' docs/adr/ADR-114.md                    # 상태 마감
! grep -q '설계 확정 · 구현 전' docs/adr/ADR-114.md        # 옛 상태가 남아 있지 않다
grep -q 'ADR-114' docs/ADR.md
git diff --stat -- src/ | wc -l                            # 반드시 0 — 제품 코드 변경 없음
npm run build && npm test && npm run lint                  # 문서만 바꿨으므로 그대로 통과
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다. `git diff --stat -- src/` 가 비어 있지 않으면 실패다.
2. ADR-114 에 적은 **모든 수치와 좌표를 실제로 확인**하라(`npm test` 출력·`grep -n`). 추정으로
   적지 마라 — 이 문서가 다음 작업의 기준선이 된다.
3. **이슈 #158 의 "검증" 3항목을 코드로 따라가며** 각각이 어느 테스트로 담보되는지(또는 담보되지
   않는지) 확인하고 대조표에 반영하라.
4. 아키텍처 체크리스트:
   - ADR 은 `docs/adr/ADR-114.md` + `docs/ADR.md` 인덱스 한 줄 형태를 유지하는가?
   - 옛 정책을 **지우지 않고** history 로 옮겼는가?
   - 문서가 코드와 어긋나는 곳이 남아 있지 않은가?
5. 결과에 따라 `phases/rate-limit-copy/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 아래 어떤 파일도 수정하지 마라.** 이유: 이 step 은 검증·문서화다. 코드 결함을 발견하면
  고치지 말고 ADR 의 "미해결로 남기는 사실"에 적어라 — 어느 결정이 어느 변경을 낳았는지 추적이
  끊기지 않게.
- **'실기기 검증 완료'라고 쓰지 마라.** 이유: 개발 단계 키로 실제 429 를 재현한 사람이 없다.
  거짓 기록은 다음 작업을 잘못된 전제 위에 세운다.
- **429 가 줄었다고 쓰지 마라.** 이유: 이 phase 는 문구만 고쳤다. 호출량은 한 건도 줄지 않았다.
- **자격 스윕·프리플라이트를 "해결됨"으로 적지 마라.** 이유: 이슈 #158 이 명시적으로 별건으로
  분리했고 이 phase 는 손대지 않았다.
- **ADR 전문을 여러 개 컨텍스트에 올리지 마라.** 이유: CLAUDE.md 규칙.
