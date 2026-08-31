// 글자 배수 클램프가 **빠짐없이 걸려 있는가**([[ADR-152]] 결정 4·5).
//
// ## 왜 정책 테스트인가 — 회귀가 «깨지는» 모양이 아니라 «빠지는» 모양으로 온다
//
// 클램프는 프롭 둘(`allowFontScaling`·`maxFontSizeMultiplier`)로 걸리고, 그 프롭은 **글자를 그리는
// 자리마다** 있어야 한다. 한 자리가 `react-native` 에서 `Text` 를 직접 가져오면 그 자리만 조용히
// OS 배수를 그대로 받는다 — 화면은 멀쩡히 뜨고, 스냅샷도 초록이고(기본 배수 1.0 에서는 그림이
// 같다), 시스템 글자 크기를 바꾼 기기에서만 어긋난다. 즉 **개발 기기에서는 안 보이는** 종류의
// 회귀다.
//
// ESLint 에도 같은 규칙이 있다(`no-restricted-imports`). 두 벌인 이유는 린트가 «고치는 순간»
// 알려 주고 이 테스트가 «CI 에서» 막기 때문이고, 무엇보다 아래 두 번째 계약(위젯의 `fixed`)은
// 린트로 표현할 수 없기 때문이다.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const SRC = join(__dirname, '..')

/** 이 규칙의 **유일한 예외** — 클램프를 실제로 거는 곳이라 원본을 가져와야 한다. */
const ATOM = join(SRC, 'components', 'atoms', 'Text', 'Text.tsx')

/**
 * 칸에 묶여 글자를 못 키우는 자리([[ADR-152]] 결정 5) — **여기의 `<Text>` 는 전부 `fixed` 다.**
 *
 * 넷뿐인 것이 계약이다. 새 자리를 더할 때는 ADR 의 기준(«상자가 글자를 따라 커지는가»)을 통과해야
 * 하고, 그 판단이 이 배열에 남는다.
 */
const FIXED_BOX_PATHS = [
  join(SRC, 'app', 'today', 'widgets'),
  join(SRC, 'navigation', 'BottomBar.tsx'),
  join(SRC, 'components', 'molecules', 'CharacterRail', 'CharacterPortrait.tsx'),
  join(SRC, 'components', 'atoms', 'Badge', 'Badge.tsx'),
]

/** 위 목록을 파일로 편다 — 항목이 디렉터리일 수도 파일일 수도 있다. */
function fixedBoxFiles(): string[] {
  return FIXED_BOX_PATHS.flatMap((path) =>
    statSync(path).isDirectory() ? sourceFiles(path) : [path],
  )
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry !== '__tests__' && entry !== '__snapshots__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/** `import { … } from 'react-native'` 의 이름들. `type` 접두는 값이 아니므로 뺀다. */
function reactNativeImportNames(source: string): string[] {
  const names: string[] = []
  const pattern = /import\s*\{([^}]*)\}\s*from\s*'react-native'/g
  for (const match of source.matchAll(pattern)) {
    for (const raw of match[1].split(',')) {
      const specifier = raw.trim()
      if (specifier !== '' && !specifier.startsWith('type ')) names.push(specifier.split(/\s+/)[0])
    }
  }
  return names
}

/**
 * `<Text …>` 여는 태그의 속성 문자열을 전부 모은다.
 *
 * 정규식 하나로 `<Text([^>]*)>` 를 쓸 수 없다 — 속성 안의 화살표 함수(`onPress={() => …}`)에 `>`
 * 가 들어 있어 태그가 거기서 끊긴다. 그래서 중괄호 깊이를 세며 **깊이 0 의 `>`** 까지 걷는다.
 */
function openingTextTags(source: string): string[] {
  const tags: string[] = []
  const pattern = /<Text(?![A-Za-z])/g
  for (const match of source.matchAll(pattern)) {
    let depth = 0
    let end = match.index + match[0].length
    while (end < source.length) {
      const char = source[end]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) break
      end += 1
    }
    tags.push(source.slice(match.index + match[0].length, end))
  }
  return tags
}

const FILES = sourceFiles(SRC)

/** 글자를 그리는 자체 컴포넌트 파일 — 「`Text` atom 을 import 한다」가 곧 그 정의다. */
function textRenderingComponentFiles(): string[] {
  return sourceFiles(join(SRC, 'components')).filter(
    (file) => file !== ATOM && readFileSync(file, 'utf8').includes("/Text/Text'"),
  )
}

/**
 * 이 파일이 상대 경로로 가져오는 모듈들의 **절대 경로**.
 *
 * 이름(`<CharacterRow>`)이 아니라 경로로 판정한다 — 위젯 파일 안에 같은 이름의 **로컬 함수**가
 * 사는 경우가 실제로 있고(`WeeklyBossProfitWidget`), 이름만 보면 그것을 molecule 로 오인한다.
 */
function localImportTargets(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const out: string[] = []
  for (const match of source.matchAll(/from\s*'(\.[^']+)'/g)) {
    const base = join(dirname(file), match[1])
    for (const candidate of [`${base}.tsx`, `${base}.ts`]) {
      if (existsSync(candidate)) out.push(candidate)
    }
  }
  return out
}

describe('[[ADR-152]] 결정 4 — 글자는 atom 한 곳에서만 나온다', () => {
  it('훑을 파일이 있다 — 스캐너가 빈손이면 아래 단언이 전부 무의미하다', () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it('`react-native` 에서 `Text`·`TextInput` 을 직접 가져오는 곳은 atom 뿐이다', () => {
    const offenders = FILES.filter((file) => file !== ATOM)
      .filter((file) =>
        reactNativeImportNames(readFileSync(file, 'utf8')).some(
          (name) => name === 'Text' || name === 'TextInput',
        ),
      )
      .map((file) => relative(SRC, file))

    expect(offenders).toEqual([])
  })

  it('atom 은 원본을 가져온다 — 예외가 실제로 그 자리에 있다', () => {
    expect(reactNativeImportNames(readFileSync(ATOM, 'utf8'))).toEqual(
      expect.arrayContaining(['Text', 'TextInput']),
    )
  })

  /**
   * **`BottomSheetTextInput` 은 이제 아무 데도 안 쓴다**([[ADR-170]] 정정 10).
   *
   * 정정 5 는 시트를 올리려고 그것을 썼는데, 그 부품은 RN 의 입력이 아니라
   * `react-native-gesture-handler` 의 것을 감싼 것이고 그 층이 **안드로이드 한글 조합을 깼다**.
   * 지금은 아톰이 RN 입력을 그대로 그리고 시트가 보는 값(`animatedKeyboardState.target`)만 직접
   * 채운다.
   *
   * 막는 이유는 정정 5 때와 **같다** — 그 길로 들어오면 글자 크기 클램프가 빠지고, 이제는 한글
   * 조합까지 함께 깨진다. 둘 다 **개발 기기에서 안 보이는** 회귀다.
   */
  it('`BottomSheetTextInput` 은 어디에서도 안 쓴다', () => {
    const offenders = FILES.filter((file) =>
      readFileSync(file, 'utf8').includes('BottomSheetTextInput'),
    ).map((file) => relative(SRC, file))

    // 아톰의 주석은 «왜 안 쓰는가» 를 적으므로 이름이 나온다 — 코드가 아니라 글이다.
    expect(offenders.filter((file) => !file.endsWith('Text.tsx'))).toEqual([])
  })
})

describe('[[ADR-152]] 결정 5 — 칸에 묶인 글자는 `fixed` 다', () => {
  it('고정칸 넷의 `<Text>` 는 하나도 빠짐없이 `fixed` 를 단다', () => {
    const missing = fixedBoxFiles().flatMap((file) =>
      openingTextTags(readFileSync(file, 'utf8'))
        .filter((attributes) => !/(^|\s)fixed(\s|$|=)/.test(attributes))
        .map(() => relative(SRC, file)),
    )

    expect(missing).toEqual([])
  })

  it('고정칸이 쓰는 글자 컴포넌트도 고정칸이다 — 한 겹 아래에서 새는 자리를 막는다', () => {
    // `<Text fixed>` 만 검사하면 **자식 컴포넌트가 그리는 글자**가 그대로 샌다. 실제로 그렇게
    // 샜다: 76px 타일 안의 난이도 배지가 자기 `<Text>` 를 갖고 있어 배수를 그대로 받았다.
    // 그 컴포넌트들은 `fixed` 프롭을 받는 대신 **자기 자신이 고정칸**이어야 한다(상자가 `h-5` 처럼
    // 고정이라 어느 호출부에서도 글자를 못 키운다).
    const drawsText = new Set(textRenderingComponentFiles())
    const fixedBoxes = new Set(fixedBoxFiles())

    const leaking = fixedBoxFiles().flatMap((file) =>
      localImportTargets(file)
        .filter((target) => drawsText.has(target) && !fixedBoxes.has(target))
        .map((target) => `${relative(SRC, file)} → ${relative(SRC, target)}`),
    )

    expect([...new Set(leaking)]).toEqual([])
  })

  it('글자 컴포넌트를 실제로 찾아냈다 — 위 단언이 빈 표를 검사하는 것이 아니다', () => {
    expect(textRenderingComponentFiles().length).toBeGreaterThan(5)
  })

  it('위젯에서 실제로 글자를 그리고 있다 — 위 단언이 빈 목록을 검사하는 것이 아니다', () => {
    const tags = fixedBoxFiles().flatMap((file) =>
      openingTextTags(readFileSync(file, 'utf8')),
    )

    expect(tags.length).toBeGreaterThan(50)
  })
})
