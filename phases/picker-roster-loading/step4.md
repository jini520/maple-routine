# Step 4: docs-finalize

구현이 끝났으므로 문서 상태를 "구현 완료"로 맞추고, 문서에 적힌 피커 동작과 실제 구현이 일치하는지 최종 대조한다. CLAUDE.md의 "작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것", "ADR도 구현 완료 시 상태를 명시할 것" 규칙을 이행하는 step이다.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-053 줄의 상태 표기 갱신 대상)
- `/docs/adr/ADR-053.md` — 제목의 상태 표기 갱신 대상.
- `/docs/adr/ADR-016.md`·`/docs/adr/ADR-017.md` — step 0에서 추가한 정정이 실제 구현과 일치하는지 확인.
- step 0에서 갱신한 feature 문서 — 경로는 `phases/picker-roster-loading/index.json`의 step 0 `summary`에 적혀 있다.
- **이전 step들에서 수정된 코드(읽기만, 로직 수정 금지)**:
  - `/src/features/schedule-sync/schedule-sync.ts` (step 1 — 방출 규칙)
  - `/src/components/CharacterTrackingPicker/CharacterTrackingPicker.tsx` (step 2 — 스피너·빈/실패 상태)
  - `/src/app/content-scheduler/ContentScreen.tsx`·`/src/app/boss-scheduler/BossScreen.tsx`·`/src/app/onboarding/ContentCharacterStep.tsx` (step 3 — 배선)

## 작업

### 1. ADR 상태를 "구현 완료"로 표기

- `docs/adr/ADR-053.md` 첫 줄 제목의 `(설계, 구현 전)`을 `(구현 완료, YYYY-MM-DD)`로 바꾼다. 날짜는 `date +%Y-%m-%d`로 실제 오늘 날짜를 구해서 쓴다.
- `docs/ADR.md` 인덱스의 ADR-053 줄에도 `(구현 완료)`를 반영한다(다른 줄들의 표기 형식을 그대로 따를 것).
- ADR-053 말미에 **구현 완료 문단**을 한 단락 추가한다 — 바뀐 파일(`features/schedule-sync/schedule-sync.ts`, `components/CharacterTrackingPicker/CharacterTrackingPicker.tsx`, 화면 3곳)과 각 결정이 어디에 반영됐는지, 그리고 **웜 캐시 경로의 [[ADR-016]] SWR이 회귀 없이 유지됨을 고정하는 테스트**가 어디 있는지 적어라.

### 2. 문서와 구현의 최종 대조

아래를 실제 코드와 대조하고, 어긋나면 **문서 쪽을 실제 구현에 맞춰** 고쳐라(코드는 건드리지 마라).

- feature 문서에 적은 "웜 캐시: 즉시 표시 + patch / 콜드: 스피너 → 완료 후 한 번에"가 `schedule-sync.ts`의 실제 방출 규칙과 일치하는가?
- "활성 확인된 캐릭터만 표시"가 실제로 지켜지는가(`access_flag` 미상 캐릭터를 넣는 경로가 남아 있지 않은가)?
- 빈 상태와 실패 상태를 구분한다는 서술이 `CharacterTrackingPicker`의 실제 문구와 일치하는가?
- ADR-016·ADR-017 정정 문단의 내용이 실제 구현과 어긋나지 않는가?

### 3. 잔재 점검

```bash
grep -rn "getCharacterPickerRoster" src/
grep -rn "catch(() => {})" src/app/
```

- `getCharacterPickerRoster` 호출부가 3곳(ContentScreen·BossScreen·ContentCharacterStep) 그대로인지, 새로 생긴 호출부가 로딩 배선 없이 추가되지는 않았는지 확인하라.
- `src/app/` 아래에 결과를 삼키는 빈 `catch`가 남아 있으면 그 사실을 summary에 적어라. **이번 작업 범위(피커 로스터) 밖의 빈 catch는 고치지 마라** — 별개 코드다.
- `src/`의 주석이 옛 방출 규칙("캐시가 없으면 character/list 값으로 먼저 그린다" 등)을 서술하고 있으면 주석만 현행화하라(로직은 건드리지 마라).

### 4. 열린 질문 점검

step 0에서 갱신한 feature 문서들의 "열린 질문" 항목을 훑어, 이번 작업으로 해소된 항목이 있으면 제거·정리하라(CLAUDE.md 규칙). `docs/features/onboarding.md`의 "캐릭터 관리 피커 개선([[ADR-015]]) 잔여 — 얼굴 크롭 쿼리 공식 지원 여부" 항목은 **이번 작업과 무관하므로 지우지 마라.**

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# ADR 상태 표기 확인 — 둘 다 결과가 나와야 한다
grep -n "구현 완료" docs/adr/ADR-053.md
grep -n "ADR-053" docs/ADR.md
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR-053·ADR.md 인덱스가 "구현 완료" 상태로 표기됐는가?
   - feature 문서의 피커 동작 서술이 실제 코드와 일치하는가?
   - 옛 정책을 **삭제**하지 않고 정정/history로 남겼는가?
   - 이 step에서 로직을 바꾸지 않았는가? (`git diff`로 `src/` 변경이 주석뿐인지 확인)
3. 결과에 따라 `phases/picker-roster-loading/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 갱신한 문서와 정리한 잔재를 요약하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/`의 **로직**을 바꾸지 마라. 이유: 구현은 step 1~3에서 끝났다. 허용되는 `src/` 변경은 사실과 달라진 주석의 현행화뿐이다.
- 문서와 구현이 어긋날 때 코드를 문서에 맞추지 마라. 이유: 테스트로 검증된 구현이 진실이다. 구현이 [[ADR-053]]과 다르다고 판단되면 고치지 말고 `blocked`로 보고하라.
- 이번 작업 범위 밖의 빈 `catch`나 다른 화면의 로딩 처리를 손대지 마라. 이유: 이 phase의 범위는 캐릭터 관리 피커 로스터 조회다. 발견한 문제는 summary에 적어 별도 이슈로 남겨라.
- `docs/adr/ADR-016.md`·`ADR-017.md` 본문을 새로 고쳐 쓰지 마라. 이유: step 0의 정정 문단으로 충분하고 옛 결정 본문은 보존 대상이다.
- 기존 테스트를 깨뜨리지 마라.
