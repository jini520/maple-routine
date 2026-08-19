# 2026-08-19 — 스토어 바이너리와 `/latest` 의 runtimeVersion 이 어긋난다 (RN OTA)

v1.0.6(RN 전환 첫 스토어 릴리스)을 두 스토어에 올린 뒤 `publish-rn-ota.mjs` 를 돌리기 직전,
**스토어에 올라간 바이너리와 발행하려는 매니페스트의 `runtimeVersion` 이 서로 다르다**는 것이
드러났다. 그대로 발행했으면 스토어에서 1.0.6 을 받은 사용자가 **부팅할 때마다** 「스토어
업데이트가 필요해요 · v1.0.6」 모달을 보게 된다 — 스토어에 가도 받을 것이 없는 채로.

## 증상

발행 전 실측. 세 값이 전부 다르다.

| 대상 | 바이너리에 박힌 `runtimeVersion` |
|---|---|
| iOS build 13·14 (App Store Connect 업로드 완료) | `d304704e…` |
| Android versionCode 21 (Play 업로드 완료) | `3df849c0…` |
| 그때 발행돼 있던 `/latest` (2026-08-14) | ios `d040d70c…` · android `eaa4ad54…` |
| **그 시점의 저장소가 계산하는 값** | ios `9552af72…` · android `4b88fbc9…` |

바이너리가 어떤 값을 묻는지는 열어 보면 확정적으로 안다 — `Expo.plist` 의
`EXUpdatesRuntimeVersion` 이 `file:fingerprint` 라, 앱은 번들 안 파일을 그대로 읽는다.

```bash
# iOS — 아카이브/IPA
cat <archive>/Products/Applications/app.app/EXUpdates.bundle/fingerprint
# Android — AAB
unzip -p app-release.aab base/assets/fingerprint
```

## 원인 사슬

**① `runtimeVersion` 은 빌드 시각에 바이너리 안에 박힌다.** fingerprint 정책이라 값이 계산되고
([[ADR-137]] 결정 3), 계산 결과는 **그때의 네이티브 그래프**의 함수다.

**② `publish-rn-ota.mjs` 는 발행 시점 트리의 계산값을 쓴다.** 매니페스트 파일 이름과
`latest-<platform>.json` 양쪽에 들어간다. 즉 **«구운 트리»와 «발행하는 트리»가 다르면 어긋난다.**

**③ 이 저장소의 릴리스 순서가 그 둘을 벌려 놓는다.** 빌드 번호는 *"굽고 → 커밋"* 순서로 올라간다
(소진 여부를 로컬 아카이브에서 확인한 뒤 올리므로). 그 사이에 지문이 바뀐다.

**④ `app.json` 은 두 플랫폼 **공통** 지문 재료다.** fingerprint 소스 목록에 `expoConfig` 가 통째로
들어가고, 거기엔 `ios.buildNumber` 와 `android.versionCode` 가 **함께** 들어 있다. 그래서
`b0f5dd4a`(iOS buildNumber 12→13, 19:07)가 **14:55 에 이미 구워 둔 Android AAB 의 지문까지**
무효화했다. 재현으로 확정했다 — `app.json` 의 `buildNumber` 만 12 로 되돌리면 android 계산값이
`3df849c0…` 로 **AAB 임베드 값과 정확히 일치**한다.

**⑤ iOS 는 한 갈래가 더 있다 — GUI 아카이브가 CLI 아카이브와 다른 값을 냈다.** 같은 트리에서

| 아카이브 | 빌드 방식 | fingerprint | 업로드 |
|---|---|---|---|
| 15:20 `MapleRoutine-1.0.6-13` | `xcodebuild archive` (CLI) | `9552af72…` (= 그 시점 트리 계산값) | 안 함 |
| 18:51 `app 8-19-26, 6.52 PM` | Xcode GUI `Product ▸ Archive` | `d304704e…` | **build 13·14** |

GUI 가 빌드 중 `ios/` 안 추적 파일을 건드렸고 그 편집이 이후 머지로 되돌아간 것으로 보이지만,
**사후에 재현되지 않는다.** 확실한 것은 «스토어에 간 값은 어떤 트리 상태로도 다시 만들 수
없다» 는 사실뿐이다.

## 처방 (이번 릴리스)

`/latest` 를 **스토어 바이너리에 박힌 값**으로 덮었다.

```bash
gh release upload live-update-rn latest-ios.json latest-android.json \
  --repo jini520/maple-routine --clobber
```

```json
// latest-ios.json          // latest-android.json
{ "runtimeVersion": "d304704e…",  { "runtimeVersion": "3df849c0…",
  "appVersion": "1.0.6",            "appVersion": "1.0.6",
  "storeUrl": "…" }                 "storeUrl": "…" }
```

**번들과 매니페스트는 올리지 않았다.** 스토어 바이너리에 실린 JS 가 이미 그 시점 `main` 과 같아서
(`b0f5dd4a` 는 `app.json`·`Info.plist` 두 파일만 고쳤다), 매니페스트를 올리면 **내용이 같은
업데이트를 「업데이트가 있어요」로 권하게 된다.** 지금 필요한 것은 배달이 아니라 «네 지문이
최신이다» 한 줄이다.

그 결과 스토어 사용자의 부팅 경로는 이렇게 끝난다.

```
/manifest (내 runtimeVersion) → 204(없음) → checkStoreRequired()
  → /latest.runtimeVersion === Updates.runtimeVersion → null → 모달 없음
```

옛 내부 테스트 빌드(08-14 번들)를 들고 있는 기기는 이제 지문이 안 맞으므로 **스토어로 가라는
모달을 받는다** — 그쪽은 실제로 옛 바이너리이므로 맞는 안내다.

## 다음부터

절차는 [../foundation/release.md](../foundation/release.md) 의 «스토어 바이너리와 OTA 의
runtimeVersion» 절에 규칙으로 넣었다. 요지는 둘이다 — **버전·빌드 번호를 먼저 커밋하고 그
트리에서 굽는다**, 그리고 **업로드 직전에 바이너리 안 지문과 트리 계산값을 대조한다.**

## 틀린 가설이었던 것

- ~~첫 스토어 릴리스라 OTA 발행은 필요 없다(스토어 바이너리가 곧 최신이니까)~~ — `/latest` 는
  «배달»이 아니라 «판정» 파일이라, 발행돼 있는 값이 낡으면 최신 사용자에게 거짓 모달이 뜬다.
- ~~Android AAB 는 iOS 빌드 번호와 무관하다~~ — `expoConfig` 가 공통 지문 재료라 무관하지 않다(④).
- ~~아카이브는 CLI 로 굽든 GUI 로 굽든 같은 바이너리다~~ — 적어도 fingerprint 는 달랐다(⑤).
