# Step 3: storage-ports

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/README.md` — **원칙 1(어댑터 시그니처 고정)이 이 step 의 핵심 제약이다**
- `/docs/migration/data.md` — 기존 사용자 데이터 보존 설계. 포트 인터페이스의 모양이 여기서 나온다
- `/docs/persistence/README.md` · `/docs/persistence/preferences.md` · `/docs/persistence/sqlite.md`
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-003]] · [[ADR-005]] · [[ADR-050]] · [[ADR-052]]** 만 열어라
- **작업 대상 전 파일**: `src/storage/**` (21개 소스 + 18개 테스트)
- **이전 step 산출물**: `packages/core/src/{data,types,nexon,lib}/` · `@core/*` alias

## 배경

`src/storage/` 21개 중 **14개가 `@capacitor/preferences` 또는 `@capacitor-community/sqlite` 를 직접
import 한다.** 이 상태로는 `packages/core` 로 옮길 수 없다 — core 는 Capacitor 를 몰라야 하고,
React Native 앱에는 그 패키지가 설치되지 않는다.

**이 step 에서는 파일을 옮기지 않는다. 의존 방향만 뒤집는다.** 이동은 step 5 다.

플러그인을 직접 import 하는 14개 파일:

```
cache-data.ts  manual-tracked-content.ts  shared-progress-cache.ts  drop-effect.ts
character-basic-cache.ts  last-run-bundle-version.ts  tracking-mode.ts  theme.ts
schedule-probe-ledger.ts  api-key.ts  scheduler-cache.ts  ads.ts
character-selection.ts  sqlite/db.ts
```

> `src/storage/` 가 [[ADR-003]]·[[ADR-005]] 의 어댑터 레이어이면서 플러그인을 직접 import 하는 것은
> 규칙 위반이 아니다 — 그 규칙이 금지한 것은 **`features/*` 가 직접 접근하는 것**이고 실제로
> `features/` 의 Capacitor 직접 import 는 0개다. 어댑터가 어댑티를 아는 것은 정상이고, 다만 그
> 방향을 뒤집어야 core 로 갈 수 있다.

## 작업

### 절대 어겨서는 안 되는 규칙 — 외부 시그니처 불변

`src/storage/*.ts` 가 **export 하는 함수의 이름·인자·반환 타입을 한 글자도 바꾸지 마라.**

```ts
// 이 시그니처들은 그대로다. 내부만 포트를 경유하게 바뀐다.
export async function getApiKey(): Promise<string | null>
export async function setLastAdShownAt(at: number): Promise<void>
export async function getLastAdShownAt(): Promise<number | null>
// ... 전부
```

이유: `packages/core` 로 갈 `features/` 39개 파일이 이 시그니처에 의존한다. 하나라도 바꾸면
이식이 재작성이 된다([[ADR-128]] 결정 4). 개선하고 싶은 것이 보여도 **이 task 에서는 하지 마라.**

### 1. 포트 인터페이스를 정의하라

`src/storage/ports.ts` (아직 `packages/core` 로 옮기지 않는다):

```ts
export interface PreferencesPort {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  keys(): Promise<string[]>
}

export interface SqlitePort {
  // src/storage/sqlite/db.ts 가 실제로 쓰는 연산만 노출하라.
  // 지금 CapacitorSQLite/SQLiteConnection API 중 무엇을 쓰는지 db.ts 를 읽고 결정할 것.
  // 넓게 잡지 마라 — RN 쪽에서 구현해야 할 표면이 그대로 늘어난다.
}
```

`keys()` 는 **선택 사항이 아니다.** `storage/cache-data.ts` 가 전체 키를 훑어 캐시 삭제 범위와
용량을 계산한다([[ADR-052]]·[[ADR-058]]). 빠지면 설정의 「캐시 삭제」·「계정 데이터 삭제」가 죽는다.

### 2. 주입 메커니즘을 만들어라

모듈 수준 setter 방식을 쓴다 — 이 저장소가 이미 모듈 수준 상태를 쓰는 방식과 일관된다
(`features/ads/tab-switch-ad.ts` 의 `__resetAdsForTest` 참고).

```ts
// src/storage/ports.ts
export function setPreferencesPort(port: PreferencesPort): void
export function setSqlitePort(port: SqlitePort): void
```

포트가 주입되지 않은 상태에서 storage 함수가 호출되면 **명확한 에러를 던져라.** 조용한 no-op 으로
두지 마라 — 이유: 앱 부팅 순서가 틀렸을 때 데이터가 없는 것처럼 보이는 증상이 나고, 그것이
데이터 손실과 구분되지 않는다.

### 3. Capacitor 구현을 분리하라

`src/storage/adapters/capacitor-preferences.ts` · `src/storage/adapters/capacitor-sqlite.ts` 로
빼고, 앱 부팅 지점(`src/main.tsx` 또는 `src/App.tsx` — 읽고 판단하라)에서 **storage 를 처음 쓰기
전에** 주입하라.

### 4. 14개 파일이 포트를 경유하게 고쳐라

각 파일에서 `import { Preferences } from '@capacitor/preferences'` 를 제거하고 포트를 쓰게 한다.
**함수 본문의 로직은 그대로 두어라** — 특히 아래는 동작 계약이니 건드리지 마라:

- `sqlite/db.ts` 의 `'no-encryption'` 인자 (`migration/data.md` 결정 2)
- `sqlite/db.ts` 의 `ensureColumn()` 멱등 로직 ([[ADR-069]] 결정 1)
- `sqlite/db.ts` 의 메이린 보스 키 이관 UPDATE 2건 (멱등, 매번 실행돼야 한다)
- `cache-data.ts` 의 `KEEP_KEYS` 구성 ([[ADR-052]])

### 5. 테스트를 포트 주입 방식으로 바꿔라

현재 `src/storage/__tests__/*.ts` 는 `vi.mock('@capacitor/preferences', ...)` 로 모듈을 가로챈다.
포트 역전 후에는 **가짜 포트를 주입**하는 방식이 자연스럽다.

**검증 내용을 바꾸지 마라. mock 방식만 바꿔라.** 각 테스트의 `it(...)` 블록이 확인하는 것 —
어떤 키로 저장하는가, 실패 시 어떻게 되는가, 경계값에서 무엇을 반환하는가 — 은 전부 그대로여야
한다. 테스트 개수가 줄면 그만큼 계약이 검증되지 않는 것이다.

## Acceptance Criteria

```bash
npm run build      # tsc -b && vite build — 컴파일 에러 없음
npm test           # vitest run — 199파일 / 3044개 전부 통과 (이 step 이전과 동일한 수)
npm run lint       # ESLint 통과
```

의존 역전이 실제로 됐는지 확인 — **`adapters/` 밖에서는 비어야 한다**:

```bash
grep -rn "@capacitor" src/storage --include='*.ts' | grep -v __tests__ | grep -v "storage/adapters/"
```

시그니처가 안 바뀌었는지 확인:

```bash
git diff --stat src/storage    # 변경은 있어야 정상
git diff src/storage | grep "^-export"   # export 시그니처 삭제가 없어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/storage/*.ts` 의 export 시그니처가 **하나도** 바뀌지 않았는가?
   - `features/` 를 수정했는가? **했다면 잘못된 것이다** — 시그니처를 유지했다면 features 는 손댈
     이유가 없다.
   - CLAUDE.md CRITICAL 규칙(`features/*` 가 저장소에 직접 접근 금지)을 위반하지 않았는가?
3. 결과에 따라 `phases/rn-core-extraction/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "정의한 포트 인터페이스와 주입 지점, 어댑터 파일 경로"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`src/storage/*.ts` 가 export 하는 함수의 이름·인자·반환 타입을 바꾸지 마라.** 이유: [[ADR-128]]
  결정 4. `features/` 39개가 이 시그니처에 의존하고, 바꾸는 순간 이식이 재작성이 된다.
- **파일을 `packages/core` 로 옮기지 마라.** 이유: 이동은 step 5 다. 역전과 이동이 한 커밋에 섞이면
  테스트가 깨졌을 때 원인이 갈리지 않는다.
- **`sqlite/db.ts` 의 `'no-encryption'` 을 바꾸지 마라.** 이유: 기존 사용자의 DB 가 평문으로 저장돼
  있고, 암호화를 켜면 **읽을 수 없게 된다**(`migration/data.md` 결정 2).
- **`ensureColumn()` 과 메이린 키 이관 UPDATE 를 지우거나 "정리"하지 마라.** 이유: 구버전에서
  올라오는 사용자의 DB 에는 `world`·`price_*` 컬럼이 없고, 이 코드가 없으면 그 데이터가 고아가 된다.
- **테스트의 검증 내용을 바꾸거나 줄이지 마라. mock 방식만 바꿔라.** 이유: 이 파일들이 지는 ADR 계약
  ([[ADR-052]]·[[ADR-058]]·[[ADR-069]]·[[ADR-124]] 등)을 확인하는 유일한 장치다.
- **포트 미주입 상태를 no-op 으로 처리하지 마라. 에러를 던져라.** 이유: 조용히 넘어가면 "데이터가
  없다"와 "포트가 없다"가 구분되지 않고, 사용자에게는 데이터 손실로 보인다.
- 기존 테스트를 깨뜨리지 마라.
