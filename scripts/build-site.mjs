// mapleroutine.store 정적 사이트 빌드.
//
// 스토어가 요구하는 개인정보 처리방침·지원 URL을 서빙하는 것이 이 사이트의 존재 이유다.
// 앱 번들(vite)과는 완전히 별개로 돌아가며 dist-site/ 로 나간다.
//
// **개인정보 처리방침은 저장소 루트의 PRIVACY.md 하나가 원본이다.** 웹용 사본을 따로 두면
// 법적 문서가 두 벌이 되어 서로 다른 내용을 말하게 되므로, 여기서 렌더링해서 쓴다.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(ROOT, 'site')
const OUT = join(ROOT, 'dist-site')

const DOMAIN = 'mapleroutine.store'

/** 출력 경로 → 마크다운 원본. `privacy` 만 저장소 루트를 가리킨다(단일 원본). */
const PAGES = [
  { out: 'index.html', source: join(SITE, 'index.md') },
  { out: 'support/index.html', source: join(SITE, 'support.md') },
  { out: 'privacy/index.html', source: join(ROOT, 'PRIVACY.md') },
]

/**
 * 마크다운 상단의 HTML 주석에서 메타데이터를 읽는다.
 *
 * 프런트매터(`---`) 대신 주석을 쓰는 이유는 PRIVACY.md 때문이다 — 그 파일은 GitHub에서도
 * 그대로 읽히는 문서라, 렌더링되지 않는 `---` 블록이 맨 위에 붙으면 안 된다. 주석은 양쪽에서
 * 조용하다.
 */
function extractMeta(markdown) {
  const match = markdown.match(/^<!--([\s\S]*?)-->/)
  if (match === null) {
    return { meta: {}, body: markdown }
  }

  const meta = {}
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^\s*(title|description):\s*(.+?)\s*$/)
    if (pair !== null) {
      meta[pair[1]] = pair[2]
    }
  }
  return { meta, body: markdown.slice(match[0].length) }
}

/** 첫 `# 제목` 을 폴백 title 로 쓴다 — PRIVACY.md 처럼 메타 주석이 없는 문서를 위해서다. */
function firstHeading(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? '메이플 루틴'
}

function escapeHtml(text) {
  return text.replace(
    /[&<>"]/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
  )
}

// 표는 좁은 화면에서 페이지 전체를 가로로 밀어버린다. 스스로 스크롤하는 상자로 감싼다.
function wrapTables(html) {
  return html.replace(/<table>[\s\S]*?<\/table>/g, (table) => `<div class="table-scroll">${table}</div>`)
}

async function build() {
  const template = await readFile(join(SITE, 'template.html'), 'utf8')

  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })

  for (const page of PAGES) {
    const raw = await readFile(page.source, 'utf8')
    const { meta, body } = extractMeta(raw)
    const title = meta.title ?? firstHeading(body)
    const description = meta.description ?? '메이플스토리 루틴 관리 앱, 메이플 루틴'

    const html = template
      .replace('{{title}}', escapeHtml(title))
      .replace('{{description}}', escapeHtml(description))
      .replace('{{content}}', wrapTables(marked.parse(body)))

    const target = join(OUT, page.out)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, html, 'utf8')
    console.log(`  ${page.out}  ←  ${page.source.replace(ROOT + '/', '')}`)
  }

  // 정적 자산 복사(현재는 style.css 하나). 마크다운·템플릿은 소스라 내보내지 않는다.
  for (const name of await readdir(SITE)) {
    if (name.endsWith('.md') || name === 'template.html') continue
    await writeFile(join(OUT, name), await readFile(join(SITE, name)))
    console.log(`  ${name}`)
  }

  // GitHub Pages 커스텀 도메인. 이 파일이 없으면 배포 때마다 도메인 설정이 풀린다.
  await writeFile(join(OUT, 'CNAME'), `${DOMAIN}\n`, 'utf8')

  // Jekyll 처리를 끈다 — 밑줄로 시작하는 경로를 삼키는 등 정적 산출물을 건드리지 않게 한다.
  await writeFile(join(OUT, '.nojekyll'), '', 'utf8')

  console.log(`\n사이트 빌드 완료 → dist-site/ (https://${DOMAIN})`)
}

await build()
