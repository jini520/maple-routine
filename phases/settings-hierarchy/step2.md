# Step 2: release-notes-data

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/live-update.md` · `foundation/release.md` 를 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — **[[ADR-119]]** 가 이 step 의 계약이다. `/docs/adr/ADR-119.md` 를 열어라.
  [[ADR-006]] 도 열어 *"이 파일은 그 대상이 아니다"* 의 근거를 확인하라)
- `src/data/` 의 기존 파일들 (이 디렉터리의 관례 — 데이터 모양, export 방식)
- `src/types/index.ts` (타입을 어디에 두고 어떻게 재-export 하는지)
- `package.json` (`version` — 현재 `1.0.2`)

## 배경

[[ADR-119]] 결정 1 — 릴리스 노트의 **진실 원천은 저장소에 한 벌**이고, 거기서 두 갈래로 나간다:

```
src/data/release-notes.ts   ← 이 step 이 만드는 것
   ├─ 앱 번들에 그대로 포함   → 개발노트 화면 (step 5, 오프라인 O · 네트워크 0회)
   └─ publish 스크립트가 추출 → latest.json 의 notes  (step 8 → 이슈 #164 모달)
```

## 작업

### 1. 타입

릴리스 노트의 타입을 정의한다. 위치는 `src/types/` 의 기존 관례를 따라라(새 파일 `release-notes.ts` 를
만들고 `src/types/index.ts` 에서 재-export 하는 쪽이 이 저장소의 모양에 맞는지 먼저 확인할 것).

```ts
export interface ReleaseNoteItem {
  text: string
  /** 이 항목이 OTA 로 나가지 않는 네이티브 변경인지 — 화면에 「스토어 업데이트 필요」 표식이 붙는다. */
  requiresStoreUpdate?: boolean
}

export interface ReleaseNote {
  version: string   // x.y.z — package.json version 과 같은 축(ADR-119 결정 2)
  date: string      // YYYY-MM-DD
  items: ReleaseNoteItem[]
}
```

`requiresStoreUpdate` 가 **버전이 아니라 항목에 붙는 이유**(한 릴리스 안에 OTA 항목과 네이티브 항목이
섞일 수 있다 — ADR-119 결정 3)를 주석으로 남겨라.

### 2. `src/data/release-notes.ts` 신규

```ts
export const RELEASE_NOTES: ReleaseNote[]
```

**최신이 먼저 오도록 내림차순으로 둔다**(화면이 그대로 그린다 — step 5 가 정렬하지 않는다).

내용은 **`1.0.3` 한 건뿐이다.** [[ADR-119]] 결정 4 — 과거 버전(1.0.0 ~ 1.0.2)은 기록하지 않는다.
릴리스 노트는 사실 기록이라 사후에 지어내면 거짓 기록이 된다.

`1.0.3` 항목의 내용은 **이 phase 가 실제로 한 일**이고, 사용자가 읽을 문구로 쓴다(내부 용어·이슈 번호·
파일 경로를 쓰지 말 것). 두 줄이면 충분하다 — 설정 화면을 항목별로 나눠 정리했다는 것, 개발노트가
생겼다는 것. 날짜는 `2026-08-09`. `requiresStoreUpdate` 는 **이번 버전엔 해당 항목이 없다**(둘 다 OTA 로 나간다).

문구는 이 앱의 기존 톤을 따라라 — `~했어요` 체다(`AppUpdateSection` 의 `확인하고 있어요` ·
`features/tracking-mode/copy.ts` 를 참고).

### 3. 조회 헬퍼

`latest.json` 파생(step 8)과 화면(step 5)이 함께 쓸 조회 함수를 같은 파일에 둔다:

```ts
export function findReleaseNote(version: string): ReleaseNote | undefined
```

**없으면 던지지 말고 `undefined` 를 돌려라** — "노트가 없다"의 판정은 호출부가 한다(step 8 의 배포 가드는
그 판정으로 중단하고, 화면은 그냥 안 그린다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm run lint    # 새 error 0 (baseline: 0 errors / 17 warnings)
npm test        # 기준선 177 파일 / 2695 테스트 + 이 step 에서 추가한 개수
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. **테스트를 먼저 쓰고 구현하라(TDD).** 이 데이터는 배포 게이트가 읽으므로 **형식 자체를 테스트한다**:
   - 모든 항목의 `version` 이 `/^\d+\.\d+\.\d+$/` 를 만족한다
   - 모든 항목의 `date` 가 `/^\d{4}-\d{2}-\d{2}$/` 를 만족한다
   - `version` 에 중복이 없다
   - 배열이 **버전 내림차순**이다 (숫자 비교 — 문자열 정렬로 `1.0.10 < 1.0.9` 가 되지 않게)
   - 모든 `items` 가 비어 있지 않고 `text` 가 공백만이 아니다
   - `findReleaseNote` 가 있는 버전을 찾고, 없는 버전에 `undefined` 를 돌린다
3. 아키텍처 체크리스트:
   - `src/data/` 는 순수 데이터다 — 이 파일에서 `features/`·`storage/`·`native/` 를 import 하지 않았는가?
   - CLAUDE.md CRITICAL: [[ADR-006]] 은 **게임 레퍼런스 수치**(보스 목록·결정 가격·드랍 테이블)를
     AI 가 추정해 하드코딩하는 것을 금지한다. 릴리스 노트는 그 대상이 **아니다**(우리 릴리스 기록이다).
     다만 아래 금지사항의 "과거를 지어내지 마라"는 그대로 적용된다.
4. 결과에 따라 `phases/settings-hierarchy/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **1.0.0 ~ 1.0.2 의 노트를 지어내지 마라.** 이유: [[ADR-119]] 결정 4 가 사용자 결정으로 그것을 배제했다.
  릴리스 노트는 사실 기록이고, git log 를 추측해 채우면 거짓 기록이 된다. **`1.0.3` 한 건만 넣어라.**
- **`package.json` 의 `version` 을 올리지 마라.** 이유: 버전 범프는 릴리스 chore 이지 이 phase 의 일이 아니다.
  현재 `1.0.2` 그대로 두고, `release-notes.ts` 에는 `1.0.3` 을 적는다 — step 8 의 배포 가드는
  *"package.json 의 버전에 해당하는 노트가 있는가"* 를 보므로, 실제 배포 전에 버전을 올리면 그때 맞물린다.
- **화면 코드·매니페스트 코드를 건드리지 마라.** 이유: step 5(화면)·step 7(매니페스트)·step 8(배포)의 몫이다.
- **정렬·중복 제거를 런타임 코드로 넣지 마라.** 이유: 손으로 쓰는 파일이라 규칙은 **테스트로 강제**하는 것이
  맞다. 런타임에 정렬하면 잘못 쓴 파일이 조용히 통과한다.
- 기존 테스트를 깨뜨리지 마라
