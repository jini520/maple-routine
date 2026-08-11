# Step 2: rn-sqlite

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/migration/data.md`** — 결정 2(SQLite 를 그대로 연다) · «미검증 항목» · «검증 절차»
- `/docs/persistence/sqlite.md`
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-050]] · [[ADR-069]] · [[ADR-117]] · [[ADR-124]]** 만 열어라
- `packages/core/src/storage/ports.ts` (**`SqlitePort` · `SqliteDbConnection` 계약**)
- **`packages/core/src/storage/sqlite/db.ts`** (이 포트를 부르는 유일한 곳 — 무엇을 어떤 순서로
  부르는지 읽어라)
- `packages/app-capacitor/src/storage/adapters/capacitor-sqlite.ts` (**참조 구현**)
- **이전 step 산출물**: `packages/app-rn/src/storage/adapters/rn-preferences.ts` — **같은 배치·명명을
  따르라**

## 배경 — step 1 과 함께 가장 위험한 step 이다

보스 수익 기록·드랍 기록이 걸려 있다. **API 로 복구할 수 없는 데이터**다.

`data.md` 결정 2: **기존 파일을 그대로 연다.** 스키마 변환도, 행 복사도 없다.

| | 경로 |
|---|---|
| **Android** | `/data/data/com.mapleroutine.app/databases/boss_profitSQLite.db` |
| **iOS** | `Library/CapacitorDatabase/boss_profitSQLite.db` ⚠️ **미검증** |

파일명은 플러그인이 `dbName + "SQLite.db"` 로 만든 것이다. DB 이름이 `boss_profit` 이므로
`boss_profitSQLite.db`.

⚠️ **iOS 경로는 `data.md` 에서 유일한 미검증 항목이다.** 실기기 컨테이너를 열어보지 못했다. 코드에
상수로 박되 **그 사실을 주석과 summary 에 남겨라** — 단계 2(실기기 검증)에서 반드시 확인해야 한다.

## 작업

### 1. 임의 절대 경로를 열 수 있는 라이브러리를 골라라

**필수 조건이다.** 기존 DB 가 Capacitor 위치에 있으므로, 자기 전용 디렉터리만 쓰는 라이브러리로는
**기존 데이터에 닿을 수 없다.** `op-sqlite` 처럼 location 지정이 되는 것을 써라. 고른 근거를
summary 에 남겨라.

### 2. `SqlitePort` · `SqliteDbConnection` 구현

`packages/app-rn/src/storage/adapters/rn-sqlite.ts`.

```ts
import type { SqliteDbConnection, SqlitePort } from '@core/storage/ports'
export const rnSqlitePort: SqlitePort = { /* ... */ }
```

연산별 주의:

| 연산 | 주의 |
|---|---|
| `isWebPlatform()` | RN 은 **항상 `false`**. 웹 폴백(jeep-sqlite)은 RN 에 없다 |
| `initWebStore()` | `isWebPlatform()` 이 참일 때만 불린다 → RN 에서는 도달하지 않는다. 그래도 던지지 말고 no-op 으로 두어라 |
| `isConnection(db)` | stale 커넥션 감지용([[ADR-050]] 결정 2). RN 은 웹뷰 리로드가 없어 개념이 다르다 — 실제로 열려 있는지 정직하게 답하라 |
| `closeConnection(db)` | |
| `createConnection(db, encryption, version)` | `encryption` 으로 **`'no-encryption'`** 이 들어온다. 암호화를 켜지 마라 |

`SqliteDbConnection` 의 네 연산(`open`/`execute`/`query`/`run`) 중 **`query` 의 반환 형태를 정확히
맞춰라**:

```ts
query(statement, values?): Promise<{ values?: Record<string, unknown>[] }>
```

호출부(`db.ts`·`boss-*.ts`)가 `result.values` 를 읽는다. 라이브러리가 `rows` 나 배열을 직접 주면
**이 모양으로 감싸라.** 안 맞으면 조회가 조용히 빈 결과가 되고, 사용자에게는 기록이 사라진 것으로 보인다.

### 3. `db.ts` 를 고치지 마라

스키마 생성·`ensureColumn`([[ADR-069]] 결정 1)·메이린 키 이관·타임아웃([[ADR-117]] 결정 5)·stale
커넥션 복구는 **전부 `db.ts` 에 있고 그대로 돈다.** 이 step 은 그 아래 플러그인 호출만 바꾼다.

`db.ts` 를 손대야 할 것 같으면 포트 구현이 계약을 안 지킨 것이다. **어댑터를 고쳐라.**

### 4. 순수 로직을 jest 로 테스트하라

- 경로 조립(플랫폼별 디렉터리 + `boss_profitSQLite.db`)
- `query` 결과를 `{ values }` 모양으로 감싸는 변환
- `'no-encryption'` 이 전달돼도 암호화를 켜지 않는지

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
```

**Android 네이티브 컴파일** (필수):

```bash
cd packages/app-rn && npx expo prebuild --no-install --platform android
cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 환경 때문에 막히면 `blocked` 로 기록하고 사유를 정확히 적어라.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `packages/core/src/storage/sqlite/db.ts` 를 수정했는가? **했다면 잘못된 것이다**
   - `query` 반환이 `{ values?: Record<string, unknown>[] }` 인가?
   - 암호화가 꺼져 있는가?
   - 파일명이 `boss_profitSQLite.db` 인가? (`boss_profit.db` 가 아니다)
   - iOS 경로가 미검증이라는 사실이 코드 주석과 summary 에 남았는가?
3. 결과에 따라 `phases/rn-adapters/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "고른 라이브러리와 근거·플랫폼별 경로·query 변환 방식·iOS 경로 미검증 명시"`
   - 실패 → `"status": "error"`, `"error_message"` / 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

**"기존 DB 를 읽는 것을 확인했다"고 쓰지 마라.** 실기기 없이는 증명되지 않는다.

## 금지사항

- **자기 전용 디렉터리만 쓰는 SQLite 라이브러리를 고르지 마라.** 이유: 기존 DB 가 Capacitor 위치에
  있어 닿을 수 없고, 사용자의 보스 수익·드랍 기록이 빈 것으로 보인다.
- **암호화를 켜지 마라.** 이유: 기존 DB 가 평문(`'no-encryption'`)이라 암호화를 켜면 **읽을 수 없게
  된다**(`data.md` 결정 2).
- **`packages/core/src/storage/sqlite/db.ts` 를 수정하지 마라.** 이유: 스키마·마이그레이션·복구 로직이
  전부 거기 있고, 그것들이 app-capacitor 와 공유된다. 고치면 배포 중인 앱이 함께 바뀐다.
- **파일명을 `boss_profit.db` 로 쓰지 마라.** 플러그인 규칙은 `dbName + "SQLite.db"` 다. 이유: 이름이
  다르면 **빈 DB 가 새로 생기고**, 사용자에게는 전 기록이 사라진 것으로 보인다.
- **기존 DB 를 복사·변환·이동하는 코드를 쓰지 마라.** 이유: 그대로 여는 것이 설계다. 복사는 단발
  실패 지점을 만들고 전환 릴리스에는 그것을 고칠 OTA 가 없다.
- 기존 테스트를 깨뜨리지 마라.
