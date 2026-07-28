# Step 4: docs-finalize

구현이 끝났으므로 문서 상태를 "구현 완료"로 맞추고, 코드·문서에 남은 옛 정책 서술 잔재를 정리한다. CLAUDE.md의 "작업 완료 후 문서를 다시 점검해 완료된 항목을 반영(체크)할 것", "ADR도 구현 완료 시 상태를 명시할 것" 규칙을 이행하는 step이다.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-051 줄의 상태 표기 갱신 대상)
- `/docs/adr/ADR-051.md` — 제목의 상태 표기 갱신 대상.
- `/docs/adr/ADR-016.md` — step 0에서 추가한 정정 문단이 실제 구현과 일치하는지 확인.
- `/docs/features/onboarding.md`·`/docs/features/settings.md` — step 0에서 갱신한 정책이 실제 구현과 일치하는지 확인.
- **이전 step들에서 수정된 코드(읽기만, 수정 금지)**:
  - `/src/features/onboarding/state.ts`·`store.ts` (step 1)
  - `/src/features/settings/state.ts`·`store.ts` (step 2)
  - `/src/app/onboarding/AccountSelectionList.tsx` (step 3)

## 작업

### 1. ADR 상태를 "구현 완료"로 표기

- `docs/adr/ADR-051.md` 첫 줄 제목의 `(설계, 구현 전)`을 `(구현 완료, YYYY-MM-DD)`로 바꾼다. 날짜는 `date +%Y-%m-%d`로 실제 오늘 날짜를 구해서 쓴다.
- `docs/ADR.md` 인덱스의 ADR-051 줄에도 동일하게 `(구현 완료)`를 반영한다(다른 줄들의 표기 형식을 그대로 따를 것).
- ADR-051 말미에 다른 ADR들처럼 **구현 완료 문단**을 한 단락 추가한다 — 실제로 바뀐 파일 목록(`features/onboarding/state.ts`·`store.ts`, `features/settings/state.ts`·`store.ts`, `app/onboarding/AccountSelectionList.tsx`)과 각 결정이 어디에 반영됐는지.

### 2. 문서와 구현의 일치 점검

아래를 실제 코드와 대조해 확인하고, 어긋나면 **문서 쪽을 실제 구현에 맞춰** 고쳐라(코드는 건드리지 마라).

- `docs/features/onboarding.md`의 "계정 선택" 정책 문장이 실제 리듀서 동작(계정 수 무관 항상 `selectingAccount`)과 일치하는가?
- 같은 문서의 `AccountSelectionList` UI 절에 적힌 초기 하이라이트 규칙이 step 3 구현과 일치하는가?
- "폐기된 정책 (history)"에 자동 확정 폐기 한 줄이 들어 있는가?
- `docs/features/settings.md`의 계정 변경 정책이 설정 경로 구현과 일치하는가?

### 3. 옛 정책 서술 잔재 정리

아래 커맨드로 자동 확정 관련 서술이 남아 있는지 훑고, **코드 주석에 남은 잘못된 서술만** 현행화하라.

```bash
grep -rn "자동 확정\|단일 계정\|accounts.length === 1\|계정이 1개" src/
```

- `src/` 안에서 "계정이 1개면 자동으로…" 같은 **사실과 다른 주석**이 남아 있으면 고쳐라(주석만 — 로직은 건드리지 마라).
- 테스트 파일의 `it('...')` 설명 문구가 옛 동작을 서술하고 있으면 현재 동작에 맞게 고쳐라.
- 검색 결과가 [[ADR-051]] 참조나 "자동 확정을 폐기했다"는 맥락의 정상적인 서술이면 그대로 둔다.

### 4. 열린 질문 점검

`docs/features/onboarding.md`·`docs/features/settings.md`의 "열린 질문" 항목을 훑어, **이번 작업으로 해소된 항목이 있으면** 제거·정리하라(CLAUDE.md 규칙). `settings.md`의 "계정 변경 시 실수 방지 확인 다이얼로그를 넣을지"는 이번 변경으로 사용자가 계정 목록을 반드시 한 번 보게 됐으므로 **맥락이 달라졌다** — 항목을 지우지는 말고, 달라진 맥락을 한 구절 덧붙여라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# ADR 상태 표기 확인 — 둘 다 결과가 나와야 한다
grep -n "구현 완료" docs/adr/ADR-051.md
grep -n "ADR-051" docs/ADR.md

# 자동 확정 분기가 코드에 남아 있지 않은지 — 결과가 없어야 한다
grep -rn "accounts.length === 1" src/
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR-051·ADR.md 인덱스가 "구현 완료" 상태로 표기됐는가?
   - `docs/features/*`의 정책 서술이 실제 코드와 일치하는가?
   - 옛 정책을 **삭제**하지 않고 "폐기된 정책 (history)"·정정 문단으로 남겼는가?
   - 이 step에서 로직을 바꾸지 않았는가? (`git diff`로 `src/` 변경이 주석·테스트 설명 문구뿐인지 확인)
3. 결과에 따라 `phases/account-selection-always/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 갱신한 문서와 정리한 잔재를 요약하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/`의 **로직**을 바꾸지 마라. 이유: 구현은 step 1~3에서 끝났다. 이 step에서 허용되는 `src/` 변경은 사실과 달라진 주석·테스트 설명 문구의 현행화뿐이다.
- 문서와 구현이 어긋날 때 코드를 문서에 맞추지 마라. 이유: 이미 검증된(테스트 통과) 구현이 진실이고, 문서가 따라가야 한다. 구현 자체가 잘못됐다고 판단되면 고치지 말고 `blocked`로 보고하라.
- `docs/adr/ADR-016.md`의 본문을 새로 고쳐 쓰지 마라. 이유: step 0에서 추가한 정정 문단만으로 충분하고, 옛 결정 본문은 보존 대상이다.
- 기존 테스트를 깨뜨리지 마라.
