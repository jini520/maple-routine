# OTA 업데이트

스토어 심사 없이 JS 번들과 에셋을 바꿔 내보내는 기능이다. `expo-updates` 를 쓰고, v1.0.13 바이너리부터
매니페스트는 우리 서버(`/v1/ota/manifest` · `/v1/ota/latest`)가, 번들과 에셋은 같은 앱 박스의 nginx
(`/ota/files/`)가 내준다. 1.0.12 바이너리는 Cloudflare Worker 와 GitHub Releases `live-update-rn` 을 묻고, 그쪽에는
더 이상 발행하지 않는다([[ADR-011]] 결정 2). 앱은 켤 때 새 번들이 있는지 확인하고, 작은 번들은 묻지 않고 받은 뒤
적용할지를 사용자에게 묻는다.

왜 이렇게 만들었는지는 [[ADR-011]](프로토콜 · 발행 · 버전)과 [[ADR-012]](모달 · 적용)에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `native/ports.ts` 의 `LiveUpdatePort` | 확인 · 받기 · 적용 계약 |
| `native/adapters/rn-live-update.ts` | `expo-updates` 구현. `/latest` 로 스토어 업데이트 필요 판정, 표시 버전 결정 |
| `native/live-update.ts` | `isNewerVersion` · 적용 순서(`applyLiveUpdate`) |
| `features/live-update/store.ts` | 상태 열다섯 가지 · 확인 · 묻지 않고 받기 · 적용 · 완료 안내 판정 · 부팅 순서 |
| `features/live-update/use-running-app-version.ts` | 화면에 보이는 앱 버전 |
| `app/UpdatePromptModal.tsx` | 동의 모달. 잠금이 풀린 뒤는 `navigation/AppNavigation.tsx`, 잠긴 동안은 `app/AppShell.tsx` 의 `LockedUpdatePrompt` 가 띄운다 |
| `app/settings/AppUpdateSection.tsx` | `앱 정보` 화면의 현재 버전 · 상태 · `업데이트 확인` |
| `boot.ts` 의 `loadGameData` | 게임 데이터 사본을 읽은 뒤 `checkOnBoot()` 호출 |
| `app/BootSplash.tsx` · `hooks/useBootSplashDone.ts` | 처음 실행에서 OTA 를 적용하는 동안 스플래시를 붙들고, 다 걷힌 뒤에야 모달을 그리게 한다 |
| `lib/app-version.ts` | 버전 형식 읽기(`x.y.z` · `x.y.z+n`) · 화면 표기 `x.y.z(n)` |
| `storage/last-run-bundle-version.ts` | 마지막으로 실행한 번들 버전(Preferences `lastRunBundleVersion`). 완료 안내 판정에 쓴다 |
| `storage/sqlite/db.ts` 의 `closeBossProfitDb` | 적용 전에 SQLite 를 닫는다. 5초 타임아웃 |
| 서버 `modules/ota/` | 매니페스트와 `latest` 를 `/srv/maple-routine-ota` 에서 읽어 준다 |
| `scripts/ota-retention.mjs` | 발행 뒤 서버에 남길 파일 고르기(최근 세 번의 발행과 지금 매니페스트) |
| `workers/ota-manifest/` | 1.0.12 바이너리 전용 매니페스트 Worker(`/manifest` · `/latest`). 얼려 두었다 |
| `scripts/publish-rn-ota.mjs` | 발행 스크립트 |
| `scripts/ota-runtime-version.mjs` | `IN_REVIEW_RUNTIME_VERSIONS` · `PINNED_RUNTIME_VERSIONS` · 플랫폼 인자 해석 |
| `scripts/release-note-gap.mjs` | 노트가 없으면 발행을 막는 검사 |
| `app.json` 의 `runtimeVersion` · `updates` | `fingerprint` 정책 · 매니페스트 주소 · 자동 확인 끔(`checkAutomatically: NEVER`) |

## 앱이 하는 일

| 상태 | 언제 | 화면 |
|---|---|---|
| `checking` | 부팅하거나 `업데이트 확인` 을 눌렀을 때 | 카드 상태 줄 |
| `up-to-date` | 받을 것이 없고 지문도 맞을 때 | 카드 `최신 버전입니다` |
| `update-available` | 새 번들이 5MB 를 넘을 때 | 모달: 버전 배지 · 다운로드 크기 · `자세히 보기`(핵심 목록) · `다운로드` · `나중에` |
| `confirm-cellular` | 셀룰러에서 받으려 할 때 | 모달. 지금은 도달하지 않는다([[ADR-012]] 결정 5) |
| `downloading` | `다운로드` 를 누른 뒤 받는 중 | 모달: 진행률 막대. 배경을 눌러도 안 닫힌다 |
| `background-downloading` | 5MB 이하 번들을 묻지 않고 받는 중 | 카드 상태 줄만 |
| `ready-to-apply` | 다 받았을 때 | 모달: `지금 적용 (재시작)` · `나중에` |
| `applying` | 적용 중 | 모달: 스피너와 `적용하고 있어요`. 버튼 없음 |
| `store-required` | 기기 지문이 받아 주는 목록에 없을 때 | 닫을 수 없는 모달: `스토어로 이동` 하나 |
| `check-error` | 확인 실패 | 카드 상태 줄만 |
| `background-download-error` | 묻지 않고 받다가 실패 | 카드 상태 줄만. 다음에 켤 때 다시 받는다 |
| `download-error` | `다운로드` 를 누른 뒤 받기 실패 | 모달(배지 색 `error`): `다시 시도`(다시 받기) · `나중에` |
| `apply-error` | 적용 실패나 12초 초과 | 모달(배지 색 `error`): `다시 시도`(적용만 다시) · `나중에` |
| `unsupported` | 개발 서버처럼 런타임이 없을 때 | 카드 `이 플랫폼에서는 지원되지 않습니다` |

받는 크기는 매니페스트 `extra.sizeBytes` 이고, gzip 으로 압축한 번들의 크기다. 5MB(5,000,000 바이트) 이하면 묻지 않고
받는다([[ADR-012]] 결정 2).

`업데이트를 마쳤어요` 는 상태가 아니라 `justUpdated` 값으로 띄운다. 부팅 때 `lastRunBundleVersion` 과 지금 버전을
`isNewerVersion` 으로 비교해 정하고, 확인이 끝나기를 기다리지 않는다. 저장된 값이 없거나 버전이 내려갔으면(자동 롤백)
띄우지 않는다. 받아 둔 업데이트와 겹치면 완료 안내가 먼저고, 닫으면(`dismissUpdated`) 그 모달이 뜬다. 스토어 업데이트가
필요하면 그쪽이 이긴다. 이 판정과 `자세히 보기` 는 [[ADR-052]] 의 릴리스 노트 결정을 따른다.

모든 가운데 모달은 부팅 스플래시(`BootSplash`)가 다 걷힌 뒤에만 그린다(`useBootSplashDone`, [[ADR-062]] 결정 16).

### 부팅 순서

OTA 부팅 확인은 `boot.ts` 의 `loadGameData()` 가 게임 데이터 사본을 읽은 뒤 `checkOnBoot({ locked, firstRun })` 로
부른다([[ADR-012]] 결정 12).

| 켜진 상황 | 하는 일 |
|---|---|
| 사본이 있음 | 앱을 바로 열고, 확인은 따로 돈다 |
| 사본이 아예 없음(처음 실행) | `BootSplash` 를 붙든 채 확인한다. 새 번들이 있으면 크기와 상관없이 받아 바로 재시작하고, 재시작 뒤 완료 안내는 띄우지 않는다. 실패하거나 20초(`FIRST_RUN_HOLD_MS`)가 지나면 스플래시를 걷고 게임 데이터로 넘어간다 |
| 계약 판이 바뀌어 잠김 | 게임 데이터 받기가 확인을 기다린다(상한 5초, `BOOT_CHECK_WAIT_MS`). 새 번들이 있으면 먼저 받고 잠금 화면 위에서 적용을 묻는다(`LockedUpdatePrompt`). `나중에` 를 누르면 게임 데이터를 받는다 |

화면에 보이는 버전은 OTA 번들이면 매니페스트 `extra.appVersion`, 스토어 바이너리의 번들이면 바이너리
버전이다([[ADR-011]] 결정 10).

## OTA 로 나갈 수 있는 변경

| 바꾼 것 | OTA |
|---|---|
| JS 코드 · 에셋 이미지 · `src/data/` JSON | 나간다 |
| 네이티브 의존성 · 권한 · `AndroidManifest.xml` · `Info.plist` · `app.json` 의 네이티브 설정 | 나가지 않는다. 스토어 바이너리를 새로 빌드한다 |
| `package.json` 의 `version` | 지문이 안 바뀐다. OTA 버전은 여기서 올린다 |
| `package.json` 의 `scripts` · `app.json` 의 어떤 값이든 | 지문이 바뀐다. 스토어 바이너리가 그 번들을 받지 못한다 |

## OTA 발행 절차

### 준비

1. `ssh ubuntu@158.179.175.230` 이 비밀번호 없이 열려야 한다. 스크립트가 rsync 로 `/srv/maple-routine-ota` 에 올린다.
   디렉터리가 없으면 서버 README 의 OTA 절대로 만든다.
2. `package.json` 의 `version` 을 올린다. 새 버전이면 `x.y.z`, 같은 버전의 버그 수정이면 `x.y.z+n`
   (`n` 은 1 부터)이다. `app.json` 의 `expo.version` 은 건드리지 않는다. 그 값은 스토어 버전이고 지문
   재료다.
3. `src/data/release-notes.ts` 에 노트를 쓴다. 기본 버전(`1.0.12+5` 면 `1.0.12`)의 노트에 `items` 와
   `highlights` 가 둘 다 있어야 한다. 패치면 기본 버전 노트의 `items` 에 이어 붙이고, 모달에 보일
   내용이 바뀌면 `highlights` 도 고친다.
4. 스토어 바이너리를 빌드한 트리에서, 그 바이너리를 스토어에 올린 뒤에 발행한다. 발행할 트리의 지문이
   스토어 바이너리의 지문과 같은지 확인한다. 다르면 번들이 가지 않을 뿐 아니라,
   `latest-<platform>.json` 이 새 지문으로 덮여 그 스토어의 사용자 모두가 닫을 수 없는 스토어 업데이트
   모달에 막힌다.

   ```bash
   npx expo-updates runtimeversion:resolve --platform ios
   npx expo-updates runtimeversion:resolve --platform android
   ```

   비교할 값은 스토어 바이너리 안의 `EXUpdates.bundle/fingerprint`(iOS 아카이브)와
   `base/assets/fingerprint`(AAB)다. 지금 발행돼 있는 값은 아래로도 볼 수 있다.

   ```bash
   curl -s "https://mapleroutine.store/v1/ota/latest?platform=ios&t=$(date +%s)"
   ```

5. 워크트리에서 발행한다면 git 이 무시하는 다음 파일을 원래 체크아웃에서 복사한다. 모두 지문 재료라서
   빠지면 코드가 같아도 지문이 달라진다.

   | 파일 | 바뀌는 지문 |
   |---|---|
   | `.env` | 둘 다. `app.config.js` 가 읽는다 |
   | `android/keystore.properties` | android |
   | `ios/.xcode.env.local` | ios |
   | `ios/app.xcodeproj/project.xcworkspace/` | ios |

   옛 커밋으로 워크트리를 만들어 `npm ci` 로 node_modules 를 새로 깔았다면
   `node_modules/@react-native-masked-view/masked-view/android/src/main/AndroidManifest.xml` 도 원래 체크아웃에서
   복사한다. 새로 깐 파일에는 `package` 속성이 있고 원래 체크아웃의 파일에는 없다. 스토어 바이너리는 속성이 없는
   쪽으로 빌드됐고, 이 파일 하나로 두 지문이 함께 바뀐다(1.0.12+6 에서 확인).

6. 스토어 심사 중인 바이너리가 있으면 그 지문을 `IN_REVIEW_RUNTIME_VERSIONS` 에 넣어 둔다
   ([[ADR-011]] 결정 6). 넣지 않고 발행하면 심사 담당자의 앱이 잠긴다.
7. `PINNED_RUNTIME_VERSIONS` 는 비어 있어야 한다. 값이 있으면 스크립트가 멈춘다([[ADR-011]] 결정 7).

### 실행

```bash
node scripts/publish-rn-ota.mjs                    # 두 플랫폼
node scripts/publish-rn-ota.mjs --platform ios     # 한 플랫폼만. --platform=android 도 된다
```

`--platform` 을 주면 빌드, 지문 계산, 매니페스트와 `latest-<platform>.json` 쓰기, 왕복 확인이 모두 그
플랫폼에만 적용된다. 두 스토어의 바이너리가 따로 게시될 때 쓴다. 모르는 값을 주면 바로 멈춘다.

스크립트가 하는 일은 이 순서다.

| 단계 | 하는 일 | 멈추는 경우 |
|---|---|---|
| 빌드 전 | `package.json` 버전 형식 확인, 노트 확인, 고정한 지문 확인 | 형식이 틀림 · 노트나 `highlights` 가 없음 · `PINNED_RUNTIME_VERSIONS` 에 값이 있음 |
| `[1/5]` | `npx expo export --platform … --output-dir dist` | |
| `[2/5]` | `npx expo-updates runtimeversion:resolve` 로 플랫폼별 지문 계산 | 지문이 파일 이름으로 쓸 수 없는 값임 |
| `[3/5]` | 서버 `files/` 에 이미 있는 파일 이름 조회 | 디렉터리를 읽지 못함 |
| `[4/5]` | 없는 파일만 올린다. 번들은 `bundle-<platform>-<sha256>.hbc` 이름으로, gzip 압축본은 그 뒤에 `.gz` 를 붙여 올린다 | |
| `[5/5]` | `manifest-<platform>-<지문>.json` 과 `latest-<platform>.json` 을 덮어 올린다. 이어서 `releases.json` 에 이번 발행을 적고, 최근 세 번의 발행과 지금 매니페스트가 쓰지 않는 파일을 지운다 | |
| `[6/6]` | 기기와 같은 헤더로 매니페스트를 요청하고, 번들을 서버에서 내려받아 푼 내용의 해시를 비교한다 | `appVersion` 이 안 맞음 · 응답이 200 이 아님 · 번들이 gzip 으로 오지 않음 · 번들 해시가 다름 |

마지막 줄에 `완료: <버전> 배포됨 (ios=… android=…)` 이 찍히면 끝이다.

### 발행 뒤

- 실기기에서 업데이트를 받고 그림이 제대로 나오는지 본다. 정적 검사를 다 통과했는데 안드로이드
  이미지가 모두 빈칸으로 나온 적이 있다([[ADR-011]] 결정 7).
- `[6/6]` 에서 멈췄고 메시지가 지문을 가리키면, 발행 도중이나 뒤에 `android/` · `ios/` · `app.json` 이
  바뀌지 않았는지 본다. 네이티브를 바꾼 것이라면 그 변경은 OTA 로 나가지 않는다. 스토어 바이너리를 새로
  빌드해야 한다.
- 스토어 심사에서 반려돼 네이티브를 고쳐 다시 빌드했다면 지문이 바뀐다. 새 바이너리를 빌드한 트리에서 다시
  발행하고, `IN_REVIEW_RUNTIME_VERSIONS` 의 값도 새 지문으로 바꾼다.
- 서버에는 최근 세 번의 발행이 쓰는 파일만 남는다. 그보다 옛 번들로 되돌리려면 그 커밋에서 다시 발행한다.

### 스토어 게시 뒤 옛 바이너리 잠그기

1. 새 바이너리를 심사에 올릴 때 그 지문을 `IN_REVIEW_RUNTIME_VERSIONS` 에 넣고 커밋한다.
2. 게시를 조회로 확인한다(iTunes Lookup `country=kr` 의 `version` · Play 상세 페이지의 버전).
3. 그 플랫폼의 값을 비우고 커밋한 뒤 OTA 를 한 번 발행한다. 이 발행이 `latest-<platform>.json` 의
   목록에서 옛 지문을 빼고, 그때부터 옛 바이너리가 잠긴다.

잠그기 전에 잠금 코드가 들어 있는 번들을 실기기에서 확인한다. 옛 지문을 뺀 뒤에는 발행 스크립트로 그
바이너리를 고칠 수 없다.

## 서버와 Worker

| 경로 | 내주는 곳 | 응답 |
|---|---|---|
| `GET /v1/ota/manifest` | 서버 | 요청 헤더 `expo-platform` · `expo-runtime-version` 에 맞는 `manifest-<platform>-<지문>.json` 에 `expo-protocol-version: 1` 을 붙여 준다. 없거나 헤더 값이 이상하면 204 |
| `GET /v1/ota/latest?platform=` | 서버 | `latest-<platform>.json`. 아직 없으면 `{ "runtimeVersion": null, "appVersion": null }` |
| `GET /ota/files/<이름>` | nginx | 번들과 에셋. 번들은 `gzip_static` 이 옆의 `.gz` 를 `content-encoding: gzip` 으로 내준다 |

`workers/ota-manifest/` 는 1.0.12 바이너리만 묻는다. 같은 두 경로(`/manifest` · `/latest`)를 GitHub Releases
`live-update-rn` 에서 읽어 준다. 발행 스크립트는 더 이상 그쪽에 쓰지 않는다. 1.0.12 를 잠그는 손 절차와 Worker ·
릴리스를 걷는 일은 이슈 #810 에 있다.

매니페스트 주소(`app.json` 의 `expo.updates.url`)는 네이티브 설정이라, 바꾸면 스토어 바이너리를 새로 빌드해야 한다.
`ios/app/Supporting/Expo.plist` 의 `EXUpdatesURL` 과 `AndroidManifest.xml` 의 `EXPO_UPDATE_URL` 도 같은 값이어야 한다.
