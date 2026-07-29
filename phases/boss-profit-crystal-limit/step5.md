# Step 5: docs-finalize

이 task는 GitHub 이슈 **#52**(캐릭터별 주간 보스 진행률 `n/12`)와 **#53**(월드별 주간 결정석 판매 한도 `n/90`)의 구현을 마친 상태다. 이 step은 **문서를 구현 결과와 일치시키고 상태를 확정**한다.

이 프로젝트 규칙상 ADR과 기능 문서는 "설계, 구현 전"으로 남는 경우가 많으므로, 구현 완료 시 그 상태를 명시하는 것이 이 step의 존재 이유다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 **실제 구현된 코드와 문서가 어긋나는 지점**을 찾아라:

- `/CLAUDE.md` (프로젝트 규칙 — 문서 관리 규칙: 폐기된 정책은 지우지 말고 history 섹션으로, ADR은 구현 완료 시 상태 명시)
- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — ADR-054 행)
- `/docs/adr/ADR-054.md` (이 task의 정책 원장)
- `/docs/features/boss-profit.md` (이 화면의 정책 전문)
- `/docs/foundation/game-data.md` (`weekly-bosses.json` 항목)
- `/src/data/weekly-bosses.json` (`weeklyCrystalSaleLimit`, 상단 `note`)
- `/src/lib/boss-matching.ts` (`WEEKLY_CRYSTAL_SALE_LIMIT`, `isSeasonBossName`)
- `/src/features/boss-profit/store.ts` (`BossProfitRow.world`)
- `/src/app/boss-profit/BossProfitScreen.tsx` (**실제로 구현된 클래스·배치·조건이 문서 레시피와 같은지 대조하라**)

## 작업

### 1. 문서와 구현 대조 (가장 중요)

`docs/features/boss-profit.md` 에 적힌 두 레시피(캐릭터 카드 헤더 배지, 총 수익 헤드라인 결정석 줄)를 `BossProfitScreen.tsx` 의 실제 코드와 한 줄씩 대조하라. 어긋나면 **문서를 구현에 맞춰 고쳐라**(코드를 문서에 맞춰 바꾸지 마라 — 구현 단계에서 내린 판단에는 이유가 있었을 수 있고, 이 step은 코드를 고치는 step이 아니다).

대조 항목:
- 배지·결정석 줄의 클래스와 위치
- 표시 조건(주간 탭 · 현재 기간 한정 / 월간 탭은 분모 없는 개수)
- 단일 월드 vs 복수 월드 분기, 펼침 동작
- 월드 미상 캐릭터 제외
- 아이콘 파일명(`intense_power_crystal_weekly.webp` · `intense_power_crystal_monthly.webp`)과 조회 경로(`getItemIconUrlByFile`)

구현이 문서와 다르고 **그 차이가 정책 수준**이면(예: 표시 조건이 달라졌다면) `docs/adr/ADR-054.md` 의 해당 결정도 함께 현행화하라.

### 2. 상태를 "구현 완료"로 확정

- `docs/adr/ADR-054.md` 의 상태를 `(설계, 구현 전)` → `(구현 완료, 2026-07-29)` 로 바꾼다.
- `docs/ADR.md` 인덱스의 ADR-054 행 상태도 동일하게 `(구현 완료, 이슈 #52·#53)` 로 바꾼다.

### 3. 열린 질문 정리

`docs/features/boss-profit.md` 하단 `## 열린 질문` 을 읽고, **이번 작업으로 이미 해소된 항목이 남아 있으면 제거하라**(CLAUDE.md 규칙: 열린 질문이 이미 구현됐는지 확인하고 완료됐으면 정리할 것). 예컨대 아코디언 아바타 관련 미확정 항목처럼 이번 범위와 무관한 것은 그대로 둔다.

`docs/foundation/game-data.md` 의 `## 데이터 확정 현황` 에 `weeklyCrystalSaleLimit: 90`(2026-07-29 사용자 확정) 반영 사실을 한 줄 추가하라.

### 4. 알려진 한계를 문서에 남기기

`docs/features/boss-profit.md` 에 아래 한계를 명시하라(사용자가 나중에 "숫자가 왜 실제와 다르냐"고 물을 때의 답이다):

- **추적 밖 캐릭터의 처치는 셀 수 없다.** 90은 월드 단위 한도인데 앱은 사용자가 고른 추적 캐릭터만 동기화한다([[ADR-042]]). 같은 월드의 추적 밖 캐릭터로 보스를 잡으면 실제 소진량보다 적게 표시된다.
- **월드를 모르는 캐릭터는 월드 합계에서 빠진다**(구버전 `character-basic-cache` 엔트리에는 `world` 가 없다). 해당 캐릭터의 카드 배지 `n/12` 는 정상 표시되므로 개별 진행률 정보는 잃지 않는다.
- **과거 기간·월간 탭에는 주간 진행률을 표시하지 않는다**와 그 이유(가격 미확정 보스 미기록 / 월간 탭 `rows` 에 주간이 없음).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(이 step은 src/ 무변경이므로 그대로 통과해야 한다)
npm test        # 전체 통과 — 이 task 시작 시점 베이스라인은 114 파일 / 1312건 전부 통과였다.
git diff --name-only                       # docs/ 하위 파일만 나와야 한다
grep -n "구현 완료" docs/adr/ADR-054.md      # 상태가 갱신됐는지
grep -n "ADR-054" docs/ADR.md              # 인덱스 행 상태가 갱신됐는지
grep -rn "intense_power_crystal" docs/ src/ # 문서와 코드가 같은 파일명을 가리키는지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/README.md` 가 정한 문서 계층을 지켰는가?
   - ADR 전문은 `docs/adr/ADR-054.md` 에 있고 `docs/ADR.md` 에는 한 줄만 있는가?
   - 폐기된 정책을 지우지 않고 "폐기된 정책 (history)" 섹션으로 옮겼는가?
3. 결과에 따라 `phases/boss-profit-crystal-limit/index.json` 의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `src/` 아래 어떤 파일도 수정하지 마라. 이유: 이 step은 문서 확정 전용이다. 구현 결함을 발견하면 고치지 말고 `index.json` 의 `summary` 에 기록해 사용자가 판단하게 하라.
- 문서에 맞추려고 코드를 바꾸지 마라. 이유: 구현 단계에서 내린 판단에는 근거가 있었을 수 있으므로, 어긋나면 문서를 구현에 맞춘다.
- 기존 정책 문장을 삭제하지 마라. 이유: 이 저장소는 폐기된 정책을 지우지 않고 각 문서 하단 "폐기된 정책 (history)" 섹션으로 옮긴다.
- 기존 테스트를 깨뜨리지 마라
