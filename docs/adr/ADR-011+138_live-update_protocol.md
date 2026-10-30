# ADR-011+138 OTA 발행과 프로토콜

> 🟢 유효
> 옛 번호: ADR-022 결정 6 · ADR-024 · ADR-137 · ADR-190 · ADR-191 결정 1 · ADR-268 결정 2 · 3 · 4 · ADR-279 · ADR-292
> 관련 소스: `native/live-update.ts` · `native/adapters/rn-live-update.ts` · `lib/app-version.ts` · `features/live-update/use-running-app-version.ts` · `scripts/publish-rn-ota.mjs` · 서버 `modules/ota/` · `workers/ota-manifest/`(1.0.12 바이너리 전용) · `scripts/ota-runtime-version.mjs` · `scripts/release-note-gap.mjs`

## 배경

스토어 심사를 거치지 않고 JS 번들과 에셋만 바꿔 내보내려고 `expo-updates` 를 쓴다. 바뀌는 것은 JS 와
이미지뿐이다. 네이티브 의존성, 권한, `app.json` 의 네이티브 설정을 바꿨다면 스토어 바이너리를 새로
빌드해야 한다.

`expo-updates` 는 버전 번호가 아니라 `runtimeVersion` 으로 번들을 고른다. 이 값은 네이티브 트리에서
계산한 지문이고, 빌드할 때 바이너리 안에 들어간다. 발행 스크립트는 발행하는 순간의 트리에서 이 값을
다시 계산한다. 두 값이 다르면 기기는 번들을 받지 못한다. 그런데 이때 어디에서도 오류가 나지 않는다.
이 문서의 결정은 대부분 이 문제를 드러내고 막기 위한 것이다.

## 결정

### 결정 1. 1.0.13 부터 매니페스트 · 번들 · 에셋은 우리 서버가 내준다 (사용자 지정 2026-10-30)

앱 박스(`mapleroutine.store`)가 전부 내준다. 게임 데이터 그림을 앱 박스 디스크에 두고 nginx 가 내주는 것과 같은 이유다
([[ADR-020]] 결정 8). 앱 박스는 API 와 같은 곳이라 장애가 날 곳이 늘지 않는다. GitHub Releases 와 Cloudflare Worker 를
쓰던 때는 그 둘이 장애 지점으로 하나씩 더 있었다.

| 경로 | 내주는 곳 | 하는 일 |
|---|---|---|
| `GET /v1/ota/manifest` | 서버 `modules/ota/` | 요청 헤더의 플랫폼과 `runtimeVersion` 으로 `manifest-<platform>-<runtimeVersion>.json` 을 읽어 `expo-protocol-version: 1` 을 붙여 준다. 파일이 없거나 헤더 값이 이상하면 204 다. 프로토콜에서 204 는 업데이트가 없다는 뜻이다 |
| `GET /v1/ota/latest?platform=` | 서버 `modules/ota/` | `latest-<platform>.json`. 아직 없으면 `{ "runtimeVersion": null, "appVersion": null }` |
| `GET /ota/files/<이름>` | nginx | 번들과 에셋. 이름이 내용 해시라 `immutable` 로 오래 캐시한다 |

매니페스트를 서버 코드가 내주는 것은 요청 헤더 값을 파일 이름에 넣기 때문이다. 경로 조작을 막는 검사를 테스트로 지킬 수
있다. 파일은 앱 박스의 `/srv/maple-routine-ota` 에 있고, 서버 컨테이너는 읽기 전용으로 건다. 서버는 매니페스트를 만들지
않는다. 만드는 일은 발행 스크립트가 하고, 서버는 읽기만 한다. DB 에 넣지 않은 것은 발행이 파일 올리기와 DB 쓰기 두 단계로
나뉘면 하나만 성공했을 때 어느 쪽이 맞는지 알 수 없어서다.

매니페스트와 `latest-<platform>.json` 은 이름은 그대로인데 내용만 바뀌는 파일이라 캐시하지 않는다(`cache-control:
private, max-age=0`).

EAS Update 는 쓰지 않았다. 매니페스트와 번들을 외부 서비스에 맡기지 않기 위해서다. 채널은 하나다. 어댑터의 `getChannel` 은
`Updates.channel` 을 읽고, 값이 없으면 `production` 을 쓴다.

매니페스트 주소(`app.json` 의 `updates.url`)는 네이티브 설정이라 스토어 바이너리에 박힌다. 그래서 서버로 옮긴 것은
v1.0.13 바이너리부터다.

### 결정 2. 1.0.12 바이너리는 GitHub Releases 와 Worker 에 얼려 둔다 (사용자 지정 2026-10-30)

1.0.12 바이너리에는 더 이상 OTA 를 내지 않는다. 그 바이너리는 `workers/ota-manifest/` 주소를 묻고, Worker 는 릴리스
`live-update-rn` 의 파일을 읽어 준다. 지금 올라가 있는 매니페스트를 그대로 둔다.

남는 일은 v1.0.13 을 게시한 뒤 1.0.12 를 잠그는 것 하나다. 릴리스의 `latest-<platform>.json` 을 v1.0.13 의 지문으로
한 번 덮어쓰면, 1.0.12 앱은 받아 주는 목록에 자기 지문이 없어 스토어 업데이트 모달을 띄운다(결정 5). 이 일은 발행
스크립트가 하지 않고 손으로 한 번 한다. 스크립트가 두 곳에 쓰면 발행 경로가 둘이 된다. 1.0.12 사용자가 없어지면 Worker 와
릴리스를 지운다(이슈 #810).

### 결정 3. `runtimeVersion` 은 `fingerprint` 정책으로 계산하고, 사람이 적지 않는다

`app.json` 의 `runtimeVersion` 은 `{ "policy": "fingerprint" }` 다. 네이티브가 맞지 않는 번들이 나가면
앱이 켜지자마자 죽고, 죽은 앱은 OTA 로 고칠 수 없다. 네이티브를 바꿀 때마다 사람이 숫자를 올리게 하면
언젠가 잊는다. 그래서 값을 계산으로 정한다.

이 때문에 지켜야 할 규칙이 있다. 지문은 커밋된 `android/` · `ios/` 와 `app.json` 에서 계산되므로,
네이티브를 바꾼 트리에서 발행하면 그 번들은 지금 스토어에 있는 어느 바이너리도 받지 못한다. 네이티브를
바꿨다면 스토어 바이너리를 새로 빌드하고, 그 바이너리를 빌드한 트리에서 발행한다. 발행한 뒤에 트리의 네이티브
쪽이 바뀌어도 매니페스트는 아무 기기도 묻지 않는 이름으로 남는다.

그래서 발행 스크립트는 마지막 단계에서 기기와 똑같은 헤더로 매니페스트를 요청하고, 번들을 내려받아
sha256 해시를 매니페스트 값과 비교한다. 올라갔는지가 아니라 기기가 실제로 받을 수 있는지를 확인해야
발행이 끝난 것으로 본다.

### 결정 4. 번들은 자기 sha256 으로 이름을 짓고, 서버에 이미 있는 이름은 올리지 않는다

에셋 파일 이름은 Metro 가 내용의 md5 로 짓는다. 이름이 같으면 내용도 같으므로, 서버에 이미 있는
이름은 건너뛴다. JS 만 고친 발행이면 번들 두 개만 올라간다. 기기도 같은 이유로 이미 가진 에셋은 다시
받지 않는다.

번들은 다르다. `expo export` 가 붙이는 이름의 해시는 Hermes 컴파일 이전 단계에서 계산돼서, 같은
이름으로 다른 바이트가 나온다. 이 이름을 그대로 쓰면 새 번들이 이미 있는 이름으로 걸러져 올라가지
않고, 기기는 해시가 맞지 않는다며 받은 번들을 버린다. 그래서 번들은
`bundle-<platform>-<sha256>.hbc` 로 이름을 바꿔 올린다. 올릴 파일 목록은 디렉터리를 훑지 않고
`dist/metadata.json` 에서 읽는다.

### 결정 5. 스토어 업데이트가 필요한지는 `/latest` 로 따로 판정하고, 받아 주는 지문은 목록으로 둔다

기기의 지문이 매니페스트와 맞지 않으면 프로토콜은 204 를 준다. 그대로 두면 새 버전이 있는데도
설정 화면에 `최신 버전입니다` 가 뜬다. 그래서 확인 결과가 최신일 때만 어댑터가 매니페스트 주소 옆의
`latest?platform=<platform>` 을 한 번 더 묻는다(1.0.13 부터 서버의 `/v1/ota/latest`, 1.0.12 는 Worker 의 `/latest`).
이 요청은 `latest-<platform>.json` 을 돌려준다.

```json
{ "runtimeVersion": "…", "acceptedRuntimeVersions": ["…"], "appVersion": "1.0.12+5", "storeUrl": "…" }
```

기기의 `Updates.runtimeVersion` 이 `acceptedRuntimeVersions` 안에 있으면 최신이고, 없으면
`store-required` 다. 값 하나가 아니라 목록인 이유는 심사 기간 때문이다. 그동안은 스토어에 있는 옛
바이너리와 심사 중인 새 바이너리가 둘 다 정상이다. 값 하나로 판정하면 심사 담당자가 잠기거나, 기존
사용자가 받을 것도 없이 잠긴다.

`acceptedRuntimeVersions` 는 선택 필드로 읽는다. 없거나 비었거나 문자열 배열이 아니면 `[runtimeVersion]`
으로 판정한다. 이 필드를 모르는 옛 번들도 같은 결과를 내므로, 필드가 빠져도 엉뚱하게 잠기는 일은 없다.

다음 경우에는 판정하지 않고 최신으로 둔다. `/latest` 조회가 실패했을 때, 응답에 `runtimeVersion` 이나
`appVersion` 이 없을 때, 기기가 자기 지문을 모를 때다. 확인하지 못한 것을 이유로 앱을 막지 않는다.
매니페스트에 받을 번들이 있으면 `/latest` 는 묻지 않는다.

### 결정 6. 심사 중인 지문은 `IN_REVIEW_RUNTIME_VERSIONS` 에 적고, 게시를 확인하면 비운다

발행 스크립트는 발행할 때마다 `latest-<platform>.json` 을 통째로 다시 쓴다. 손으로 고친 목록은 다음
발행이 덮어 버리므로, 심사 중인 지문은 `scripts/ota-runtime-version.mjs` 의 상수
`IN_REVIEW_RUNTIME_VERSIONS` 에 커밋해 둔다. 스크립트는 `acceptedRuntimeVersions` 를
`[발행 지문, ...심사 중 지문]` 으로 쓰고, 같은 값은 겹쳐 쓰지 않는다.

값은 지어내지 않고 바이너리에서 읽는다(iOS `EXUpdates.bundle/fingerprint`, AAB 의
`base/assets/fingerprint`). 심사에서 반려돼 네이티브를 고쳐 다시 빌드했다면 이 값도 바꾼다.

옛 바이너리를 잠그려면 이 상수를 비운다. 플랫폼마다 따로 비운다. 두 스토어의 게시 시점이
다르기 때문이다. 게시 여부는 콘솔 상태가 아니라 iTunes Lookup(`country=kr`)의 `version` 과 Play 상세
페이지의 버전으로 확인한다. 비우는 것을 잊으면 아무도 잠기지 않는다. 이쪽이 안전하므로 그렇게 두었다.
2026-10-08 에 두 플랫폼 다 비웠다.

옛 지문을 목록에서 뺀 뒤에는 `publish-rn-ota.mjs` 로 그 바이너리용 번들을 낼 수 없다(결정 7).
그래서 잠그기 전에 잠금 코드가 들어간 번들을 실기기에서 확인한다.

### 결정 7. 발행 지문은 트리 계산값이고, 지문을 고정한 발행은 거부한다

1.0.6 바이너리의 지문은 지금 트리에서 다시 만들 수 없었다. 그래서 한때 `PINNED_RUNTIME_VERSIONS` 에
스토어 바이너리의 지문을 적어 두고, 트리 계산값 대신 그 값으로 발행했다. 그렇게 낸 1.0.7 에서
안드로이드 이미지 273개가 모두 빈칸으로 나왔다. 안드로이드는 바이너리에 들어 있는 이미지를 드로어블
리소스로 갖고 있고, 리소스 이름을 에셋의 소스 경로에서 만든다. 트리가 다르면 그 경로도 다르다.
지문이 맞지 않는다는 것은 트리가 다르다는 신호였고, 그 상태에서는 에셋도 믿을 수 없다.

지금은 두 스토어 바이너리가 트리 계산값과 같은 지문으로 게시돼 있어서 `PINNED_RUNTIME_VERSIONS` 가
비어 있다. 발행 스크립트는 여기에 발행하는 플랫폼의 값이 하나라도 있으면 빌드 전에 멈춘다. 다시
고정해야 하는 상황이 오면 `git log -- scripts/ota-legacy-asset-paths.cjs` 에서 에셋 이름을 맞추는
장치를 되살린다. 그 장치에 필요한 이름 표는 해당 바이너리가 설치된 기기의 logcat
`embeddedAssetFileMap` 에서 새로 뽑는다.

고정한 값이 있을 때 그것이 지금 발행된 `/latest` 의 `runtimeVersion` 과 같은지 확인하는 검사
(`describePinMismatch`)는 스크립트에 남아 있다.

### 결정 8. 우리가 쓰는 값 넷은 매니페스트 `extra` 에 싣는다

| 필드 | 쓰는 곳 |
|---|---|
| `appVersion` | 화면에 보이는 버전. 프로토콜은 번들을 UUID `id` 로만 구분한다 |
| `highlights` | 업데이트 모달의 `자세히 보기`. `src/data/release-notes.ts` 에서 가져온다([[ADR-052]]) |
| `sizeBytes` | 모달의 다운로드 크기와 자동 받기 판정([[ADR-012]] 결정 2). 기기에 이미 있는 에셋은 안 받으므로 gzip 으로 압축한 번들의 크기를 쓴다(결정 13) |
| `storeUrl` | 스토어로 보낼 주소 |

어댑터는 넷 다 선택 필드로 읽는다. 매니페스트를 만든 스크립트와 그것을 읽는 앱이 서로 다른 시점의
코드일 수 있기 때문이다. `highlights` 는 빈 배열이면 없는 것으로 친다. `appVersion` 이 없으면 모달에
`알 수 없음` 을 보인다.

발행 스크립트는 `release-notes.ts` 에 그 버전의 노트가 없거나 `highlights` 가 비어 있으면 빌드 전에
멈춘다(`describeReleaseNoteGap`).

### 결정 9. OTA 는 포트 하나 뒤에 두고, 포트는 확인 · 받기 · 적용 세 가지 동작으로 나눈다

`LiveUpdatePort`(`native/ports.ts`)의 구현은 `native/adapters/rn-live-update.ts` 하나다. 포트는 `check` ·
`download(onProgress)` · `apply` 로 나뉘고 주소, 체크섬, 번들 id 를 드러내지 않는다. `expo-updates` 는
이 값들을 런타임 안에서 처리하고 JS 로 내주지 않기 때문이다.

`check` 결과는 `unsupported` · `error` · `up-to-date` · `store-required` · `update-available` 다섯 가지다.
앱이 그다음에 할 수 있는 일로 나눈 것이라 프로토콜이 바뀌어도 그대로 쓸 수 있다. `native/live-update.ts`
에는 프로토콜과 관계없는 버전 비교(`isNewerVersion`)와 적용 순서([[ADR-012]] 결정 6)만 남는다.

`notifyAppReady` 는 아무 일도 하지 않는다. `expo-updates` 에는 그런 JS API 가 없고, 부팅하다 죽는
번들은 네이티브 `ErrorRecovery` 가 알아서 되돌린다.

### 결정 10. 화면에 보이는 버전은 지금 실행 중인 번들에서 읽는다

어댑터의 `getCurrentVersion` 이 다음 순서로 고른다.

1. OTA 번들이면 매니페스트 `extra.appVersion`
2. 바이너리에 내장된 번들이면 `expo-constants` 의 `Constants.expoConfig.version`. 빌드할 때의 `app.json`
   버전이다
3. 둘 다 없으면 `package.json` 의 `version`

바이너리에 내장된 번들의 매니페스트에는 `extra` 가 없다. 예전에는 이때 `package.json` 을 읽었는데,
스토어 1.0.8 바이너리가 1.0.7 로 보였다. 스토어 릴리스는 `app.json` 만 올리기 때문이다.

더보기 화면, 앱 설정, 개발 노트는 `useRunningAppVersion` 으로 이 값을 읽는다. 부팅 때 `checkOnBoot` 가
채운 값이고, 라이브 업데이트 런타임이 없으면 `package.json` 버전이다.

### 결정 11. 스토어 버전은 `app.json`, OTA 버전은 `package.json` 에서 따로 올리고, 서로 비교하지 않는다

`app.json` 은 두 플랫폼 지문의 재료다. OTA 버전을 올리려고 `app.json` 을 고치면 지문이 바뀌어 스토어
바이너리가 그 번들을 받지 못한다. `package.json` 의 `version` 은 지문 재료가 아니다. 그래서 발행
스크립트는 `package.json` 의 `version` 을 매니페스트 `appVersion` 으로 쓰고, `app.json` 버전과 같은지는
보지 않는다. 다만 `package.json` 의 `scripts` 는 지문 재료다. 스토어에 게시한 뒤에는 npm 스크립트를
더하지 않는다.

OTA 버전이 스토어 버전보다 낮으면 버전을 비교하는 판정(완료 안내 등)이 틀릴 수 있다. 이 위험은
감수하기로 했다(사용자 결정).

### 결정 12. 버전 형식은 `x.y.z` 나 `x.y.z+n` 이고, 화면에는 `x.y.z(n)` 으로 보인다

같은 버전의 버그 수정 OTA 는 새 버전 번호를 쓰지 않고 패치 번호를 붙인다(사용자 지정). 첫 발행에는
번호가 없고, 그다음부터 `+1`, `+2` 다. `+n` 은 semver 의 빌드 메타데이터라 버전을 읽는 도구가 깨지지
않는다. `1.0.10-1` 은 프리릴리스라 `1.0.10` 보다 낮은 버전으로 읽혀서 쓰지 않았다.

- `lib/app-version.ts` 의 `parseAppVersion` 이 형식을 읽는다. `1.0` 같은 두 자리, `+0`, 괄호 표기는
  읽지 않는다. 네이티브 버전이 두 자리였을 때 OTA 가 한 번도 동작하지 않은 적이 있다.
- 발행 스크립트는 이 형식이 아니면 멈춘다.
- `formatAppVersion` 이 화면 표기 `1.0.10(1)` 로 바꾼다. 업데이트 모달, 앱 정보, 앱 설정, 문의 메일이
  이 함수를 거친다.
- `isNewerVersion` 은 패치 번호까지 비교한다(`1.0.10` < `1.0.10+1` < `1.0.11`). 번호가 없으면 0 이고,
  읽지 못하는 값은 새것으로 치지 않는다.
- 패치의 릴리스 노트는 따로 쓰지 않고 기본 버전 노트에 이어 붙인다(사용자 지정). 발행 스크립트는
  `baseAppVersion` 으로 `1.0.10+1` 에서 `1.0.10` 노트를 찾는다. 모달에 패치 내용을 보이려면
  `highlights` 를 직접 고친다.

버전 문자열을 글자 그대로 비교하면 이 규칙을 놓친다. 비교는 `parseAppVersion` 이나 `baseAppVersion`
을 거친다.

### 결정 13. 번들은 gzip 으로 압축해 내주고, 최근 세 번의 발행만 남긴다 (사용자 지정 2026-10-30)

OTA 를 받을 때 실제로 받는 것은 대부분 JS 번들 하나다. 기기에 이미 있는 에셋은 다시 받지 않기 때문이다. 이미지를 서버로
옮긴 뒤에도 번들은 그대로라, 2026-10-30 main 을 iOS 로 내보낸 `.hbc` 가 7.55MB 였다. 같은 파일을 `gzip -9` 로 압축하면
3.05MB 다. 5MB 이하인 업데이트만 묻지 않고 받으므로([[ADR-012]] 결정 2), 압축하지 않으면 모든 OTA 가 묻는 쪽으로 빠진다.

- 발행 스크립트가 번들 옆에 `gzip -9` 압축본(`<번들 이름>.gz`)을 함께 올린다. nginx 의 `gzip_static on` 이 기기가
  `accept-encoding: gzip` 을 보내면 압축본을 `content-encoding: gzip` 으로 내준다.
- `launchAsset.hash` 는 압축하지 않은 번들의 해시다. 기기는 응답을 풀어서 저장하고, 푼 내용으로 해시를 확인한다. 안드로이드
  `expo-updates` 는 `Accept-Encoding: zstd, br, gzip` 을 보내고 응답을 스스로 푼다(`CompressionInterceptor.kt`). iOS 가
  푸는지는 실기기로 아직 확인하지 않았다.
- `extra.sizeBytes` 는 압축한 크기다. 사용자가 실제로 받는 양이기 때문이다.
- 발행 스크립트의 왕복 확인(`[6/6]`)은 기기와 같은 `Accept-Encoding` 을 보내고, gzip 으로 왔는지와 푼 내용의 해시를 본다.

발행할 때마다 올린 파일 목록을 `releases.json` 에 적고, 최근 세 번의 발행이 쓰는 파일만 남기고 나머지를 지운다. 번들은 발행
한 번에 플랫폼 둘을 합쳐 약 21MB(원본 7.5MB + 압축본 3MB 씩)라 지우지 않으면 디스크가 계속 찬다. 바로 지난 발행을 받던
기기가 아직 내려받는 중일 수 있어서 하나가 아니라 셋을 남긴다. OTA zip 을 최신 셋만 남기던 때와 같은 기준이다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `native/adapters/__tests__/rn-live-update.test.ts` | 결정 5: 목록에 자기 지문이 있으면 최신, 없으면 `store-required` 인지 본다. 목록이 없거나 비었거나 형식이 틀리면 `runtimeVersion` 하나로 판정하는지, 조회 실패를 삼키는지, 받을 번들이 있으면 `/latest` 를 묻지 않는지 본다 |
| | 결정 10: OTA 번들이면 매니페스트 버전, 바이너리 번들이면 바이너리 버전, 둘 다 없으면 `package.json` 버전인지 본다 |
| `features/live-update/__tests__/use-running-app-version.spec.tsx` | 결정 10: 스토어가 비었으면 `package.json` 버전을 쓰고, 스토어가 나중에 채워지면 화면 값도 따라 바뀌는지 본다 |
| `lib/__tests__/app-version.test.ts` | 결정 12: `x.y.z` 와 `x.y.z+n` 만 읽고 그 밖의 표기는 거부하는지, 화면 표기와 기본 버전이 맞게 나오는지 본다 |
| `features/live-update/__tests__/store.spec.ts` | 결정 12: 패치 번호가 올라가면 완료 안내가 뜨고 내려가면 안 뜨는지 본다(실제 `isNewerVersion` 을 쓴다) |
| `scripts/__tests__/ota-runtime-version.test.mjs` | 결정 6: 받아 주는 목록이 발행 지문을 앞에 두고 심사 중 지문을 뒤에 붙이는지, 플랫폼마다 따로인지, 같은 값을 겹쳐 쓰지 않는지 본다. `IN_REVIEW_RUNTIME_VERSIONS` 가 지금 비어 있는지도 본다. 그래서 심사 중 지문을 넣거나 뺄 때는 이 테스트도 일부러 고쳐야 한다 |
| | 결정 7: 고정한 값이 트리 계산값보다 우선하는지, 고정한 값이 발행된 판정값과 다르면 멈추는지 본다 |
| | `--platform` 으로 고른 플랫폼만 발행하는지, 모르는 값이나 빈 값이면 던지는지, 발행하지 않는 플랫폼의 고정값은 검사에서 빠지는지 본다 |
| `scripts/__tests__/release-note-gap.test.mjs` | 결정 8: 노트가 없거나 `items` 나 `highlights` 가 비면 발행을 막는지, 지금 맨 앞의 노트가 이 검사를 통과하는지 본다 |

결정 13 의 압축은 단위 테스트가 없다. 발행 스크립트의 `[6/6]` 이 발행할 때마다 서버에서 번들을 받아, gzip 으로 왔는지와
푼 내용의 해시를 확인한다.

`publish-rn-ota.mjs` 본문에는 테스트가 없다. 서버의 `/v1/ota/*` 는 서버 저장소의 `modules/ota/` 테스트가 본다. 스크립트 본문은 최상위 `await` 를 쓰는 ESM 이라
jest 가 불러오지 못한다. 그래서 검사할 로직은 `ota-runtime-version.mjs` 와 `release-note-gap.mjs` 로
따로 뺐다.

## 열린 질문

- `expo-constants` 가 `package.json` 에 직접 의존성으로 적혀 있지 않다. `getCurrentVersion` 은 `expo` 가
  끌어온 패키지를 그대로 import 한다. `npm install expo-constants` 를 하면 범위 안 최신으로 올라가 두
  플랫폼 지문이 바뀌므로, 스토어 바이너리를 새로 빌드할 때 함께 직접 의존성으로 옮겨야 한다. 1.0.12
  바이너리 때는 옮기지 않았다.

## 번호 기록

- ADR-011 (2026-10-19): 옛 ADR-022 · 024 · 137 · 190 · 191 · 268 · 279 · 292 를 합쳐 처음 작성
- ADR-138 (2026-10-30): 1.0.13 부터 우리 서버가 매니페스트 · 번들 · 에셋을 내주고, 1.0.12 는 GitHub · Worker 에 얼려 두고, 번들을 gzip 으로 압축하고 최근 세 번의 발행만 남긴다(결정 1 · 2 · 4 · 8 고침, 결정 13 더함, 이슈 #803)
