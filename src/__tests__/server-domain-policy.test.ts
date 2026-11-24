// 앱이 부르는 서버 주소가 api 하나인지 본다.
//
// 1.0.15 바이너리부터 서버 요청 · 그림 · OTA 를 모두 `api.mapleroutine.store` 에서 받고, 처리방침 · 키 가이드는
// `info.mapleroutine.store` 로 연다. 루트(`mapleroutine.store`)는 1.0.14 까지의 앱이 부르는 주소다. 한 곳이라도 루트로 남으면
// 1.0.15 앱이 옛 서버와 새 서버에 나눠 쓴다.
//
// OTA 매니페스트 주소는 네이티브 설정 세 곳에 따로 적혀 있고, 번들 주소는 발행 스크립트에 있다. 이 넷이 갈리면 기기가
// 매니페스트와 번들을 다른 서버에서 받는다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { SERVER_ORIGIN } from '../server/base-url'

const ROOT = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** 루트 주소. 앞의 `//` 로 하위 도메인(`api.` · `info.`)과 갈린다. */
const ROOT_ORIGIN = /\/\/mapleroutine\.store\b/

/**
 * 루트 주소가 남아도 되는 스크립트. 안내 사이트를 만들고 올리는 둘이다.
 *
 * 사이트의 대표 주소를 info 로 옮기는 일은 사용자가 하자고 할 때 한다. 그때까지는 루트가 사이트의 대표 주소다.
 */
const SITE_SCRIPTS: readonly string[] = ['scripts/build-site.mjs', 'scripts/deploy-site.sh']

function textFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...textFiles(rel))
    else if (/\.(m?[jt]sx?|cjs|json|py|sh|md|snap)$/.test(entry)) out.push(rel)
  }
  return out
}

function rootAddressLines(files: readonly string[]): string[] {
  const out: string[] = []
  for (const rel of files) {
    for (const [i, line] of read(rel).split('\n').entries()) {
      if (ROOT_ORIGIN.test(line)) out.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`)
    }
  }
  return out
}

describe('앱이 부르는 서버 주소', () => {
  const src = textFiles('src')
  const scripts = textFiles('scripts')

  it('훑을 파일을 실제로 찾았다', () => {
    // 경로가 틀려 0개를 훑고도 통과하는 것이 이런 가드의 흔한 실패다.
    expect(src.length).toBeGreaterThan(600)
    expect(scripts).toEqual(expect.arrayContaining(['scripts/publish-rn-ota.mjs', ...SITE_SCRIPTS]))
  })

  it('src 에 루트 주소가 없다', () => {
    expect(rootAddressLines(src)).toEqual([])
  })

  it('scripts 에는 안내 사이트 스크립트에만 루트 주소가 있다', () => {
    expect(rootAddressLines(scripts.filter((rel) => !SITE_SCRIPTS.includes(rel)))).toEqual([])
  })

  it('안내 사이트 스크립트의 예외가 낡지 않았다', () => {
    // 사이트를 info 로 옮겨 루트 주소가 사라졌으면 예외에서도 뺀다. 안 그러면 루트 주소가 다시 들어와도 못 잡는다.
    expect(SITE_SCRIPTS.filter((rel) => !ROOT_ORIGIN.test(read(rel)))).toEqual([])
  })

  it('OTA 매니페스트 주소는 네이티브 설정 세 곳이 같고, 앱이 부르는 서버의 것이다', () => {
    const appJson = (JSON.parse(read('app.json')) as { expo: { updates: { url: string } } }).expo.updates.url
    const plist = /<key>EXUpdatesURL<\/key>\s*<string>([^<]+)<\/string>/.exec(read('ios/app/Supporting/Expo.plist'))?.[1]
    const manifest = /android:name="expo\.modules\.updates\.EXPO_UPDATE_URL"\s+android:value="([^"]+)"/.exec(
      read('android/app/src/main/AndroidManifest.xml'),
    )?.[1]

    expect({ appJson, plist, manifest }).toEqual({
      appJson: `${SERVER_ORIGIN}/v1/ota/manifest`,
      plist: `${SERVER_ORIGIN}/v1/ota/manifest`,
      manifest: `${SERVER_ORIGIN}/v1/ota/manifest`,
    })
  })

  it('발행 스크립트가 매니페스트에 적는 번들 주소도 같은 서버다', () => {
    const filesBase = /const FILES_BASE = '([^']+)'/.exec(read('scripts/publish-rn-ota.mjs'))?.[1]

    expect(filesBase).toBe(`${SERVER_ORIGIN}/ota/files`)
  })
})
