/**
 * OTA 매니페스트 엔드포인트 ([[ADR-137]] 결정 1·2).
 *
 * ## 이 Worker 가 존재하는 이유는 **헤더 한 줄** 이다
 *
 * `expo-updates` 는 매니페스트 응답에 `expo-protocol-version` 이 없으면 그 자리에서 던진다
 * (`UpdateFactory.kt:18` · iOS `Update.swift:155`). 본문은 정적 JSON 이어도 되지만
 * (`FileDownloader.kt:471` — multipart 가 아니면 본문 전체를 매니페스트로 읽는다) GitHub Releases 도
 * GitHub Pages 도 커스텀 응답 헤더를 못 붙인다. 그 한 줄을 얹는 것이 이 파일의 전부다.
 *
 * ## 그래서 **상태를 들지 않는다**
 *
 * 매니페스트를 만들지 않는다 — 만드는 것은 `scripts/publish-rn-ota.mjs` 이고 저장하는 곳은 릴리스다.
 * 이 Worker 는 요청 헤더로 파일 이름을 만들어 그 릴리스에서 읽어 올 뿐이라, **한 번 올리고 다시
 * 건드리지 않는다.** 배포가 «릴리스 업로드 + Worker 갱신» 두 갈래가 되면 갈리는 순간 어느 쪽이
 * 사실인지 알 방법이 없다([[ADR-137]] 결정 2).
 *
 * 그 덕에 **대역폭도 여기를 안 지나간다** — 매니페스트가 가리키는 `launchAsset.url` 은 GitHub 을
 * 직접 가리키므로, 이 Worker 가 내보내는 것은 수 KB JSON 한 장뿐이고 15 MB 짜리 번들·에셋은
 * 지금까지처럼 GitHub 이 받는다.
 */

/** 번들·에셋·매니페스트가 쌓이는 릴리스([[ADR-137]] 결정 9). capacitor 쪽 `live-update-latest` 와 별개 축이다. */
const RELEASE_BASE = 'https://github.com/jini520/maple-routine/releases/download/live-update-rn'

/**
 * 스펙이 요구하는 공통 응답 헤더.
 *
 * `expo-manifest-filters` 와 `expo-server-defined-headers` 는 **일부러 안 보낸다** — 스펙은 MUST 로
 * 적지만 클라이언트는 둘 다 nullable 로 읽고(`ResponseHeaderData` 의 `manifestFiltersRaw: String? = null`),
 * 우리는 거를 것도 저장시킬 것도 없다. 빈 SFV 딕셔너리를 지어내 보내면 파서에 무엇이 들어가는지
 * 우리가 모르는 값을 보내는 것이 된다.
 */
const COMMON_HEADERS = {
  'expo-protocol-version': '1',
  'expo-sfv-version': '0',
  'cache-control': 'private, max-age=0',
}

/**
 * 파일 이름에 넣기 전에 거른다 — `platform` 과 `runtimeVersion` 은 **요청 헤더에서 오는 값**이라
 * 그대로 이으면 경로 조작이 된다(`../`). 통과 문자 집합을 좁게 잡고, 벗어나면 그 요청은 없는
 * 번들을 물은 것으로 친다.
 */
function isSafeSegment(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value)
}

/**
 * 릴리스의 정적 파일을 읽는다.
 *
 * 캐시를 우회하는 이유는 [[ADR-026]] 이 이미 겪은 것이다 — 매니페스트는 **이름 고정·내용 가변**이라
 * 엣지 캐시가 옛 배포를 돌려준다(배포 직후 `curl` 이 이전 버전을 주던 그 증상). 에셋과 달리 이
 * 파일들만 내용이 바뀌므로 여기서만 우회한다.
 */
async function fetchReleaseFile(name) {
  return fetch(`${RELEASE_BASE}/${name}?t=${Date.now()}`, {
    cf: { cacheTtl: 0, cacheEverything: false },
    headers: { 'cache-control': 'no-cache' },
  })
}

/**
 * `GET /manifest` — `expo-updates` 가 부르는 자리.
 *
 * 이 런타임에 맞는 번들이 없으면 **204** 다. 그것이 프로토콜에서 "업데이트 없음"이고, 그래서
 * *"새 버전은 있는데 네이티브가 낮다"* 를 여기서 말할 방법이 없다 — 그 판정은 `/latest` 가 맡는다
 * ([[ADR-137]] 결정 4).
 */
async function handleManifest(request) {
  const platform = request.headers.get('expo-platform')
  const runtimeVersion = request.headers.get('expo-runtime-version')

  if (!isSafeSegment(platform) || !isSafeSegment(runtimeVersion)) {
    return new Response(null, { status: 204, headers: COMMON_HEADERS })
  }

  const upstream = await fetchReleaseFile(`manifest-${platform}-${runtimeVersion}.json`)
  if (!upstream.ok) {
    return new Response(null, { status: 204, headers: COMMON_HEADERS })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { ...COMMON_HEADERS, 'content-type': 'application/json' },
  })
}

/**
 * `GET /latest?platform=ios` — **우리 축**의 조회([[ADR-137]] 결정 4).
 *
 * 프로토콜이 삼키는 것을 되살리는 자리다. 런타임이 안 맞으면 앱은 위에서 204 를 받아
 * *"최신입니다"* 로 보이는데 그것은 거짓이다 — 새 버전은 있고 스토어를 거쳐야 한다
 * ([[ADR-027]] 결정 7). 앱은 `up-to-date` 로 떨어졌을 때만 여기를 묻는다.
 */
async function handleLatest(request) {
  const platform = new URL(request.url).searchParams.get('platform')
  if (!isSafeSegment(platform)) {
    return new Response(JSON.stringify({ error: 'bad platform' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const upstream = await fetchReleaseFile(`latest-${platform}.json`)
  if (!upstream.ok) {
    // 아직 아무것도 발행되지 않은 상태다. 404 로 두면 앱이 «조회 실패»(check-error)로 읽는데,
    // 여기서 사실인 것은 "비교할 대상이 없다"이지 "물어보다 실패했다"가 아니다.
    return new Response(JSON.stringify({ runtimeVersion: null, appVersion: null }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=0' },
    })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=0' },
  })
}

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 })
    }

    const { pathname } = new URL(request.url)
    if (pathname === '/manifest') return handleManifest(request)
    if (pathname === '/latest') return handleLatest(request)
    return new Response('not found', { status: 404 })
  },
}
