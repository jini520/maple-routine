# Live Update (OTA)

> **범위**: 스토어 심사 없이 JS 번들을 배포하는 OTA. 프로토콜 · 호스팅 · 사용자 동의형 UX ·
> 관찰용 UI · 적용 경로의 복구 장치가 여기 있다.
> **여기 없는 것**: 스토어 릴리스 절차는 [../foundation/release.md](../foundation/release.md),
> 설정 화면의 업데이트 섹션은 [settings.md](./settings.md).
> **관련 문서**: [splash.md](./splash.md) · [boss-profit.md](./boss-profit.md)

> **이 문서의 정책은 RN 앱(`expo-updates`)의 것이다.** @capgo 시절 프로토콜과 베타 채널, 리로드
> 커버는 캐패시터 앱과 함께 사라졌고 아래 [폐기된 정책](#폐기된-정책-history)에만 남는다.

## 관련 소스

| 구분 | 파일 | 하는 일 |
|---|---|---|
| 포트 | `src/native/live-update.ts` | 계약 |
| 어댑터 | `src/native/adapters/rn-live-update.ts` | `expo-updates` |
| 상태 | `src/features/live-update/store.ts` | 확인 · 다운로드 · 적용 |
| 화면 | `src/app/UpdatePromptModal.tsx` | 동의 모달 |
| 화면 | `src/app/settings/AppUpdateSection.tsx` | 설정의 업데이트 섹션 |
| 저장 | `src/storage/last-run-bundle-version.ts` | 적용 직후 안내를 띄울지 판정 |
| 서버 | `workers/ota-manifest/` | 매니페스트 Worker |
| 배포 | `scripts/publish-rn-ota.mjs` | 발행. 산출물은 GitHub Releases `live-update-rn` |
| 설정 | `app.json` 의 `expo.updates` | 런타임 버전과 매니페스트 URL |

**관련 ADR**: [[ADR-137]](현행 프로토콜) · [[ADR-154]](캐패시터 종료) ·
[[ADR-119]]·[[ADR-126]](릴리스 노트) · [[ADR-026]](관찰용 UI)

**폐기됐지만 이 문서가 그 결정 일부를 아직 따르는 것**: ⛔ ADR-027 결정 1·4·7 · ADR-117 결정
1·2·5·7·8 · ADR-022 결정 6 · ADR-024(버전 형식). **각 파일 배너의 🔗 줄에 적힌 것만 살아 있다.**

## 정책: Expo Updates v1, 호스팅은 자체 ([[ADR-137]])

- **프로토콜은 Expo Updates v1**, 호스팅은 **자체**다(EAS Update 미사용: 카드 없이 GitHub Releases 로
  간다는 ADR-022 의 근거가 그대로 유효하다). 갈리는 지점은 하나뿐이다: `expo-updates` 는 매니페스트
  응답에 `expo-protocol-version` 헤더를 요구하는데 **GitHub Releases 도 Pages 도 커스텀 헤더를 못 붙인다.**
- **두 층으로 가른다**. 매니페스트는 **Cloudflare Worker**(`workers/ota-manifest/`, 상태 없음),
  번들·에셋은 **GitHub Releases**(`live-update-rn`). `launchAsset.url` 이 GitHub 을 직접 가리켜
  **대역폭이 Worker 를 안 지나간다**(Worker 는 수 KB JSON 만 낸다).
- **OTA 대상 범위**: JS 번들과 에셋만. 네이티브 의존성·권한 변경은 여전히 스토어 심사 대상이고, 게임
  데이터 값 변경은 여전히 [[ADR-006]] 사용자 확인 대상이다.
- **`runtimeVersion` 정책은 `fingerprint`**. 네이티브 그래프에서 **계산된다.** @capgo 시절
  `minNativeVersion` 을 손으로 적던 자리이고, 안 올리면 앱이 죽는 종류의 사고라 사람이 기억할 일이
  아니다([[ADR-137]] 결정 3).
- **배포는 `node scripts/publish-rn-ota.mjs`.** `expo export` → 에셋 업로드(이름이 내용에서 나오므로
  **이미 있는 것은 건너뛴다**) → 매니페스트 생성·업로드 → **왕복 확인**. JS 만 고친 배포는 번들 2개만
  오른다(실측 확인).
- ⚠️ **순서 규칙: 네이티브를 건드렸으면 `expo prebuild` 를 먼저 끝내고 배포하라.** `runtimeVersion` 이
  fingerprint 라 **네이티브 트리의 함수**다. 배포 뒤에 트리가 바뀌면 매니페스트가 ‘아무도 안 묻는
  이름’으로 남고 앱은 204(업데이트 없음)를 받는다. 에러는 어디에서도 안 난다([[ADR-137]] 정정 2).
- **배포 성공의 정의는 ‘올렸다’가 아니라 ‘받아진다’다.** 스크립트 `[6/6]` 이 클라이언트가 묻는
  그대로 매니페스트를 물어보고 **번들을 내려받아 해시까지 대조**한다. 그 대조가 없어서
  *"배포 성공 · 매니페스트 정상 · 앱만 못 받음"* 을 한 번 겪었다([[ADR-137]] 정정 1).
- **‘스토어 업데이트 필요’만 우리 축에 남는다**. 런타임이 안 맞으면 프로토콜은 **204(업데이트 없음)**
  를 주고, 그대로 두면 사용자에게 *"최신 버전입니다"* 라는 **거짓**이 보인다. 그래서 확인이 ‘최신’으로
  떨어졌을 때만 Worker 의 `/latest` 를 한 번 더 묻는다([[ADR-137]] 결정 4).
- **우리 축의 값 넷은 매니페스트 `extra` 에 싣는다**. `appVersion`(사용자 표시 버전) ·
  `highlights`([[ADR-126]] 결정 2) · `sizeBytes` · `storeUrl`.
- **버전 형식은 세 자리다**(⛔ ADR-024 에서 살아남은 것). `1.0`(2단)은 `x.y.z` 파싱을 못 맞춰 OTA 가
  한 번도 작동하지 않았던 적이 있고, `native/live-update.ts` 의 파서가 지금도 그 형식을 강제한다.

## 지금 발행하려면 무엇이 필요한가 (2026-08-31 기준)

**OTA 발행은 막혀 있지 않다.** 다만 준비물이 있고, 못 나가는 것이 따로 있다.

| 무엇을 바꿨나 | OTA 로 나가나 |
|---|---|
| JS 코드, 에셋 이미지, 게임 데이터 JSON | 나간다 |
| `AndroidManifest.xml`, `Info.plist`, `app.json` 의 네이티브 설정, 네이티브 의존성, 권한 | **못 나간다.** 스토어 바이너리가 필요하다 |

네이티브 쪽이 못 나가는 것은 정책이 아니다. OTA 가 갈아끼우는 것이 JS 번들과 에셋뿐이고, 네이티브
설정 파일은 번들에 안 들어간다.

### 발행할 때마다 에셋 이름표를 줘야 한다

지금은 지문을 못박아 발행하는 상태다([[ADR-190]]). 그동안은 발행마다 실기기에서 뽑은 에셋
이름표를 함께 줘야 하고, 안 주면 스크립트가 중단된다([[ADR-191]] 결정 3).

```bash
OTA_LEGACY_ASSET_MAP=<APK 이름표.json> OTA_ASSET_REPORT=<리포트.jsonl> \
  node scripts/publish-rn-ota.mjs
```

이름표는 기기 logcat 의 `embeddedAssetFileMap` 에서 뽑는다([../foundation/release.md](../foundation/release.md)
규칙 6). 이 가드가 있는 이유는 1.0.7 이 지문만 맞추고 나갔다가 앱 이미지 273개를 빈칸으로 만든
사고 때문이다.

### 트리 지문이 달라져도 발행은 안 막힌다

`.gitignore` 나 `app.json` 처럼 지문 재료를 건드리면 트리 계산값이 달라진다. 그래도 지금은 발행에
영향이 없다. **못박은 값이 트리 계산값을 이기기 때문이다**(`resolveRuntimeVersions`). 트리 계산값이
다시 중요해지는 것은 다음 스토어 바이너리를 굽고 못박은 값을 비운 뒤부터다.

### 못박은 값이 1.0.6 인데 앱은 1.0.7 인 이유

**1.0.7 은 스토어 바이너리가 아니라 OTA 다.** 사용자 기기에 깔린 바이너리는 여전히 1.0.6 이고
(`android/app/build.gradle` 의 `versionName "1.0.6"`, `ios/app/Info.plist` 의 1.0.6 build 13),
1.0.7 은 그 위에 얹힌 JS 번들이다.

그래서 `PINNED_RUNTIME_VERSIONS` 의 두 필드는 서로 다른 것을 말한다.

| 필드 | 뜻 | 지금 값 |
|---|---|---|
| `binaryAppVersion` | 이 지문이 어느 바이너리에서 나온 값인가 | 1.0.6 |
| 매니페스트의 `appVersion` | 사용자에게 보이는 버전 | 1.0.7 |

OTA 를 낼수록 둘은 계속 벌어진다. 1.0.8 을 OTA 로 내도 `binaryAppVersion` 은 다음 스토어
바이너리가 나올 때까지 1.0.6 이다. **이 값이 스탈해 보여도 고치면 안 된다.** 못박은 값과 지금
발행된 판정값이 어긋나면 스토어 사용자에게 거짓 모달이 뜨고, `describePinMismatch` 가 그것을
발행 시점에 막는다.

## 사용자 동의형 UX (⛔ ADR-027 결정 1·4·7: 살아남은 부분)

프로토콜은 바뀌었지만 **UX 결정은 그대로 산다**. `features/live-update/store.ts` 와
`UpdatePromptModal` 이 지금도 이 흐름을 그린다.

- **부팅은 "체크만" 한다**(결정 1). 자동 다운로드·자동 적용이 없다.
- **적용은 사용자 동의로만**(결정 4). 새 버전이 있으면 모달(버전 + 용량)을 띄우고, 거절하면 현 버전을
  유지한다. 매번 묻는다.
- **‘스토어 업데이트 필요’ 구분**(결정 7). 위 [[ADR-137]] 결정 4 의 `/latest` 재확인이 그 판정을 잇는다.
- ⚠️ **셀룰러 경고는 RN 에서 무력이다**(결정 6). 네트워크 종류를 묻는 내장 API 가 없고
  `@react-native-community/netinfo` 는 새 네이티브 의존성이라 재빌드를 부른다. 어댑터가 `'unknown'` 을
  돌려 호출부의 기존 폴백(경고 생략)으로 떨어진다. `confirm-cellular` 분기는 코드에 살아 있지만
  **도달하지 않는다.** 되살리려면 그 패키지가 선행 조건이다.

**다운로드 실패 표시**([[ADR-065]] 결정 2): `MODAL_STATUSES` 에 `'error'` 가 없어 모달이 소리 없이
닫히던 것을 고쳤다. 배지 톤만 error 이고 `다시 시도` / `나중에` 를 준다. **매니페스트 조회 실패(자동
확인)는 모달을 띄우지 않는다**. 사용자가 시작하지 않은 실패라 조용히 넘긴다.

## 관찰용 UI ([[ADR-026]])

설정 화면의 **‘앱 업데이트’ 섹션**(`app/settings/AppUpdateSection.tsx`). 현재 실행 번들 버전 + 상태 +
수동 ‘업데이트 확인’ + 준비되면 ‘지금 적용(재시작)’. 부팅 백그라운드 체크를 스토어의 `checkOnBoot`
으로 경유시켜 부팅 발견분이 섹션에 즉시 반영되고 수동 체크와 한 소스로 일원화된다(이중 다운로드 없음).

## 적용 경로의 복구 장치 (⛔ [[ADR-117]]: 대부분 살아 있다)

적용(`지금 적용 (재시작)`)은 **되돌아올 수 있어야 한다**. 테스터가 이 버튼을 누른 뒤 스플래시에서 무한
로딩에 갇혔고(이슈 #175), 원인은 적용 확률이 아니라 **적용 경로가 일방통행이라는 형태**였다.

- **순서는 `closeBossProfitDb()` → 커버 → 적용**이다(결정 1). 이 순서는 core 의 `applyLiveUpdate` 한
  함수가 통째로 소유한다. RN 에서 ‘커버’는 **no-op** 이지만(웹뷰 리로드가 없어 덮을 구간이 없다.
  [splash.md](./splash.md)) 순서와 소유는 그대로 두었다.
- **전체에 12초 타임아웃 + catch**(`APPLY_TIMEOUT_MS`). 어느 고리가 끊겨도 커버를 걷고 `'apply-error'`
  로 전환한다. 성공 경로에서는 `Updates.reloadAsync()` 가 그 자리에서 JS 컨텍스트를 파괴하므로 이
  타임아웃에 도달할 수 없다. **성공 경로에 상태 전환 코드가 없는** 이유도 같다(쓰면 거짓 정보다).
- **`'applying'`**(결정 7)은 닫기가 도는 구간에 정직한 피드백을 주고 **중복 탭을 막는다**(재진입 가드가
  `set({status:'applying'})` 을 어떤 `await` 보다 앞에 둔다. 그 사이에 두 번째 탭이 끼면 가드가
  무의미해진다). 버튼이 하나도 없고(진행률이 아니라 **스윕 스피너**. 적용은 퍼센트가 나오지 않아
  결정형 진행률이 거짓이 된다, [[ADR-061]] 결정 1) 배경 탭도 막는다.
- **`'apply-error'` 는 받아둔 번들을 유지한다**. `download-error` 와 갈리는 지점이 이것이라
  `다시 시도` 는 **다시 받지 않고 `apply()` 만** 재호출한다.
- **`notifyAppReady()` 가 없다**(결정 2 의 후신). `expo-updates` 에는 그 신호를 받는 JS API 가 없고
  네이티브 `ErrorRecovery` 가 부팅 크래시를 직접 관찰해 되돌린다. 결정 2 가 지키려던 것은 살아 있고
  **그것을 선언하는 주체가 런타임으로 옮겨 갔다.**

## 매니페스트의 릴리스 노트 ([[ADR-119]] · [[ADR-126]])

매니페스트 `extra` 에 **`highlights: string[]`** 이 실린다. 동의 모달이 *"새 버전 v1.0.3 (2.1MB)"* 까지만
말하고 **무엇이 바뀌는지는 말하지 않던** 자리를 채운다. 실리는 것은 **전체 노트가 아니라 핵심 목록
3~4줄**이다([[ADR-126]] 결정 2).

- **값의 출처는 `src/data/release-notes.ts`** 다. 배포 스크립트가 `package.json` version 과 같은 버전의
  `highlights` 를 뽑아 싣는다. 노트를 손으로 매니페스트에 적지 않는다. 같은 파일을 개발 노트 화면
  (`/settings/release-notes`, [settings.md](./settings.md))이 **과거 전체**로 읽는다(원천 하나 + 소비 둘).
- **핵심 목록은 항목에서 파생하지 않고 손으로 쓴다**([[ADR-126]] 결정 3). "핵심"은 데이터가 아니라
  판단이고, `일부 버그 및 사용성 개선` 처럼 **여러 항목을 한 줄로 뭉치는 것**은 어떤 파생 규칙으로도
  안 나온다.
- **선택 필드다**. 필수 검사에 넣지 않는다. 넣으면 이미 발행된 옛 매니페스트가 `null` 로 떨어져 기존
  설치본의 업데이트 확인이 전부 실패한다.
- **네이티브 변경 항목의 ‘스토어 업데이트 필요’ 표식은 개발 노트 화면에만 남는다**(항목 단위:
  [[ADR-119]] 결정 3 은 그대로다).
- **노트·핵심 목록이 없으면 배포가 중단된다**([[ADR-119]] 결정 6 → [[ADR-126]] 결정 8). 절차는
  [../foundation/release.md](../foundation/release.md).

## 모달의 ‘자세히 보기’ ([[ADR-126]])

같은 이름의 버튼이 **두 자리에 있고 하는 일이 다르다.** 갈리는 근거는 하나: 모달이 뜨는 시점마다
앱이 가진 것이 다르다.

| 시점 | 새 버전 노트가 앱 안에 있나 | ‘자세히 보기’ |
|---|---|---|
| `update-available`(받기 전) | **없다**. 아직 안 받은 번들 안에 있다 | **모달 안에서 펼친다**(매니페스트 `highlights`) |
| 적용·재시작 후(`updated`) | **있다**. 지금 도는 번들이 그 번들이다 | **`/settings/release-notes` 로 이동** |

- **받기 전에 화면을 옮기지 않는 이유**: 모달을 닫아야 하고 돌아왔을 때 다시 띄우는 처리가 필요한데,
  정작 그 화면에는 새 버전이 **없다**. 판단 재료를 주려다 판단하던 흐름을 끊는다.
- **`store-required`·`ready-to-apply` 에는 붙이지 않는다**([[ADR-126]] 결정 7).
- **`'updated'` 상태**는 부팅 때 판정한다. `storage/last-run-bundle-version.ts` 에 적어 둔 **마지막으로
  실행된 번들 버전**과 지금 도는 버전을 비교한다. 저장값이 **없으면 안 띄우고**(근거 없이 "업데이트했다"고
  말하지 않는다) 판정이 `isNewerVersion` 이라 **자동 롤백이 걸러진다**.
- **판정은 확인보다 앞이고 전환은 확인보다 뒤다**. 새 업데이트가 또 있으면 **그쪽이 이긴다**(회고보다
  행동이 먼저다). 밀린 완료 안내는 다시 오지 않는다.
- **키는 `KEEP_KEYS` 에 넣지 않는다**([[ADR-052]]). 없어져서 생기는 것은 거짓 안내가 아니라 안내 없음이다.

## SQLite 커넥션 주의

리로드 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션으로 과거 데이터 로드가 멈춘다 →
`closeBossProfitDb()` 로 미리 닫는다([boss-profit.md](./boss-profit.md)).

**닫기에는 5초 타임아웃이 있다**(⛔ [[ADR-117]] 결정 5, 지금도 `storage/sqlite/db.ts` 가 건다). 여는 쪽
`withOpenTimeout`(10초)과 대칭이되 더 짧다. 닫기는 파일 생성·마이그레이션이 없어 정상이면 수 ms 이고,
이 값이 곧 적용 경로에서 사용자가 무반응을 견디는 상한이다(`'applying'` 구간의 길이). 실패·타임아웃은
**여전히 삼킨다**(best-effort). 곧 리로드될 것이고 `openBossProfitDb` 의 stale 감지가 최후 폴백으로
남는다. 타임아웃이 바꾸는 것은 *"실패로 끝난다"* 가 아니라 **"끝난다"** 이다. 같은 함수를 쓰는 캐시
데이터 삭제 경로도 이 타임아웃을 함께 받는다([[ADR-117]] 결정 8).

## 캐패시터 앱의 종료: 스토어 유도 ([[ADR-154]], 진행 중)

> 갱신이 끝난 앱이 부팅마다 **‘최신 버전입니다’** 라고 답하는 것은 거짓이고, 그 거짓이 사용자를 옛
> 앱에 붙잡아 둔다. 그래서 캐패시터 매니페스트가 ‘이 플랫폼은 이제 스토어로 가야 한다’를 직접 말한다.

- **`storeRequiredPlatforms?: string[]`**. 값은 `'android'`·`'ios'`. 판정은 포함 여부 하나다.
- **판정은 버전 비교보다 먼저 한다.** 그래야 ⓐ 갱신이 끝난 플랫폼에 `up-to-date` 를 안 돌려주고
  ⓑ **`manifest.version` 이 사용자 번들과 같아도 게이트가 켜진다.**
- **선택 필드다**. 필수 검사에 넣으면 옛 매니페스트를 읽는 기존 설치본이 전부 `check-error` 로 떨어진다.

| | 하는 일 | 사용자에게 보이는 것 | 조건 |
|---|---|---|---|
| **1단계** ✅ | `1.0.6.zip` **업로드만**. `latest.json` 손 안 댐 | 없음 | 없음 |
| **2단계** | 초안에 `storeRequiredPlatforms: ["android"]` | 유도 | Play 게시 확인 |
| **3단계** | `["android","ios"]` | 유도 | App Store 게시 확인 |

**`ota/latest.json` 이 그 발행의 유일한 재료다.** `url`·`checksum`·`size` 는 그 빌드에서만 나오는 값이라
캐패시터 소스가 사라진 지금은 재생성할 수 없다. 형식은 `ota/manifest-parser.ts`(1.0.6 번들 파서의 동결
사본)와 `ota/__tests__/latest.test.mjs` 가 지킨다. 2·3단계는
`gh release upload live-update-latest latest.json --clobber` 한 줄이고, 목록에서 플랫폼을 빼면
**되돌아간다**.

> **게시 확인은 조회로 한다**. 콘솔 상태나 심사 알림이 아니라
> `curl -o /dev/null -w '%{http_code}' 'https://play.google.com/store/apps/details?id=com.mapleroutine.app'`
> 와 `curl -s 'https://itunes.apple.com/lookup?id=6797579391' | ...`(`version` 필드).

**대가: 게이트를 켜는 순간의 유도는 OTA 한 홉 뒤다.** `storeRequiredPlatforms` 를 읽는 코드가 1.0.6
번들에 있으므로 1.0.5 에 있는 사람은 그 번들을 받아야 게이트에 들어온다. 홀드아웃은 방치되지 않는다.
부팅마다 `update-available` 모달을 받는다.

## 최초 1회 설정 (사용자 작업)

1. Cloudflare 가입(카드 불필요) → `cd workers/ota-manifest && npx wrangler deploy`
2. 배포된 주소(`https://maple-routine-ota.<서브도메인>.workers.dev`)를 `app.json` 의
   `expo.updates.url` 에 넣는다. **`/manifest` 경로까지** 포함해서.
3. `expo-updates` 는 네이티브 의존성이라 **재빌드가 필요하다**(`npx expo prebuild` → 스토어 릴리스).
   이 릴리스 자체는 OTA 로 못 나간다([[ADR-137]] 대가 2).

## 폐기된 정책 (history)

- ~~`@capgo/capacitor-updater` 플러그인 + 자체 매니페스트(`latest.json`) 프로토콜~~ → **`expo-updates` v1**(🗑 [[ADR-022]] →
[[ADR-137]]). 호스팅을 GitHub Releases 로 둔다는 판단만 그대로 남았다.
- ~~번들 호스팅 = Cloudflare R2~~ → GitHub Releases(카드 등록 불필요)(🗑 [[ADR-022]]).
- ~~네이티브 `versionName` = `1.0`(2단)~~ → `1.0.0`(3단)(🗑 [[ADR-024]]).
- ~~베타 채널(`live-update-beta`) · 빌드 시점 채널 분리 · `import.meta.env.VITE_LIVE_UPDATE_CHANNEL`~~ → **폐기**([[ADR-137]] 결정
7). 사이드로딩 베타를 위한 것이었고 App Store 출시(2026-08-06)로 용도가 끝났다. 그리고 그것이 core 의 `import.meta.env` 벽을 없앴다(Metro 에
`import.meta` 가 없다).
- ~~1.0.0 리셋과 production 채널 전환(2026-08-04)~~ → 캐패시터 채널의 사건이다. 현행 RN 채널은 `live-update-rn` 이고 버전은 `package.json` 을 따른다.
- ~~리로드 커버 스플래시(`SplashScreen.show()` · `androidScaleType: CENTER_CROP` · `#boot-cover`)~~ → RN 은 문서를 다시 로드하지 않아 덮을
구간이 없다. `SplashScreenPort.show()` 는 **no-op** 이다(🗑 [[ADR-027]] 정정 → [splash.md](./splash.md)).
- ~~`LiveUpdatePort` 가 프로토콜을 드러낸다(`httpGet` · `download({url, checksum})` · `applyBundle(id)`)~~ → **행위로 다시
그었다**(`check` · `download(onProgress)` · `apply`)([[ADR-137]] 결정 6).
- ~~조용한 자동 다운로드·적용~~ → 사용자 동의형(부팅은 체크만)(⛔ [[ADR-027]] 결정 1, 지금도 유효).
- ~~배포 = Play Console 내부 테스트 트랙~~ → APK 직접 사이드로딩(🗑 [[ADR-024]] 정정). 지금은 스토어 정식 배포다.
- ~~`notifyAppReady` 를 번들 실행 직후 첫 문장에서 호출~~ → **첫 렌더 커밋 뒤**(`AppShell` 마운트 effect)(🗑 [[ADR-022]] 결정 6 → ⛔
[[ADR-117]] 결정 2) → **RN 에는 그 API 자체가 없다**(네이티브 `ErrorRecovery`).
- ~~매니페스트 `notes?: string`(항목 전체를 이어 붙인 평문 한 덩어리)~~ → **`highlights: string[]`(핵심 목록 3~4줄)**([[ADR-119]] →
[[ADR-126]] 결정 2). 그 형식이 겨냥한 소비자가 업데이트 모달이었고, 그리는 방식이 정해지면서 형식도 함께 정해졌다.
- ~~`apply()` 는 커버를 먼저 씌우고 그 뒤에 적용~~ → **`closeBossProfitDb()` → 커버 → 적용**(⛔ [[ADR-117]] 결정 1, 지금도 유효).
- ~~적용 실패 시의 처리 없음(`void apply()`)~~ → **12초 타임아웃 + catch → `'apply-error'`**(⛔ [[ADR-117]] 결정 1, 지금도 유효).
- ~~셀룰러 데이터 경고(`@capacitor/network`)~~ → RN 에 짝이 없어 **도달하지 않는 분기**로 남았다(⛔ [[ADR-027]] 결정 6). 되살리려면
`@react-native-community/netinfo` 가 선행 조건이다.
