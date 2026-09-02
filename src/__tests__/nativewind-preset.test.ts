/**
 * jest 와 Metro 가 **같은 프리셋으로** 컴파일하는지 지킨다.
 *
 * NativeWind 는 `NATIVEWIND_OS` 가 없거나 `web` 이면 web 프리셋으로 컴파일한다
 * (`nativewind/dist/tailwind/index.js`). Metro 는 `options.platform` 을 넣지만 jest 는 아무도 안
 * 넣고 있었고, 그래서 테스트가 앱과 **다른 값**을 봤다 — `invisible` 이 `opacity` 가 아니라
 * `visibility` 로, `shadow` 가 `elevation` 이 아니라 `box-shadow` 로 나왔다.
 *
 * **이 어긋남은 조용하다.** 클래스 이름이 같아 테스트는 초록인데 앱은 다른 그림을 그린다.
 * `nativewind.config.js` 머리가 못박은 둘이 같은 값으로 컴파일한다 를 여기서 검사한다.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

/** `global.css` 를 그 플랫폼 프리셋으로 컴파일해 돌려준다. */
function compile(platform: string): string {
  const out = join(mkdtempSync(join(tmpdir(), 'nw-preset-')), 'out.css')
  const script = `
    const {readFileSync,writeFileSync}=require('node:fs'),path=require('node:path')
    const postcss=require('postcss'),tailwindcss=require('tailwindcss')
    const input=path.join(${JSON.stringify(ROOT)},'global.css')
    postcss([tailwindcss({config:path.join(${JSON.stringify(ROOT)},'tailwind.config.js')})])
      .process(readFileSync(input,'utf8'),{from:input})
      .then(({css})=>writeFileSync(${JSON.stringify(out)},css))
  `
  execFileSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env: { ...process.env, NATIVEWIND_OS: platform },
  })
  return readFileSync(out, 'utf8')
}

/** 한 클래스의 선언 블록. 없으면 `null`. */
function ruleOf(css: string, selector: string): string | null {
  const at = css.indexOf(`${selector} {`)
  if (at === -1) return null
  return css.slice(at, css.indexOf('}', at)).replace(/\s+/g, ' ')
}

// 컴파일이 두 번 도는 무거운 스위트다 — 다른 스위트와 달리 타임아웃을 늘린다.
jest.setTimeout(120_000)

describe('NativeWind 프리셋', () => {
  const ios = compile('ios')

  it('jest 가 보는 값이 web 프리셋 산물이 아니다', () => {
    // web 프리셋에서만 나오는 형태 셋. 하나라도 보이면 `NATIVEWIND_OS` 가 안 세워진 것이다.
    expect(ruleOf(ios, '.invisible')).toContain('opacity')
    expect(ruleOf(ios, '.invisible')).not.toContain('visibility')
    expect(ruleOf(ios, '.line-clamp-2')).toContain('-rn-number-of-lines')
    expect(ios).not.toContain('::placeholder')
  })

  /**
   * **두 네이티브 플랫폼이 갈리는 자리는 여기뿐이다.** 컴파일 결과를 통째로 비교해 확인했고,
   * 안드로이드가 `elevation` 을 더하는 것 말고는 글자까지 같다. jest 는 iOS 로 도므로 이 세 값은
   * 테스트가 렌더로는 못 보고, 그래서 컴파일 결과를 직접 본다.
   */
  it('안드로이드는 그림자에 elevation 을 더한다 — iOS 에는 없다', () => {
    const android = compile('android')

    expect(ruleOf(android, '.shadow')).toContain('-rn-elevation: 3')
    expect(ruleOf(android, '.shadow-lg')).toContain('-rn-elevation: 8')
    expect(ruleOf(ios, '.shadow')).not.toContain('-rn-elevation')
    expect(ruleOf(ios, '.shadow-lg')).not.toContain('-rn-elevation')
  })

  it('그 밖에는 두 플랫폼이 같다 — 갈리는 자리가 늘면 여기서 걸린다', () => {
    const android = compile('android')

    /** 선택자 → 선언 집합. `elevation` 은 위 케이스가 지키므로 여기서 뺀다. */
    const rules = (css: string): Record<string, string[]> => {
      const out: Record<string, string[]> = {}
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const key = selector.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()
        if (key === '' || key === '.elevation') continue
        out[key] = body
          .split(';')
          .map((one) => one.replace(/\s+/g, ' ').trim())
          .filter((one) => one !== '' && !one.startsWith('-rn-elevation'))
          .sort()
      }
      return out
    }

    expect(rules(android)).toEqual(rules(ios))
  })
})
