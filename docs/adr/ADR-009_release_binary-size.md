# ADR-009 에셋과 스토어 바이너리 크기

> 🟢 유효
> 옛 번호: ADR-093 · ADR-129 · ADR-269
> 관련 소스: `src/assets/` · `src/assets/asset-groups.ts` · `src/assets/generated/` · `scripts/generate-asset-manifest.mjs` · `src/types/image-asset.ts` · `src/types/image-asset.native.ts` · `asset-modules.d.ts` · `android/gradle.properties` · `android/app/build.gradle` · `ios/app.xcodeproj/project.pbxproj`

## 배경

앱에 실리는 그림은 OTA 로 받는 크기에도, 스토어 바이너리 크기에도 들어간다. 스토어 쪽에서는 Play Console
의 앱 최적화 점수가 낮았고(이슈 #248), 측정해 보니 AAB 가 91.9 MB 였다.

크기를 줄일 때 효과가 어디에 나타나는지를 먼저 나눠 봐야 한다. AAB 는 기기마다 맞는 ABI 하나만 내려보내고,
디버그 심볼은 기기로 가지 않는다. 그래서 ABI 와 심볼을 줄이면 올리는 크기만 줄고 사용자가 받는 크기는 그대로
다. 사용자가 받는 크기는 그림 · dex · iOS 프레임워크를 줄여야 줄어든다.

## 결정

### 결정 1. 그림은 WebP(q95)로 둔다. 확장자로 찾는 아이템 아이콘만 PNG 로 남긴다

에셋을 찾는 키는 디렉터리마다 다르고, 포맷을 바꿀 수 있는지는 이 차이에 달려 있다.

| 디렉터리 | 키 | 포맷 |
|---|---|---|
| `bosses/` · `maps/` · `maps/icons/` · `themes/` · `worlds/` · `characters/` · `mvp/` · `force/` | 확장자를 뗀 파일 이름 | WebP. 바꿔도 키가 같아서 코드를 고칠 필요가 없다 |
| `items/` · `items/rings/` | 확장자까지 포함한 파일 이름 | PNG. 게임 데이터의 `iconFile`(`"Cleansing_Ring.png"`)이 확장자를 담고 있어서, 바꾸려면 게임 데이터도 고쳐야 한다 |
| `drop-effect/` | 프레임 순서 번호 | WebP. 원래 JPG 라서 다시 압축하면 두 번 손실되지만, 측정해 보니 가장 나쁜 프레임도 PSNR 41.4 dB 로 눈으로 구분되지 않는 수준이었다 |

품질 q95 는 사용자가 비교 화면을 보고 정했다. WebP 로 바꿔도 커지는 작은 아이콘은 PNG 로 남겼다. WebP
컨테이너 크기가 줄어드는 양보다 크기 때문이다.

`themes/` 를 뺀 디렉터리의 그림은 이제 번들이 아니라 서버 그림 표에 같은 경로로 있다([[ADR-020]] 결정 14). 앱이 처음 켤 때
받는 양이 그만큼이라, 관리 화면에서 그림을 올릴 때도 이 형식을 따른다.

### 결정 2. 그림 목록은 빌드 때가 아니라 커밋할 때 만든다

`scripts/generate-asset-manifest.mjs`(`npm run assets:gen`)가 `src/assets/asset-groups.ts` 의 표대로 디렉터리를
훑어 `src/assets/generated/*.ts` 를 쓰고, 그 파일을 커밋한다. 생성물에는 평범한 ESM import 만 있다.

```ts
import a0 from '../themes/blackmage-background.webp'
export const THEME_BACKGROUND_ASSETS: Record<string, ImageAssetRef> = { "blackmage-background": a0, … }
```

빌드 때 디렉터리를 훑는 API(`import.meta.glob`)는 Vite 에만 있고 Metro 에는 없다. Metro 의
`require.context` 는 jest 에 없다. 빌드 단계에서 목록을 만들면, 그 생성 단계가 없는 환경에서는 목록이
조용히 비어 버린다.

그 대가로 그림을 넣거나 지우고 `npm run assets:gen` 을 안 돌리면 목록이 낡는다. 그러면 화면은 오류 없이
대체 그림만 그린다. 생성기와 검사 테스트가 같은 표(`asset-groups.ts`)를 읽으므로, 규칙이 두 벌로 갈라질
일은 없다.

기능 안내 이미지(`assets/guide/`)는 이 목록에 넣지 않는다. 파일을 이름으로 찾는 곳이 아니라 명시적으로
import 하는 곳이라, 파일 이름이 틀리면 조용히 넘어가지 않고 빌드가 실패해야 한다.

### 결정 3. 에셋 참조의 타입은 `ImageAssetRef` 하나를 플랫폼마다 다르게 적는다

같은 import 가 Metro 에서는 에셋 id(숫자)가 된다. 그래서 `src/types/image-asset.native.ts` 에서는 `number` 로,
`image-asset.ts` 에서는 `string` 으로 적고, tsc 는 `moduleSuffixes` 로 `.native` 쪽을 먼저 고른다.
`asset-modules.d.ts` 가 `*.png` · `*.webp` · `*.jpg` 를 `number` 로 선언한다.

이 값은 `<Image source={ref} />` 에 그대로 넣는다. 원격 이미지처럼 `{ uri }` 로 감싸면 그림이 안 뜬다.
jest 에서는 RN 프리셋이 `{ testUri }` 를 주지만 타입은 앱이 실제로 보는 값으로 적는다.

### 결정 4. 목록에 있는 그림은 전부 실리므로, 안 쓰는 그림은 지운다

목록에 있는 그림은 코드에서 참조하는지와 관계없이 전부 번들에 들어간다. 그래서 크기를 줄이는 방법은 안 쓰는
파일을 지우는 것과 쓰는 파일을 작게 만드는 것 둘뿐이다. 값을 눈으로 맞추려고 만든 디버그 화면도 조정이
끝나면 지운다. 남겨 두면 그 화면과 그 화면만 쓰는 그림이 앱에 실려 나간다.

### 결정 5. Android ABI 는 릴리스 커맨드에서만 좁힌다

```bash
./gradlew bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

`x86` · `x86_64` 는 에뮬레이터 전용이다. 빼면 그 ABI 의 네이티브 라이브러리와 디버그 심볼이 함께 빠져서
AAB 가 57.3 MB 가 된다.

`gradle.properties` 의 기본값은 넷 그대로 둔다. 에뮬레이터 개발 빌드에 `x86_64` 가 필요하고, 기본값을
좁히면 다음 사람이 에뮬레이터가 왜 안 붙는지를 빌드 설정에서 찾아야 한다. 그 대가로 플래그를 빼고 빌드하면
아무 경고 없이 예전 크기로 나간다.

### 결정 6. Android 디버그 심볼은 기본값에 맡긴다

`build.gradle` 에 `debugSymbolLevel` 을 적지 않는다. AGP 기본값이 이미 `symbol_table` 이라 명시해도 크기가
같고, 더 작은 단계는 없다. `none` 은 심볼을 AAB 에서 빼는 것이 아니라 추출을 아예 멈춰서 Play 에 올릴
파일도 안 남긴다. 심볼은 업로드 크기에만 들어가므로, 네이티브 크래시를 분석할 수 없게 되면서까지
줄이지 않는다.

### 결정 7. R8 과 리소스 축소를 켠다. 켠 릴리스는 실기기에서 확인한다

`gradle.properties` 의 `android.enableMinifyInReleaseBuilds=true` · `android.enableShrinkResourcesInReleaseBuilds=true`
로 켠다. dex 가 14.4 MB 에서 6.1 MB 로 줄어서, 사용자가 받는 크기가 약 8.4 MB 줄어든다. 리소스 축소의 효과는
0.1 MB 뿐이지만 `minifyEnabled` 와 같이 켜는 설정이라 함께 둔다. 난독화 매핑은 AAB 안에 들어 있어 Play 가
알아서 쓴다.

`-keep` 규칙은 더하지 않았다. 산출물을 열어 보니 로컬 Expo 모듈과 OTA 런타임이 보존돼 있었고, 빠진 것이
보이지 않는데 짐작으로 규칙을 더하면 R8 이 지울 수 있는 코드만 줄어든다.

R8 은 리플렉션으로만 호출되는 코드를 지울 수 있고, 그런 문제는 빌드와 설치가 성공한 뒤 그 화면을 눌러야
드러난다. debug 빌드에서는 R8 이 돌지 않는다. 그래서 R8 을 켠 릴리스는 릴리스 빌드를 실기기에 깔고 주요
화면을 모두 눌러 본 뒤에 올린다.

### 결정 8. iOS 임베드 프레임워크는 심볼을 벗긴 뒤 다시 서명한다

`[CP] Embed Pods Frameworks` 다음에 `Strip Embedded Frameworks` 빌드 단계를 두고, Release 구성에서만
프레임워크마다 `strip -x -S` 를 실행한 뒤 같은 신원(`EXPANDED_CODE_SIGN_IDENTITY`)으로 다시 서명한다. 실제로
임베드되는 프레임워크 아홉이 모두 미리 빌드된 XCFramework 라서, Xcode 의 `STRIP_INSTALLED_PRODUCT` 로는
심볼이 지워지지 않기 때문이다. 이 단계로 24.1 MB 가 12.1 MB 로 줄고, 이 감소는 사용자가 받는 크기에 그대로
반영된다.

- **다시 서명해야 한다.** CocoaPods 는 복사하자마자 서명하므로, 그 뒤에 바이너리를 바꾸면 서명이 모두
  무효가 되어 업로드가 거부된다.
- **`-s` 가 아니라 `-x -S` 다.** 동적 프레임워크라 전역 심볼을 지우면 링크가 깨진다. dSYM 은 아카이브에
  따로 남고 `strip` 이 UUID 를 바꾸지 않아서 크래시 심볼화는 그대로 된다.
- 이 단계는 `project.pbxproj` 에 손으로 넣은 것이다. `pod install` 은 `[CP]` 가 붙은 자기 단계만 관리해서
  지우지 않지만, `expo prebuild` 는 지운다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/assets/generated/__tests__/asset-manifest.spec.ts` | 결정 2: `asset-groups.ts` 의 그룹이 모두 생성물로 있는지, 각 생성물의 키 집합이 지금 디렉터리의 파일과 같은지 본다 |
| `src/__tests__/vite-only-api-policy.test.ts` | 결정 2: 제품 코드에 `import.meta.glob` 이 남아 있지 않은지 본다. 되살아나면 Metro 에서 모듈을 읽는 순간 죽는다 |

결정 5 ~ 8 은 빌드 설정이라 테스트가 없다. 릴리스마다 산출물로 확인한다(`foundation/release.md`).

## 번호 기록

- ADR-009 (2026-10-19): 옛 ADR-093 · 129 · 269 를 합쳐 처음 작성. 옛 ADR-093 의 Vite dist 크기 판단과
  옛 ADR-269 결정 4(R8 을 미룬다)는 폐기된 내용이라 옮기지 않았다
