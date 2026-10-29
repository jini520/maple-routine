# OTA 업데이트

스토어 심사 없이 JS 번들과 에셋을 바꿔 내보내는 기능이다. `expo-updates` 를 쓰고, 매니페스트는
Cloudflare Worker 가, 번들과 에셋은 GitHub Releases `live-update-rn` 이 내준다. 앱은 켤 때 새 번들이
있는지 확인하고, 받을지와 적용할지를 사용자에게 묻는다.

왜 이렇게 만들었는지는 [[ADR-011]](프로토콜 · 발행 · 버전)과 [[ADR-012]](모달 · 적용)에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `native/ports.ts` 의 `LiveUpdatePort` | 확인 · 받기 · 적용 계약 |
| `native/adapters/rn-live-update.ts` | `expo-updates` 구현. `/latest` 로 스토어 업데이트 필요 판정, 표시 버전 결정 |
| `native/live-update.ts` | `isNewerVersion` · 적용 순서(`applyLiveUpdate`) |
| `features/live-update/store.ts` | 상태 열네 가지 · 확인 · 받기 · 적용 · 완료 안내 판정 |
| `features/live-update/use-running-app-version.ts` | 화면에 보이는 앱 버전 |
| `app/UpdatePromptModal.tsx` | 동의 모달. `navigation/AppNavigation.tsx` 가 띄운다 |
| `app/settings/AppUpdateSection.tsx` | `앱 정보` 화면의 현재 버전 · 상태 · `업데이트 확인` |
| `app/AppShell.tsx` | 부팅 때 `checkOnBoot()` 호출 |
| `lib/app-version.ts` | 버전 형식 읽기(`x.y.z` · `x.y.z+n`) · 화면 표기 `x.y.z(n)` |
| `storage/last-run-bundle-version.ts` | 마지막으로 실행한 번들 버전(Preferences `lastRunBundleVersion`). 완료 안내 판정에 쓴다 |
| `storage/sqlite/db.ts` 의 `closeBossProfitDb` | 적용 전에 SQLite 를 닫는다. 5초 타임아웃 |
| `workers/ota-manifest/` | 매니페스트 Worker(`/manifest` · `/latest`) |
| `scripts/publish-rn-ota.mjs` | 발행 스크립트 |
| `scripts/ota-runtime-version.mjs` | `IN_REVIEW_RUNTIME_VERSIONS` · `PINNED_RUNTIME_VERSIONS` · 플랫폼 인자 해석 |
| `scripts/release-note-gap.mjs` | 노트가 없으면 발행을 막는 검사 |
| `app.json` 의 `runtimeVersion` · `updates` | `fingerprint` 정책 · 매니페스트 주소 · 자동 확인 끔(`checkAutomatically: NEVER`) |

## 앱이 하는 일

| 상태 | 언제 | 화면 |
|---|---|---|
| `checking` | 부팅하거나 `업데이트 확인` 을 눌렀을 때 | 카드 상태 줄 |
| `up-to-date` | 받을 것이 없고 지문도 맞을 때 | 카드 `최신 버전입니다` |
| `update-available` | 새 번들이 있을 때 | 모달: 버전 배지 · 다운로드 크기 · `자세히 보기`(핵심 목록) · `다운로드` · `나중에` |
| `confirm-cellular` | 셀룰러에서 받으려 할 때 | 모달. 지금은 도달하지 않는다([[ADR-012]] 결정 5) |
| `downloading` | 받는 중 | 모달: 진행률 막대. 배경을 눌러도 안 닫힌다 |
| `ready-to-apply` | 다 받았을 때 | 모달: `지금 적용 (재시작)` · `나중에` |
| `applying` | 적용 중 | 모달: 스피너와 `적용하고 있어요`. 버튼 없음 |
| `updated` | 재시작 뒤 부팅에서 버전이 올라간 것을 알았을 때 | 모달: `업데이트를 마쳤어요` · `확인` · `자세히 보기`(개발 노트로 이동) |
| `store-required` | 기기 지문이 받아 주는 목록에 없을 때 | 닫을 수 없는 모달: `스토어로 이동` 하나 |
| `check-error` | 확인 실패 | 카드 상태 줄만 |
| `download-error` | 받기 실패 | 모달(배지 색 `error`): `다시 시도`(다시 받기) · `나중에` |
| `apply-error` | 적용 실패나 12초 초과 | 모달(배지 색 `error`): `다시 시도`(적용만 다시) · `나중에` |
| `unsupported` | 개발 서버처럼 런타임이 없을 때 | 카드 `이 플랫폼에서는 지원되지 않습니다` |

`updated` 는 부팅 때 `lastRunBundleVersion` 과 지금 버전을 `isNewerVersion` 으로 비교해 정한다. 저장된
값이 없으면 띄우지 않고, 버전이 내려갔으면(자동 롤백) 띄우지 않는다. 새 번들이 또 있으면
`update-available` 이 먼저다. 이 판정과 `자세히 보기` 는 [[ADR-052]] 의 릴리스 노트 결정을 따른다.

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

1. `gh` 가 `jini520/maple-routine` 에 릴리스를 올릴 수 있는 계정으로 로그인돼 있어야 한다.
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
   curl -s "https://maple-routine-ota.dev-jinni520.workers.dev/latest?platform=ios&t=$(date +%s)"
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
| `[3/5]` | 릴리스 `live-update-rn` 에 이미 있는 파일 이름 조회. 릴리스가 없으면 만든다 | |
| `[4/5]` | 없는 파일만 올린다. 번들은 `bundle-<platform>-<sha256>.hbc` 이름으로 | |
| `[5/5]` | `manifest-<platform>-<지문>.json` 과 `latest-<platform>.json` 을 덮어 올린다 | |
| `[6/6]` | 기기와 같은 헤더로 매니페스트를 요청하고, 번들을 내려받아 해시를 비교한다 | `appVersion` 이 안 맞음 · 응답이 200 이 아님 · 번들 해시가 다름 |

마지막 줄에 `완료: <버전> 배포됨 (ios=… android=…)` 이 찍히면 끝이다.

### 발행 뒤

- 실기기에서 업데이트를 받고 그림이 제대로 나오는지 본다. 정적 검사를 다 통과했는데 안드로이드
  이미지가 모두 빈칸으로 나온 적이 있다([[ADR-011]] 결정 7).
- `[6/6]` 에서 멈췄고 메시지가 지문을 가리키면, 발행 도중이나 뒤에 `android/` · `ios/` · `app.json` 이
  바뀌지 않았는지 본다. 네이티브를 바꾼 것이라면 그 변경은 OTA 로 나가지 않는다. 스토어 바이너리를 새로
  빌드해야 한다.
- 스토어 심사에서 반려돼 네이티브를 고쳐 다시 빌드했다면 지문이 바뀐다. 새 바이너리를 빌드한 트리에서 다시
  발행하고, `IN_REVIEW_RUNTIME_VERSIONS` 의 값도 새 지문으로 바꾼다.
- 릴리스에는 이전 번들이 지워지지 않고 쌓인다. 매니페스트만 같은 이름으로 덮어쓰기 때문이다. 지우는
  코드는 없다.

### 스토어 게시 뒤 옛 바이너리 잠그기

1. 새 바이너리를 심사에 올릴 때 그 지문을 `IN_REVIEW_RUNTIME_VERSIONS` 에 넣고 커밋한다.
2. 게시를 조회로 확인한다(iTunes Lookup `country=kr` 의 `version` · Play 상세 페이지의 버전).
3. 그 플랫폼의 값을 비우고 커밋한 뒤 OTA 를 한 번 발행한다. 이 발행이 `latest-<platform>.json` 의
   목록에서 옛 지문을 빼고, 그때부터 옛 바이너리가 잠긴다.

잠그기 전에 잠금 코드가 들어 있는 번들을 실기기에서 확인한다. 옛 지문을 뺀 뒤에는 발행 스크립트로 그
바이너리를 고칠 수 없다.

## Worker

`workers/ota-manifest/` 는 한 번 배포한 뒤로 손대지 않는다. 바인딩이 없고 상태도 없다.

| 경로 | 응답 |
|---|---|
| `GET /manifest` | 요청 헤더 `expo-platform` · `expo-runtime-version` 에 맞는 `manifest-<platform>-<지문>.json` 에 `expo-protocol-version: 1` 을 붙여 준다. 없거나 헤더 값이 이상하면 204 |
| `GET /latest?platform=` | `latest-<platform>.json`. 아직 없으면 `{ "runtimeVersion": null, "appVersion": null }` |

다시 배포해야 하면 `workers/ota-manifest` 에서 `npx wrangler deploy` 를 한다. 주소를 바꾸면 `app.json` 의
`expo.updates.url` 도 바꿔야 하는데, 이것은 네이티브 설정이라 스토어 바이너리를 새로 빌드해야 한다.
