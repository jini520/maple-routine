# Step 1: rn-preferences

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/migration/data.md`** — **이 step 의 설계가 전부 여기 있다. 반드시 정독하라**
- `/docs/persistence/README.md` · `/docs/persistence/preferences.md`
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-003]] · [[ADR-052]] · [[ADR-058]]** 만 열어라
- `packages/core/src/storage/ports.ts` (**`PreferencesPort` 계약**)
- `packages/app-capacitor/src/storage/adapters/capacitor-preferences.ts` (**참조 구현**)
- `packages/core/src/storage/keys.ts` · `packages/core/src/storage/cache-data.ts`
- **이전 step 산출물**: `packages/app-rn` 의 jest 설정 · `@core/*` moduleNameMapper

## 배경 — 이 task 에서 가장 위험한 step 이다

기존 사용자의 설정·API 키·추적 캐릭터가 전부 여기 걸려 있다. **틀리면 사용자에게는 데이터가 사라진
것으로 보인다.**

핵심 설계는 `docs/migration/data.md` 결정 1이다 — **데이터를 옮기지 않는다. 같은 저장소를 계속 쓴다.**

| | 저장 위치 | 키 형태 |
|---|---|---|
| **Android** | `getSharedPreferences("CapacitorStorage", MODE_PRIVATE)` | 접두사 **없음** |
| **iOS** | `UserDefaults.standard` | **`"CapacitorStorage." + key`** |

값은 **전부 문자열**이다. 구조화된 데이터는 호출부가 이미 `JSON.stringify` 해서 넣는다 — 이 경계에
타입 변환이 없다.

기성 라이브러리가 이걸 해주지 않으므로 **커스텀 Expo 모듈(Kotlin/Swift)을 직접 쓴다.**

## 작업

### 1. Expo 모듈을 만들어라

`packages/app-rn` 안에 로컬 Expo 모듈(Expo Modules API)로 만든다. 노출할 연산은 `PreferencesPort` 와
같은 넷이다.

```
getValue(key: String): String?
setValue(key: String, value: String)
removeValue(key: String)
getAllKeys(): [String]
```

**Android 구현** — `context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)`.
키에 접두사를 붙이지 **않는다**. `getAllKeys` 는 `getAll().keys` 다.

**iOS 구현** — `UserDefaults.standard`. **모든 키에 `"CapacitorStorage."` 접두사를 붙여** 읽고 쓴다.
`getAllKeys` 는 `dictionaryRepresentation().keys` 에서 접두사로 거른 뒤 **접두사를 떼서** 돌려준다.

> **접두사 문자열에 점(`.`)이 포함된다.** `"CapacitorStorage"` 가 아니라 `"CapacitorStorage."` 다.
> 틀리면 **조용히 아무것도 안 읽히고**, 사용자에게는 "데이터가 전부 사라졌다"로 보인다. 이 step 에서
> 오타 하나가 가장 비싼 지점이므로 **접두사 처리 로직의 테스트를 먼저 써라.**

### 2. 읽기와 쓰기가 **같은 저장소**를 봐야 한다

`get` 은 Capacitor 저장소에서 읽는데 `set` 은 다른 곳(MMKV 등)에 쓰면, 앱을 쓸수록 데이터가 갈라진다.
**네 연산 모두 같은 저장소를 대상으로 하라.** 새 저장 백엔드를 도입하지 마라.

### 3. `PreferencesPort` 구현

`packages/app-rn/src/storage/adapters/rn-preferences.ts` (경로는 app-capacitor 의 대칭 구조를 따르라).

```ts
import type { PreferencesPort } from '@core/storage/ports'
export const rnPreferencesPort: PreferencesPort = { /* ... */ }
```

**`keys()` 를 빠뜨리지 마라.** `storage/cache-data.ts` 가 전체 키를 훑어 캐시 삭제 범위와 용량을
계산한다([[ADR-052]]·[[ADR-058]]). 없으면 설정의 「캐시 삭제」·「계정 데이터 삭제」가 죽는다.

### 4. 순수 로직을 분리해 jest 로 테스트하라

접두사 붙이기/떼기, 키 목록 필터링은 **네이티브가 아니라 TS 쪽 순수 함수**로 뺄 수 있다. 그렇게 하고
테스트를 써라 — 네이티브 모듈 전체를 목으로 감싸는 테스트는 **내가 상상한 SDK 를 검증할 뿐**이라
가치가 낮다.

최소한 이것들은 테스트로 고정하라:
- iOS 접두사가 정확히 `"CapacitorStorage."` 인가
- 접두사를 뗀 키 목록이 원래 키와 일치하는가
- 접두사가 없는 무관한 `UserDefaults` 키가 목록에 섞이지 않는가

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build      # app-capacitor 영향 없음
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json    # PreferencesPort 적합성
```

**Android 네이티브 컴파일** (필수):

```bash
cd packages/app-rn && npx expo prebuild --no-install --platform android
cd android && ./gradlew assembleDebug
```

**iOS** (best-effort): `pod install` 이 안 돼 있어 컴파일 검증이 안 될 수 있다. 시도해 보고 환경
때문에 막히면 **`error` 가 아니라 `blocked`** 로 기록하고 사유에 정확히 적어라.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - iOS 접두사가 `"CapacitorStorage."`(점 포함)인가?
   - Android 는 접두사를 **안 붙이는가**?
   - 네 연산이 전부 **같은 저장소**를 보는가? (읽기/쓰기가 갈리지 않았는가)
   - `keys()` 가 구현됐는가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다** — 포트는 이미 정의돼 있다
3. 결과에 따라 `phases/rn-adapters/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "모듈 경로·접두사 처리 방식·테스트한 순수 로직·Android 컴파일 결과·iOS 검증 여부"`
   - 실패 → `"status": "error"`, `"error_message"` / 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

**summary 에 "데이터를 읽는 것을 확인했다"고 쓰지 마라.** 실기기 없이는 증명되지 않는다 — 확인한
것은 "컴파일된다"와 "순수 로직이 맞다"까지다. 과장하면 단계 2에서 아무도 다시 안 본다.

## 금지사항

- **접두사를 `"CapacitorStorage"`(점 없이)로 쓰지 마라.** 이유: 아무것도 안 읽히는데 에러도 안 나서,
  사용자에게는 데이터 전멸로 보인다. 이 step 에서 가장 비싼 오타다.
- **MMKV·AsyncStorage 등 새 저장 백엔드를 도입하지 마라.** 이유: `data.md` 결정 1 — 기존 저장소를
  그대로 쓰는 것이 이 전환에서 단발 실패 지점을 없애는 유일한 방법이다. MMKV 이관은 RN 안정화 후
  별개 결정이다.
- **`packages/core` 를 수정하지 마라.** 이유: `PreferencesPort` 는 이미 정의돼 있고, 구현이 인터페이스를
  바꾸기 시작하면 app-capacitor 가 깨진다.
- **`keys()` 를 빼거나 빈 배열을 돌려주지 마라.** 이유: 설정의 캐시 삭제·계정 데이터 삭제가 조용히
  아무 일도 안 하게 된다([[ADR-052]]·[[ADR-058]]).
- **기존 데이터를 마이그레이션하거나 복사하는 코드를 쓰지 마라.** 이유: 이 설계의 핵심은 옮기지 않는
  것이다. 옮기는 코드는 곧 "한 번에 성공해야 하는 코드"이고, 전환 릴리스에는 그것을 고칠 OTA 가 없다.
- 기존 테스트를 깨뜨리지 마라.
