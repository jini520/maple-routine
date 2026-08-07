# Step 6: docs-verify

이 step 은 **문서만** 바꾼다. 제품 코드(`src/`)·테스트 파일은 한 줄도 건드리지 마라.
step 0 이 '설계 확정 · 구현 전'으로 열어 둔 ADR-113 을 **실측 수치로 마감**하고, 문서가 실제 코드와
어긋난 곳을 정정한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-113 행)
- `/docs/adr/ADR-113.md` (전문 — step 0 이 만들었다)
- `/docs/features/onboarding.md` (전문 — "계정 선택 프로브" 절, "열린 질문" 절, "폐기된 정책 (history)" 절)
- `/docs/features/settings.md` (계정 변경 절, "열린 질문" 절)
- **step 1~5 가 실제로 만든/고친 코드 전부:**
  - `/src/features/schedule-sync/character-basic-fetch.ts` + 그 테스트
  - `/src/features/onboarding/prefetch.ts`
  - `/src/features/schedule-sync/character-roster.ts`
  - `/src/features/schedule-sync/schedule-sync.ts` (`refreshCharacterBasics`)
  - `/src/features/onboarding/use-account-probes.ts` + 그 테스트
  - `/src/app/onboarding/AccountSelectionList.tsx` + 그 테스트
  - `/src/app/settings/AccountFlowStatus.tsx` + 그 테스트
- `phases/account-probe-gate/index.json` — step 0~5 의 `summary`(각 step 이 실제로 무엇을 했고
  무엇을 범위 밖으로 남겼는지)

## 배경

이 프로젝트 규칙(`CLAUDE.md`):

- ADR 은 '설계, 구현 전'으로 남는 경우가 많다 — **구현 완료 시 `docs/adr/` 와 `docs/ADR.md` 인덱스
  상태를 '구현 완료'로 명시할 것.**
- `docs/features/*` 의 '열린 질문' 항목이 이미 구현됐는지 확인하고, 완료됐으면 제거·정리할 것.
- 작업 완료 후 문서를 다시 점검해 완료된 항목을 반영할 것.

## 작업

### 1. `/docs/adr/ADR-113.md` 마감

- **상태 줄**을 `**구현 완료**, 2026-08-08, 이슈 #163` 으로 바꾸고, **실기기 검증 여부를 정직하게
  적어라**(실기기로 확인하지 않았으면 `**실기기 미검증**` 을 명시).
- **`## 검증` 절을 실측값으로 채워라:**
  - `npm test` 실제 출력의 **테스트 개수·파일 수**(추정하지 마라 — 명령을 돌려 그 숫자를 옮겨라)
  - `npm run build` 결과, `npm run lint` 의 errors/warnings 수(warnings 는 baseline 과 같은지)
  - 이 phase 가 **추가한 케이스 수**
  - 인용하는 파일 경로·`describe`/`it` 이름은 `grep -rF` 로 각각 1건 실재를 확인한 것만 적어라
- **"자동 테스트가 담보하는 것"과 "실기기·실사용으로만 확인되는 것"을 나눠 적어라.** 후자 예:
  - 실제 40캐릭터 계정에서 계정 선택 대기가 체감상 견딜 만한가
  - 온보딩 1회의 `character/basic` 실호출이 정말 3라운드 → 1라운드가 되는가(네트워크 계측)
  - 429 발생 빈도가 실제로 줄었는가(→ 이슈 #158)
  - 두 대기(`verifying` → 프로브)가 실기기에서 하나의 연속된 로딩으로 보이는가
- **구현하며 정정된 것이 있으면 "구현하며 N을 정정 —" 형태로 적어라**(이 저장소의 ADR 관례).
  step 0~5 의 `summary` 와 `note_verification` 에서 찾아라. 특히 각 step 이 **범위 밖으로 남긴
  사실**(예: 프로브의 `markScheduleProbeUnavailable` 미기록, 로스터·예열의 동시성 캡 부재)은
  **누락이 아니라 사실로 기록**하라.
- **폐기 관계를 정확히 적어라**: [[ADR-068]] 결정 4 의 "캐시에 쓰지 않는다" 폐기,
  [[ADR-086]] 결정 8 의 "프로브 도착 전에는 선택 가능" 폐기, [[ADR-097]] 결정 7 의 "별도 TTL 은
  두지 않는다" 정정, [[ADR-061]] 결정 1 의 두 번째 예외. **[[ADR-061]] 결정 1 자체는 폐기가
  아니라 예외 추가**임을 분명히 하라.

### 2. `/docs/ADR.md` 인덱스 행 동기화

ADR-113 행의 요약을 최종 상태(구현 완료 + 실측 수치 + 실기기 검증 여부)로 갱신하라. 다른 행의
밀도·서식을 따르고 **표 밖에 새 절을 만들지 마라.**

### 3. `/docs/features/onboarding.md` · `/docs/features/settings.md` 코드 대조

step 0 이 정책을 미리 썼다. **이제 실제 구현과 대조해 어긋난 곳을 정정하라:**

- 문서가 인용하는 **모듈 이름·함수 이름·파일 경로가 실재하는지** `grep` 으로 1건씩 확인하라
  (예: `fetchCharacterBasicCached`·`character-basic-fetch`·`isSettled`). 없는 식별자를 적어 두면
  다음 작업자가 그것을 찾다 시간을 버린다.
- TTL 값(5분)과 그 근거가 코드 상수(`CHARACTER_BASIC_TTL_MS`)와 일치하는지 확인하라.
- **"열린 질문" 절**을 읽고 이번 작업으로 닫힌 항목이 있으면 제거하고, 이번 작업이 **새로 연**
  질문이 있으면 추가하라(예: 계정 선택 대기의 체감 시간을 실사용 후 조정할지, 안 고른 계정의 캐시
  엔트리 정리 정책).
- step 5 의 검증 절차 3번이 "step 6 에서 처리할 사실"로 남긴 것이 있으면 여기서 처리하라.

### 4. 이슈 #163 체크리스트 대조

이슈 본문의 "할 일" 4항목과 "수정 방향" 2항목, "주의점" 4항목이 각각 **어떻게 처리됐는지**(했다 /
안 했다 + 이유) ADR-113 또는 summary 에 대조표로 남겨라. **하지 않은 것을 한 것처럼 적지 마라.**

## Acceptance Criteria

```bash
grep -q '구현 완료' docs/adr/ADR-113.md
grep -q 'ADR-113' docs/ADR.md
npm run build && npm test && npm run lint     # 문서만 바꿨으므로 baseline 그대로 통과
git diff --stat -- src/ | wc -l               # 반드시 0 — 제품 코드 변경 없음
# ADR 이 인용한 새 식별자가 실재한다
grep -rq 'CHARACTER_BASIC_TTL_MS' src/
grep -rq 'fetchCharacterBasicCached' src/
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다. `git diff --stat -- src/` 가 비어 있지 않으면 실패다.
2. **ADR 에 적은 모든 수치는 명령의 실제 출력에서 옮긴 것이어야 한다.** `npm test -- --run` 을
   실제로 돌려 테스트/파일 개수를 확인하고, `npm run lint` 의 errors/warnings 수를 확인하라.
   추정치를 적었다면 그것은 실패다.
3. ADR·기능 문서가 인용한 **파일 경로·식별자·`describe`/`it` 이름을 `grep -rF` 로 각 1건 확인**하라.
4. 아키텍처 체크리스트:
   - ADR 은 `docs/adr/ADR-113.md` 개별 파일 + `docs/ADR.md` 인덱스 한 줄 형태를 유지하는가?
   - 옛 정책을 **지우지 않고** history 로 옮긴 상태가 유지되는가?
   - `docs/README.md` 인덱스 구조를 깨지 않았는가?
5. 결과에 따라 `phases/account-probe-gate/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 아래 어떤 파일도 수정하지 마라.** 이유: 구현은 step 1~5 에서 끝났다. 여기서 코드를
  건드리면 그 변경은 어떤 결정에도 대응되지 않고 테스트 근거도 없다. 코드에 결함을 발견하면
  **고치지 말고** ADR 의 "미해결로 남기는 사실" 과 summary 에 기록하라.
- **실기기로 확인하지 않은 것을 '검증 완료'로 적지 마라.** 이유: 이 저장소의 ADR 은
  '구현 완료 · 실기기 미검증'을 명시적으로 구분해 왔고, 그 구분이 다음 작업자의 판단 근거다.
- **테스트 개수·번들 크기 같은 수치를 추정으로 적지 마라.** 이유: 틀린 수치는 나중에 회귀 판정의
  기준선을 오염시킨다.
- **`docs/adr/` 의 다른 ADR 파일을 수정하지 마라.** 이유: 폐기·정정 사실은 ADR-113 과 인덱스 행,
  기능 문서의 history 절이 기록한다.
- **이번 작업과 무관한 '열린 질문'을 정리하지 마라.** 이유: `CLAUDE.md` 는 "작업할 때 그 문서의
  열린 질문이 이미 구현됐는지 확인"하라고 했지 무관한 항목을 치우라고 하지 않았다.
