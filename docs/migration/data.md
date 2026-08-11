# 기존 사용자 데이터 보존

**범위**: 이미 앱을 쓰고 있는 사용자의 기기 데이터를 RN 빌드가 **그대로 이어받는** 방법. 전략은
[README.md](./README.md), 옮길 코드 목록은 [parity-inventory.md](./parity-inventory.md).

**관련 소스(read/write)**: `src/storage/**` · `capacitor.config.ts` · `android/` · `ios/`

**관련 ADR**: [[ADR-127]] · [[ADR-003]](로컬 저장소만 사용) · [[ADR-052]](캐시 삭제 범위·`KEEP_KEYS`) ·
[[ADR-050]](SQLite 도입) · [[ADR-058]](계정 데이터 삭제) · [[ADR-124]](드랍 가격 컬럼) · [[ADR-069]](월드 스냅샷)

**관련 문서**: `persistence/README.md` · `persistence/preferences.md` · `persistence/sqlite.md` ·
`persistence/lifecycle.md` · `foundation/release.md`

---

## 핵심 결론

**마이그레이션을 하지 않는다. 같은 저장소를 계속 쓴다.**

기존 데이터는 "Capacitor 안"에 있는 게 아니라 **OS가 앱마다 주는 표준 저장소**에 있다. 그 저장소는
프레임워크가 아니라 **앱 번들 ID에 귀속**되므로, 같은 `com.mapleroutine.app` 으로 빌드한 RN 앱이 그냥
읽는다. 복사할 것도, 변환할 것도, 실패할 것도 없다.

이것이 [README.md](./README.md) 원칙 5("한 번에 성공해야 하는 것을 최소화한다")의 가장 큰 적용처다.

| | 앞선 검토안 | **채택안** |
|---|---|---|
| Preferences | 읽어서 MMKV로 1회 복사 | **그대로 사용 — 복사 없음** |
| SQLite | 새 경로로 파일 복사 | **경로 지정해 그대로 열기** |
| 남는 위험 | "마이그레이션이 한 번에 성공해야 함" | "새 코드가 옛 저장소를 제대로 읽는가" |

두 위험은 성격이 다르다. 후자는 **매 실행 반복되는 정상 동작**이라 릴리스 전에 실기기에서 앱을 켜보면
검증되고, 틀려도 **데이터가 훼손되지 않는다** — 안 읽힐 뿐이고 원본은 그 자리에 있다.

---

## 전제 — 이게 깨지면 위 전부가 무효다

- [ ] **`appId` = `com.mapleroutine.app`** 유지
- [ ] **릴리스 서명키 동일** — 바뀌면 OS가 업데이트가 아니라 **신규 설치**로 처리하고, 앱 데이터
      디렉터리가 통째로 새로 만들어진다. **사용자 데이터가 전부 사라진다**

두 항목은 되돌릴 수 없다. `foundation/release.md` 의 서명 절차를 그대로 따른다.

---

## 결정 1 — Preferences는 기존 저장소를 계속 쓴다

### 근거: 저장 위치가 프레임워크와 무관하다

`@capacitor/preferences` 네이티브 구현 확인 결과(v8, 2026-08-11):

| | 저장 위치 | 키 형태 |
|---|---|---|
| **Android** | `getSharedPreferences("CapacitorStorage", MODE_PRIVATE)`<br>= `/data/data/com.mapleroutine.app/shared_prefs/CapacitorStorage.xml` | 접두사 **없음** |
| **iOS** | `UserDefaults.standard` | **`"CapacitorStorage." + key`** |

iOS 접두사는 그룹명 + `.` 이다(`Preferences.swift`). `capacitor.config.ts` 에서 그룹을 바꾼 적이 없으므로
기본값 `CapacitorStorage` 가 적용된다.

**값은 전부 문자열이다.** JS API가 `value: string` 만 받고 네이티브도 String으로 저장한다. 구조화된
데이터는 앱이 이미 `JSON.stringify` 해서 넣는다. **타입 변환이 없다.**

### 구현

RN 쪽에 get/set/remove/keys 4개 메서드짜리 네이티브 모듈(양 플랫폼 합쳐 ~120줄)을 만들고, 현재
`Preferences` 와 **동일한 시그니처**로 노출한다([README.md](./README.md) 원칙 1). `storage/` 21개 파일은
import 한 줄만 바뀌고 로직은 무수정이다.

```
getPreference(key)        → Android: prefs.getString(key, null)
                            iOS:     defaults.string(forKey: "CapacitorStorage." + key)
setPreference(key, value) → 각 저장소에 String 으로
removePreference(key)     → 각 저장소에서 제거
getPreferenceKeys()       → Android: prefs.getAll().keySet()
                            iOS:     dictionaryRepresentation().keys 중 접두사 필터 후 접두사 제거
```

**`getPreferenceKeys()` 는 선택 사항이 아니다.** `storage/cache-data.ts` 가 전체 키를 훑어 캐시 삭제
범위와 용량을 계산한다([[ADR-052]]·[[ADR-058]]). 이게 없으면 설정의 「캐시 삭제」·「계정 데이터 삭제」가
동작하지 않는다.

### 나중에 MMKV로 가고 싶다면

가능하다. 다만 **지금은 아니다.** 전환 릴리스에서 변수를 하나라도 줄이는 편이 낫고, RN이 안정화된
뒤에 옮기면 실패해도 다음 릴리스로 고칠 수 있다 — 지금은 그 안전망이 없다([README.md](./README.md)
«되돌릴 수 없는 지점»).

---

## 결정 2 — SQLite는 기존 파일을 그대로 연다

### 근거: 암호화가 꺼져 있고 스키마가 단순하다

```ts
// storage/sqlite/db.ts:143
connection.createConnection(DB_NAME, false, 'no-encryption', 1, false)
//                                            ^^^^^^^^^^^^^
```

**표준 SQLite 파일이다.** `op-sqlite` 든 무엇이든 그냥 열린다. 스키마 변환도, 행 단위 복사도 불필요하고
`CREATE TABLE IF NOT EXISTS` SQL을 **그대로 재사용**한다.

> iOS `Pods` 에 SQLCipher가 보이는 것은 플러그인의 전이 의존성일 뿐 사용하지 않는다.

### 파일 경로

| | 경로 |
|---|---|
| **Android** | `/data/data/com.mapleroutine.app/databases/boss_profitSQLite.db` |
| **iOS** | `<앱 컨테이너>/Documents/boss_profitSQLite.db` ⚠️ **실기기 미확인** |

파일명 규칙은 플러그인이 `dbName + "SQLite.db"` 로 만든다(`CapacitorSQLite.java:346`). DB 이름은
`boss_profit` 이므로 `boss_profitSQLite.db` 다.

⚠️ **iOS 경로 정정(2026-08-11)** — 이 표는 원래 `Library/CapacitorDatabase` 였고 **그것은 틀렸다.**
그 값은 플러그인 README 가 `iosDatabaseLocation` 을 *설정하는 예시*로 든 경로이고,
`capacitor.config.ts` 에는 그 설정이 없다. 설정이 없으면 플러그인은 `"Documents"` 를 쓰고
(`CapacitorSQLite.swift:98`) `UtilsFile.getFolderURL` 이 그것을 `NSDocumentDirectory` 로 푼다
(`UtilsFile.swift:161-162`) — 즉 `<앱 컨테이너>/Documents` 다(`Database.swift:75` 가 그 디렉터리에
파일명을 붙인다).

근거는 플러그인 소스지만 **실기기 앱 컨테이너를 열어 확인한 것은 아니다.** 여기가 틀리면 빈 DB 가
조용히 새로 생기고 사용자에게는 기록이 전부 사라진 것으로 보이므로, **실기기 검증에서 반드시 눈으로
확인할 것.** RN 어댑터는 이 경로를 op-sqlite 의 `IOS_DOCUMENT_PATH` 상수로 잡는다
(`packages/app-rn/src/storage/adapters/capacitor-sqlite-open.ts`).

### 보존 대상 테이블 (4)

전부 사용자가 손으로 쌓은 자산이다. 잃으면 API로 복구할 수 없다.

| 테이블 | 내용 | PK | 주의 |
|---|---|---|---|
| `boss_profit_records` | 보스 수익 기록 (10컬럼) | `(ocid, boss, difficulty, period_key)` | `world` 는 nullable — [[ADR-069]] 월드 스냅샷 |
| `boss_drop_records` | 드랍 기록 + 가격 (13컬럼) | `(ocid, boss, difficulty, period_key, drop_index)` | `price_state`/`price_meso`/`price_share` nullable, **NULL은 '미입력'이고 0과 다르다**([[ADR-124]]) |
| `boss_party_settings` | 파티 인원 설정 | `(ocid, boss, difficulty)` | |
| `boss_profit_period_checks` | 기간 체크 | `(ocid, cycle, period_key)` | |

### 스키마 진화 코드도 함께 옮긴다

`db.ts` 에는 데이터 형태를 유지하는 코드가 두 종류 더 있다. **화면에 안 보이지만 빠뜨리면 옛 데이터가
고아가 된다.**

1. **`ensureColumn()`** — `CREATE TABLE IF NOT EXISTS` 는 이미 만들어진 DB에 컬럼을 더해주지 않는다.
   `PRAGMA table_info` 로 확인 후 없을 때만 `ALTER TABLE ADD COLUMN` 한다([[ADR-069]] 결정 1).
   **구버전에서 올라오는 사용자의 DB에는 `world`·`price_*` 컬럼이 없을 수 있다.**
2. **메이린 보스 키 이관** — `'메이린'` → `'시즌 보스 메이린'` UPDATE 2건(2026-07-22). 이미 옮겨진
   기기에서는 WHERE에 걸리는 행이 없어 no-op이라 매번 실행해도 안전하다.

둘 다 **멱등**이므로 RN 구현에서도 부팅 시 그대로 실행한다.

---

## 결정 3 — `sessionStorage` 하나만 대체가 필요하다

`storage/pending-notice.ts` 가 유일하게 `sessionStorage` 를 쓴다([[ADR-065]]). 수명이 *"리로드는 넘기되
앱 종료와 함께 사라진다"* 인데, **RN에는 웹 리로드 개념이 없다.**

→ **그냥 모듈 변수로 둔다.** 그 파일 주석이 걱정하던 "Preferences는 영속이라 앱을 다시 켜도 남아 한참
뒤에 엉뚱한 시점에 뜬다" 문제가 자연히 사라진다. 마이그레이션 대상이 아니다(휘발성 데이터).

---

## 결정 4 — 예약된 로컬 알림은 재등록한다 (유일하게 **옮겨야** 하는 것)

**이 문서에서 가장 놓치기 쉬운 항목이다.**

`@capacitor/local-notifications` 로 예약한 알림은 **OS의 알림 스케줄러에 등록돼 있다.** 앱 코드가
아니라 OS가 들고 있으므로, 플러그인이 `notifee` 로 바뀌어도 **그대로 남아 발화한다.**

문제는 새 구현이 그것들을 **취소도 갱신도 못 한다**는 점이다 — ID 체계와 채널이 다르다. 결과:

| 증상 | 원인 |
|---|---|
| **중복 알림** | 옛 예약 + 새 예약이 둘 다 발화 |
| **유령 알림** | 사용자가 끈 항목의 옛 예약이 계속 뜸 |
| 취소 불능 | 새 코드의 `cancel(id)` 가 옛 ID를 모름 |

### 처리

1. 전환 후 **첫 실행에서 옛 예약을 전량 취소**한다. 새 SDK로는 못 하므로 **Capacitor 시절과 같은
   ID 규칙으로 네이티브에서 직접 취소**하거나, 플랫폼 API로 이 앱의 예약을 통째로 비운다
   (Android `AlarmManager` / iOS `removeAllPendingNotificationRequests`)
2. 그 다음 현재 설정에 맞춰 **전부 새로 예약**한다
3. 완료를 Preferences 키로 기록해 두 번 돌지 않게 한다

`native/notifications.ts` 에는 ADR 참조가 없지만, 동작 계약은 [[ADR-004]](서버 푸시 없이 로컬 알림만)와
`features/hunting-timer.md` 에 있다. **사냥 타이머의 상시 표시 알림([[ADR-005]])은 성격이 달라 별도
확인이 필요하다** — 예약 알림이 아니라 지속 알림이다.

---

## 데이터 인벤토리 — Preferences 전수

`storage/keys.ts` 기준. **보존 필수**와 **버려도 되는 것**을 나눈 근거는 [[ADR-052]] 의 `KEEP_KEYS` 다.

### 보존 필수 — 잃으면 사용자가 다시 입력해야 한다

| 키 | 내용 | ADR |
|---|---|---|
| `apiKey` | Nexon Open API 키 | [[ADR-007]]·[[ADR-115]] |
| `selectedAccountId` | 선택된 계정 | [[ADR-086]] |
| `theme` | 테마 선택 | [[ADR-009]]·[[ADR-104]] |
| `trackingMode` | 추적 모드 | [[ADR-035]] |
| `dropEffect` | 고가 드랍 연출 on/off | [[ADR-040]] |
| `trackedCharacters` | 추적 캐릭터 목록 | [[ADR-042]] |
| `lastSelectedCharacter` | 마지막 선택 캐릭터 | [[ADR-013]]·[[ADR-042]] |
| `manualTrackedContent:{ocid}` | 수동 모드 추적 항목 | [[ADR-035]] |
| `worldSharedProgress:{world}` | 월드 공유 진행 상태 | [[ADR-030]] |
| `accountSharedProgress:{accountId}` | 계정 공유 진행 상태 | [[ADR-030]] |

### 버려도 되는 것 — 재생성된다

| 키 | 왜 버려도 되나 |
|---|---|
| `schedulerCache:{ocid}` | API 재조회로 복원 |
| `characterBasicCache:{ocid}` · `characterBasicCache:index:{accountId}` | API 재조회로 복원 ([[ADR-016]]·[[ADR-086]]) |
| `characterBasicCache:index` (레거시) | 옛 전역 인덱스 — [[ADR-086]] 결정 9로 대체됨 |
| `scheduleProbe:{ocid}` | 조회 원장. 없으면 한 번 더 조회할 뿐 ([[ADR-034]]) |
| `lastAdShownAt` | 광고가 한 번 더 뜰 뿐 ([[ADR-090]]) |
| `lastRunBundleVersion` | 다음 부팅이 조용히 다시 기록 ([[ADR-126]] 결정 4) |

**단, "버려도 된다"와 "버린다"는 다르다.** 그대로 읽으므로 전부 살아서 넘어간다 — 위 구분은 실패
시나리오에서 무엇을 포기할 수 있는지의 목록이지, 삭제 목록이 아니다.

---

## 검증 절차 — 릴리스 전 필수

**시뮬레이터/에뮬레이터 신규 설치로는 아무것도 검증되지 않는다.** 반드시 *구버전 → 신버전 업데이트*
경로여야 한다.

### 절차

1. **현재 스토어 버전**(또는 동등한 Capacitor 빌드)을 실기기에 설치
2. 데이터를 실제로 쌓는다 — 보스 수익 기록 몇 건, 드랍 기록(가격 **미입력**인 행을 반드시 포함),
   파티 설정, 테마 변경, 캐릭터 추적, API 키
3. **`install -r` 로 RN 빌드를 덮어쓴다.** `uninstall` 하면 안 된다 — 데이터가 지워져 검증이 무의미해진다
   (MIUI는 애초에 `install -r` 만 허용한다)
4. 아래 체크리스트

### 체크리스트 (Android · iOS 각각)

- [ ] 보스 수익 기록이 **건수·금액까지** 그대로인가
- [ ] 드랍 기록의 **가격 미입력 행이 여전히 미입력인가** — `0` 으로 바뀌면 [[ADR-124]] 위반이고, 이건
      "0메소에 팔았다"는 **거짓 기록**이 된다
- [ ] `world` 가 NULL인 옛 기록이 월드별 집계에서 **제외되는가** ([[ADR-069]])
- [ ] 파티 인원 설정이 보스·난이도별로 유지되는가
- [ ] API 키로 동기화가 되는가
- [ ] 추적 캐릭터 목록과 순서가 같은가
- [ ] 테마가 그대로인가
- [ ] 설정 → 캐시 삭제 · 계정 데이터 삭제가 동작하는가 (`getPreferenceKeys()` 검증)
- [ ] `ensureColumn` 이 옛 스키마 DB에 컬럼을 더하는가 — **컬럼이 없는 DB로 따로 시험할 것**
- [ ] 예약 알림이 중복되지 않는가 (결정 4)
- [ ] 사냥 타이머 상시 알림이 동작하는가

---

## 미검증 항목

이 문서에서 확정하지 못한 것. **착수 전에 지울 것.**

| 항목 | 확인 방법 |
|---|---|
| iOS SQLite 기본 경로 — **플러그인 소스로는 `Documents` 확정**(결정 2), 실물만 남음 | 실기기 앱 컨테이너를 내려받아 `boss_profitSQLite.db` 위치 확인 |
| 사냥 타이머 상시 알림의 네이티브 구현 | `native/hunting-timer/` 와 `features/hunting-timer.md` 대조, RN 대응 SDK 결정 |
| 옛 로컬 알림 ID 체계 | Capacitor 플러그인의 ID 생성 규칙 확인 (결정 4의 취소 전략이 여기 달림) |

---

## 폐기된 정책 (history)

- ~~Preferences를 MMKV로 1회 복사하고 SQLite 파일을 새 경로로 옮긴다~~ → **양쪽 다 기존 저장소를 그대로
  사용한다**(결정 1·2). 저장 위치가 프레임워크가 아니라 앱 번들 ID에 귀속된다는 것을 네이티브 소스에서
  확인한 결과다(2026-08-11). 단발 마이그레이션 코드가 사라지면서 [[ADR-127]] 의 최대 위험 항목이
  "실패하면 복구 불가"에서 "실패해도 원본 보존"으로 내려갔다.
