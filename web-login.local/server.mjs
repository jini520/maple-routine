// 넥슨 Open ID 검수 캡처용 웹 진입 페이지. 의존성 없이 `node server.mjs` 로 띄운다.
// 넥슨 로그인은 운영 서버가 한다. 시크릿은 서버에 있고 이 페이지는 갖지 않는다.
//   버튼 → 서버 POST /v1/auth/nexon/login { platform: 'web' } → 넥슨 로그인 · 동의
//   → api 콜백(서버) → 서버가 WEB_RETURN_URL(이 페이지의 /auth/nexon/done)로 receipt 를 실어 돌려보냄
//   → 이 페이지가 redeemKey 와 receipt 로 서버 POST /v1/auth/nexon/session 을 불러 세션을 받음
// 그림은 `assets/` 에 있다. 처음 한 번 `sh fetch-assets.sh` 로 Figma 시안에서 받는다.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3000)
const API = process.env.API_BASE ?? 'https://mapleroutine.store'

const TYPES = { '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' }

/** 로그인을 시작한 redeemKey. 한 사람이 쓰는 검수용 페이지라 마지막 하나만 둔다. */
let pendingRedeemKey = null

/** 서버 게임 데이터의 로그인 화면 FAQ 묶음. 5분 동안 담아 둔다. */
let faqCache = { at: 0, sheet: null }

function page(resultHtml = '') {
  return readFileSync(join(DIR, 'index.html'), 'utf8').replace('<!--RESULT-->', resultHtml)
}

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const ok = () => '<p class="result ok">넥슨 로그인에 성공했어요.</p>'
const fail = (why) => `<p class="result err">넥슨 로그인에 실패했어요${why ? ` (${escape(why)})` : ''}</p>`

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** 문단 배열. 답은 `{ kind: 'paragraph', text }` 배열이다. */
const paragraphs = (answer) =>
  Array.isArray(answer) ? answer.map((b) => b?.text ?? '').filter(Boolean) : String(answer ?? '').split(/\n\s*\n/)

async function signInFaq() {
  if (Date.now() - faqCache.at < 5 * 60_000) return faqCache.sheet
  let sheet = null
  try {
    const res = await fetch(`${API}/v1/game-data`, { signal: AbortSignal.timeout(10_000) })
    // `faqs` 칸은 `{ sheets: [{ key, title }], items: [{ sheet, question, answer }] }` 이다. 문항 차례는 items 차례다.
    const faqs = (await res.json())?.faqs
    const head = faqs?.sheets?.find((s) => s.key === 'sign-in')
    if (head) {
      const items = faqs.items
        .filter((i) => i.sheet === head.key)
        .map((i) => ({ question: i.question, answer: paragraphs(i.answer) }))
      sheet = { title: head.title, items }
    }
  } catch (error) {
    console.error('FAQ 를 받지 못함', error.message)
  }
  faqCache = { at: Date.now(), sheet }
  return sheet
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  try {
    if (url.pathname === '/') return send(res, 200, page())

    if (url.pathname === '/nexon-login-button.png') {
      return send(res, 200, readFileSync(join(DIR, 'nexon-login-button.png')), 'image/png')
    }

    if (url.pathname.startsWith('/assets/')) {
      const file = normalize(join(DIR, url.pathname))
      if (!file.startsWith(join(DIR, 'assets')) || !existsSync(file)) return send(res, 404, 'not found', 'text/plain')
      return send(res, 200, readFileSync(file), TYPES[extname(file)] ?? 'application/octet-stream')
    }

    if (url.pathname === '/faq.json') return send(res, 200, JSON.stringify(await signInFaq()), 'application/json')

    if (url.pathname === '/login') {
      const { status, body } = await post('/v1/auth/nexon/login', { platform: 'web' })
      if (status >= 300 || !body?.authorizeUrl) {
        console.error('로그인 시작 실패', status, body)
        return send(res, 200, page(fail(`서버 ${status}`)))
      }
      pendingRedeemKey = body.redeemKey
      res.writeHead(302, { location: body.authorizeUrl, 'cache-control': 'no-store' })
      return res.end()
    }

    if (url.pathname === '/auth/nexon/done') {
      const receipt = url.searchParams.get('receipt')
      const errorName = url.searchParams.get('error_name')
      if (errorName === 'user_cancel_consent') return send(res, 200, page('<p class="result err">동의 화면에서 취소했어요.</p>'))
      if (!receipt || !pendingRedeemKey) return send(res, 200, page(fail(errorName)))
      // 서버가 아직 콜백을 처리하는 중이면 pending 이다. 앱처럼 1초 간격으로 다시 묻는다.
      for (let i = 0; i < 30; i++) {
        const { status, body } = await post('/v1/auth/nexon/session', { redeemKey: pendingRedeemKey, receipt })
        if (body?.status === 'ok') {
          pendingRedeemKey = null
          // 세션 값은 화면에 내지 않는다. 받았는지만 알린다.
          return send(res, 200, page(ok()))
        }
        if (body?.status !== 'pending') return send(res, 200, page(fail(body?.status ?? `서버 ${status}`)))
        await sleep(1000)
      }
      return send(res, 200, page(fail('시간 초과')))
    }

    send(res, 404, 'not found', 'text/plain; charset=utf-8')
  } catch (error) {
    console.error(error)
    send(res, 200, page(fail()))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`http://localhost:${PORT} · 서버 ${API}`)
})
