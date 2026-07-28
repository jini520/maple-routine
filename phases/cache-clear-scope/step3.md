# Step 3: confirm-copy

"캐시 데이터 삭제" 확인 모달의 **삭제됨/유지됨 문구를 실제 삭제 범위와 동기화**한다([[ADR-052]] 결정 3). 문구가 실제 동작과 어긋나면 사용자가 잘못된 정보로 되돌릴 수 없는 삭제를 승인하게 된다.

## 배경 (문구가 어긋나 있던 지점)

수정 전 `CacheClearConfirm.tsx`는 삭제됨을 "스케줄 캐시 · 추적 캐릭터 · 보스 수익 기록", 유지됨을 "API 키"로만 적었다. 실제와 어긋난 점:

- **드롭 기록**: 문구에도 없고 삭제도 안 됐다(이번 phase step 2에서 삭제 대상에 포함됨)
- **`trackingMode`·`dropEffect`**: 삭제되는데 문구에 없었다(이번 phase step 2에서 보존 대상으로 승격됨)
- **`selectedAccountId`·`theme`**: 유지되는데 문구에는 "API 키"만 적혀 있었다

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-052.md` — 이번 작업의 결정. **결정 3**이 이 step의 규칙이다.
- `/docs/persistence/lifecycle.md` — step 0에서 갱신된 삭제 범위. **문구는 이 문서의 범위와 일치해야 한다.**
- `/docs/features/settings.md` — 설정 화면 UI 규약(리스트 행·모달 패턴).
- `/docs/foundation/design-system.md` — 모달·버튼·색 토큰 규약.
- **이전 step에서 수정된 파일 — 실제 최종 범위를 여기서 확인하라**:
  - `/src/storage/cache-data.ts` (step 2 — 최종 `KEEP_KEYS`와 삭제 대상 테이블 목록)
  - `/src/storage/sqlite/db.ts` (step 1 — `BOSS_PROFIT_TABLE_NAMES`)
- `/src/app/settings/CacheClearConfirm.tsx` — **유일한 수정 대상.** 공용 `Modal`을 쓰고(직접 오버레이를 그리면 안 되는 이유가 `:3-4` 주석에 있다), 삭제됨/유지됨 2행 구조(`:20-31`)와 복구 불가 안내(`:33-35`), 취소/삭제 버튼(`:37-54`)으로 돼 있다.
- `/src/app/settings/CacheDataSection.tsx` — 이 모달을 여는 호출부. 삭제 → 스플래시 → `closeBossProfitDb()` → 리로드 순서를 지킨다. **수정 대상이 아니다.**
- `/src/app/settings/__tests__/CacheDataSection.test.tsx` — 기존 테스트 컨벤션 참고용.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`src/app/settings/__tests__/CacheClearConfirm.test.tsx`를 **신규 작성**한다(현재 이 컴포넌트 전용 테스트가 없다). 같은 디렉토리의 다른 테스트(`DisconnectConfirm.test.tsx` 등)의 컨벤션을 따르라.

최소 케이스:
- `isOpen={false}`면 아무것도 렌더하지 않는다.
- 열렸을 때 **삭제됨 행에 드롭 기록이 포함**돼 있다.
- 열렸을 때 **유지됨 행에 API 키·메이플 ID(선택 계정)·테마·스케줄 관리 방법·드롭 연출이 포함**돼 있다.
- 복구 불가 안내 문구가 있다.
- `isClearing={true}`면 취소·삭제 버튼이 모두 비활성이고 삭제 버튼 라벨이 "삭제 중..."이다(기존 동작).
- 취소/삭제 클릭이 각각 `onCancel`·`onConfirm`을 부른다.

### 2. `src/app/settings/CacheClearConfirm.tsx` 문구 수정

**삭제됨** 행과 **유지됨** 행의 텍스트만 고친다.

- 삭제됨: 스케줄 캐시 · 추적 캐릭터 · 보스 수익 기록 · **드롭 기록**
- 유지됨: API 키 · **메이플 ID** · **테마** · **스케줄 관리 방법** · **드롭 연출**

문구 규칙:
- **사용자에게 보이는 이름을 써라.** 내부 키 이름(`selectedAccountId`·`trackingMode`·`dropEffect`)이 아니라 앱에서 실제로 쓰는 명칭을 쓴다 — 설정 화면의 행 라벨이 "스케줄 관리 방법"이고([[ADR-035]], `docs/features/settings.md`에 개명 이력 있음) 계정은 "메이플 ID"로 부른다.
- 두 행 모두 항목이 늘어 한 줄을 넘어갈 수 있다. **기존 레이아웃 구조(`flex items-start justify-between` + 오른쪽 정렬 + `border-b`)와 색 토큰(`text-error` / `text-text`)은 그대로 유지**하고, 줄바꿈이 자연스럽게 되도록만 확인하라. 새 레이아웃을 설계하지 마라.
- 복구 불가 안내(`:33-35`)는 그대로 둔다 — 드롭 기록도 같은 로컬 전용 데이터라 이 문장이 그대로 유효하다.

**정확성 규칙**: 문구에 적는 내용은 반드시 step 2의 실제 구현(`cache-data.ts`의 `KEEP_KEYS`와 삭제 대상)과 일치해야 한다. **추측으로 쓰지 말고 그 파일을 열어 확인한 뒤 써라.** 어긋나면 이 step은 실패다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과(신규 CacheClearConfirm 테스트 포함)
npm run lint    # 경고 0

# 문구에 드롭 기록이 들어갔는지
grep -n "드롭 기록" src/app/settings/CacheClearConfirm.tsx
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `app/` 화면 레이어만 수정했는가? (`storage/`·`features/`를 건드리지 않았는가)
   - 공용 `Modal` 사용을 유지했는가? (직접 오버레이를 그리면 `:3-4` 주석에 적힌 딤 누락 버그가 재발한다)
   - 문구의 **삭제됨/유지됨 항목이 `src/storage/cache-data.ts`의 실제 범위와 정확히 일치**하는가? 한 항목씩 대조하라.
   - `docs/persistence/lifecycle.md`(step 0)의 범위 서술과도 일치하는가?
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/cache-clear-scope/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 최종 문구 2줄을 그대로 적어라(다음 step의 문서 점검이 이걸 대조한다).
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/storage/cache-data.ts`·`src/storage/sqlite/db.ts`를 수정하지 마라. 이유: step 1·2에서 완료됐다. 문구가 구현과 안 맞으면 **문구를 고쳐라** — 구현이 [[ADR-052]]와 다르다고 판단되면 고치지 말고 `blocked`로 보고하라.
- 모달 레이아웃·버튼·색 토큰을 재설계하지 마라. 이유: 이 step의 범위는 문구 동기화다. `docs/foundation/design-system.md`가 정한 패턴을 임의로 바꾸면 다른 확인 모달들과 어긋난다.
- 공용 `Modal` 대신 직접 오버레이를 그리지 마라. 이유: `CacheClearConfirm.tsx:3-4` 주석에 적힌 대로, 호출부의 `space-y-*` margin에 `fixed inset-0` 높이가 깎여 하단 제스처 영역의 딤이 빠지는 실기기 버그가 재발한다.
- 문구에 내부 저장소 키 이름을 노출하지 마라. 이유: 사용자 대상 안내문이다.
- 실제 범위와 다른 항목을 문구에 적지 마라. 이유: 되돌릴 수 없는 삭제를 잘못된 정보로 승인하게 만든다 — 이번 이슈(#63)가 지적한 문제 그 자체다.
- 기존 테스트를 깨뜨리지 마라.
