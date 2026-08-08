# Step 6: docs-verify

이 step 은 **문서를 구현과 대조해 마감**한다. `src/` 는 원칙적으로 건드리지 않는다 — 대조 중 실제
버그를 발견했다면 그것은 이 step 이 고칠 것이 아니라 **summary 에 보고할 것**이다(사용자 판단이
필요하다). 문서와 코드가 어긋난 경우에만 **문서**를 고친다.

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (인덱스에서 ADR-115 행)
- `/docs/adr/ADR-115.md` (전문 — step 0 이 만든 이 phase 의 결정 8개)
- `/docs/features/onboarding.md` · `/docs/features/settings.md` ·
  `/docs/foundation/error-resilience.md` (step 0 이 갱신한 세 문서)
- `phases/api-key-reentry/index.json` (step 0~5 의 summary — **실제로 무엇이 만들어졌는지의 원장**)
- 구현 결과물 전부:
  - `/src/storage/api-key.ts`
  - `/src/features/onboarding/store.ts` · `/src/features/onboarding/resume.ts` ·
    `/src/features/onboarding/use-api-key-invalidation.ts`
  - `/src/features/schedule-sync/use-sync-error-toast.ts` · `/src/features/schedule-sync/format.ts`
  - `/src/components/organisms/CharacterTrackingPicker/CharacterTrackingPicker.tsx`
  - `/src/features/settings/store.ts`
  - `/src/app/content-scheduler/ContentScreen.tsx` · `/src/app/boss-scheduler/BossScreen.tsx` ·
    `/src/app/boss-profit/BossProfitScreen.tsx`

## 작업

### 1. ADR-115 를 '구현 완료'로 마감

- 제목 상태를 `(설계 확정 · 구현 전, 2026-08-08)` → **`(구현 완료 · 실기기 미검증, 2026-08-08, 이슈 #157)`**
  로 바꾸고, `/docs/ADR.md` 인덱스 행의 상태 표기도 **같이** 동기화하라(CLAUDE.md: ADR 이 '설계, 구현
  전'으로 남는 일이 잦으니 완료 시 명시할 것).
- **검증 절**을 실측으로 채워라: 최종 테스트 수/파일 수(기준선 **2,570개 / 172파일** 대비 순증),
  build 성공 여부, lint(기준선 **0 errors / 17 warnings**), 신규/수정 테스트 파일 × 담보하는 결정 대조표.
- **"구현하며 정정한 것"** 절을 만들어 step 1~5 가 설계와 다르게 간 지점을 전부 적어라(없으면 없다고
  적어라). 예: 시그니처 변경, 예상 못 한 고아 정리, 테스트로 드러난 사실.
- **"자동 테스트가 담보하지 못하는 것"** 절을 만들어 **실기기·실사용 몫**을 명시하라. 최소한 이 넷은
  담아라:
  1. 실제 401 을 받는 상황(넥슨에서 키 삭제·재발급)을 재현해 본 적이 없다 — 전 경로가 모킹된 401 이다
  2. 화면을 빼앗기는 체감([[ADR-115]] 결정 1 의 트레이드오프) — 작업 중이던 화면이 사라지는 것이
     실사용에서 어떻게 읽히는지
  3. 토스트 1회 · 이동 1회가 **실기기에서** 그렇게 보이는지(여러 캐릭터 401 동시 발생)
  4. 재입력 후 재개가 실제로 예열 없이 빠른지

### 2. step 0 이 갱신한 문서 3종을 **구현과 대조**

한 줄씩 실제 코드와 맞는지 확인하고, **어긋나면 문서를 고쳐라**:

- `onboarding.md` "단계 재개" — 파생표가 `resume.ts#deriveResumeTarget` 의 실제 판정 순서와 같은가?
  키 재입력 경로 소절이 실제 구현(대조 가드 포함)과 같은가?
- `settings.md` — 계정 변경 모달의 401 동작(step 5)이 문서와 같은가? `changeApiKey` 가 여전히
  배선되지 않았음이 적혀 있는가?
- `error-resilience.md` — 401/403 행의 처방이 실제 코드와 같은가? 원칙 3 의 401 서술이 "액션을 주지
  않는다"로 되어 있는가?

**세 문서 중 어느 것도 고칠 필요가 없었다면 "대조했고 정정 없음"을 summary 에 명시하라** — 대조를
건너뛴 것과 구분돼야 한다.

### 3. 이슈 #157 대조표

이슈 본문의 요구·결정·미정 항목을 **한 행씩** 훑어 무엇을 했고 무엇을 안 했는지 표로 정리해
summary 에 담아라. 최소한 아래를 판정하라:

| 이슈 항목 | 판정할 것 |
|---|---|
| 요구사항(키를 다시 입력받을 수 있는 화면으로 보낸다) | 했다 / 부분 / 안 함 |
| 경우 B(키 무효화) 막다른 길 | 해소됐는가 |
| 결정(온보딩으로 보내되 뒤 단계는 저장값 재개) | 구현과 일치하는가 |
| 진입 방식(토스트 + 자동 이동, 액션 없음) | 일치하는가 |
| 구현 시 정할 것 3건(문구 통일 · 토스트 겹침 · 재이동 루프) | 각각 어떻게 처리됐는가 |
| **미정 1(재개 지점 실측)** | 실측 결과와 그것이 결정을 성립시켰는지 |
| 미정 2(진입 방식) | 이미 결정됨 |
| **미정 3(설정 "API 키 변경" 행 부활)** | **안 했다 — #135 와 함께 볼 것**([[ADR-115]] 결정 8) |
| 관련 #61(API 키 발급 가이드 페이지) | 이 phase 범위 밖 — 상태만 적어라 |

### 4. 열린 질문 정리

`docs/features/onboarding.md`·`docs/features/settings.md` 의 **"열린 질문"** 항목을 훑어 이 phase 로
**닫힌 것이 있으면 제거·정리**하라(CLAUDE.md 규약). 닫힌 것이 없으면 "닫힌 열린 질문 없음"을
summary 에 적어라. **닫히지 않은 것을 닫힌 것처럼 지우지 마라.**

새로 생긴 열린 질문이 있으면 해당 문서에 추가하라 — 최소한 이 둘은 후보다:
- 무효화 자동 이동이 실사용에서 화면을 빼앗는 체감(실기기 미검증)
- 설정 "API 키 변경" 행 부활 여부(#135)

### 5. 이슈 #157 코멘트 초안

구현 요약 + 미정 3 이 남았다는 사실 + 실기기 검증 몫을 담은 **코멘트 초안을 summary 에 담아라.**
**`gh` 로 실제 코멘트를 달지는 마라** — 발행은 사용자 몫이다.

## Acceptance Criteria

```bash
npm run build                                    # 성공
npm test                                         # 전부 통과 (최종 개수를 summary 에 기록)
npm run lint                                     # errors 0 (warnings 17 은 baseline)
# 이 step 은 코드를 바꾸지 않는다
git status --porcelain -- src/ | wc -l           # 0
# ADR 이 완료로 마감됐다
grep -q '구현 완료' docs/adr/ADR-115.md
grep -q '구현 완료' docs/ADR.md                   # ADR-115 행 (다른 행에도 있으니 눈으로 확인)
# 이 phase 가 없앤 것들이 실제로 없다
grep -rn 'openSettings' src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | wc -l   # 0
grep -rc '설정에서 키를 다시 등록해주세요' src/features/schedule-sync/format.ts               # 0
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. **문서-코드 대조를 실제로 하라** — 문서를 읽고 "맞겠지" 하지 말고, 각 서술이 가리키는 코드를 열어
   확인하라. 특히 재개 파생표는 `resume.ts` 와 **판정 순서까지** 대조하라.
3. **ADR-115 의 결정 8개가 전부 구현됐는지 하나씩 확인하고, 구현되지 않은 것이 있으면 summary 에
   명시하라.** 결정을 조용히 지우지 마라 — 안 한 것은 안 했다고 적는다.
4. 결과에 따라 `phases/api-key-reentry/index.json` 의 step 6 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"` (위 3·4·5 의 결과를 담아라)
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/` 를 고치지 마라.** 이유: 이 step 은 대조·마감이다. 코드 결함을 발견했다면 고치는 것이 아니라
  **보고**해야 사용자가 별도 step/이슈로 다룰 수 있다.
- **`gh issue comment` 등으로 이슈에 글을 쓰거나 PR 을 만들지 마라.** 이유: 외부로 나가는 행위는
  사용자 승인 사항이다. 초안만 summary 에 담는다.
- **닫히지 않은 열린 질문을 지우지 마라.** 이유: 미검증(실기기)과 해결은 다르다.
- **ADR-115 의 결정을 사후에 고쳐 구현에 맞추지 마라.** 이유: 구현이 결정에서 벗어났다면 그것이 보고할
  사실이다. 다만 **결정이 옳고 구현이 옳은데 문서 서술만 부정확한 경우**는 문서를 고치는 것이 맞다 —
  둘을 구분해 summary 에 적어라.
- **설정 "API 키 변경" 행을 "이왕 하는 김에" 넣지 마라.** 이유: 미정 3 이고 #135 와 함께 본다.
