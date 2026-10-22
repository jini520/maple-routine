// 앱 글자 배수가 **빠짐없이 걸려 있는가**.
//
// ## 왜 정책 테스트인가. 회귀가 **깨지는** 모양이 아니라 **빠지는** 모양으로 온다
//
// 배수는 글자 atom 두 개가 곱한다. 한 자리가 `react-native` 에서 `Text` 를 직접 가져오면 그 자리만
// 조용히 앱 설정을 안 받고 시스템 배수를 받는다. 화면은 멀쩡히 뜨고, 스냅샷도 초록이고(기본 단계
// 1.0 에서는 그림이 같다), 글자 크기를 바꾼 기기에서만 어긋난다. 즉 **개발 기기에서는 안 보이는**
// 종류의 회귀다.
//
// ESLint 에도 같은 규칙이 있다(`no-restricted-imports`). 두 벌인 이유는 린트가 **고치는 순간**
// 알려 주고 이 테스트가 **CI 에서** 막기 때문이고, 아래 두 번째 계약(SVG 글자)은 린트로 표현할 수
// 없기 때문이다.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')

/** 이 규칙의 예외. 배수를 실제로 곱하는 atom 둘이라 원본을 가져와야 한다. */
const ATOMS = [
  join(SRC, 'components', 'atoms', 'Text', 'Text.tsx'),
  join(SRC, 'components', 'atoms', 'TextInput', 'TextInput.tsx'),
]

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

const FILES = sourceFiles(SRC)

/** `src/` 의 모든 `.ts`·`.tsx`. `sourceFiles` 와 달리 `__tests__` 를 건너뛰지 않는다. */
function everyFile(dir: string = SRC): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...(entry === '__snapshots__' ? [] : everyFile(path)))
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

describe('글자는 atom 한 곳에서만 나온다', () => {
  it('훑을 파일이 있다. 스캐너가 빈손이면 아래 단언이 전부 무의미하다', () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it('`react-native` 에서 `Text`·`TextInput` 을 직접 가져오는 곳은 atom 뿐이다', () => {
    const offenders = FILES.filter((file) => !ATOMS.includes(file))
      .filter((file) =>
        reactNativeImportNames(readFileSync(file, 'utf8')).some(
          (name) => name === 'Text' || name === 'TextInput',
        ),
      )
      .map((file) => relative(SRC, file))

    expect(offenders).toEqual([])
  })

  it('atom 은 원본을 가져온다. 예외가 실제로 그 자리에 있다', () => {
    const imported = ATOMS.flatMap((atom) => reactNativeImportNames(readFileSync(atom, 'utf8')))

    expect(imported).toEqual(expect.arrayContaining(['Text', 'TextInput']))
  })

  /**
  * `BottomSheetTextInput` 은 아무 데도 안 쓴다.
   *
  * 그 부품은 RN 의 입력이 아니라 `react-native-gesture-handler` 의 것을 감싼 것이고, 그 층이
  * 안드로이드 한글 조합을 깬다. 지금은 시트에 치는 칸이 아예 없다. 칸은 시트 밖 입력 카드가
  * 받는다.
   *
  * 그 길로 들어오면 앱 글자 배수가 빠지고 한글 조합까지 함께 깨진다. 둘 다 개발
  * 기기에서 안 보이는 회귀다.
   */
  it('`BottomSheetTextInput` 은 어디에서도 안 쓴다. 테스트의 목에도 없다', () => {
    // **테스트까지 훑는다**(`FILES` 는 `__tests__` 를 건너뛴다). 시트의 키보드 배선을 걷은 뒤
    // 목 팩토리 열 곳에 그 이름이 남아 있었다. 쓰는 곳이 없어 아무 일도 안 했지만, 목에 있으면
    // 다음 사람이 그것을 써도 되는 줄 안다. 자라지 않게 여기서 막는다.
    const offenders = everyFile().filter((file) =>
      readFileSync(file, 'utf8').includes('BottomSheetTextInput'),
    ).map((file) => relative(SRC, file))

 // `왜 안 쓰는가`를 적는 주석에는 이름이 나온다. 코드가 아니라 글이다. 그 설명은 아톰에 있다.
    const 설명하는_파일 = ['components/atoms/TextInput/TextInput.tsx', '__tests__/font-scaling-policy.test.ts']
    expect(offenders.filter((file) => !설명하는_파일.includes(file))).toEqual([])
  })
})

/**
 * `react-native-svg` 의 `Text` 를 쓰는 파일. 차트 축 · 초상 이름처럼 atom 을 안 거치는 글자다.
 *
 * `import Svg, { Text as SvgText } from 'react-native-svg'` 처럼 이름을 바꿔 오므로 원래 이름으로 찾는다.
 */
function svgTextFiles(): string[] {
  return FILES.filter((file) =>
    [...readFileSync(file, 'utf8').matchAll(/import\s+(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*'react-native-svg'/g)].some(
      (match) => match[1].split(',').some((raw) => /^(Text|TSpan)(\s|$)/.test(raw.trim())),
    ),
  )
}

describe('atom 을 안 거치는 SVG 글자도 앱 배수를 받는다', () => {
  it('SVG 글자를 실제로 찾아냈다. 아래 단언이 빈 목록을 검사하는 것이 아니다', () => {
    expect(svgTextFiles().length).toBeGreaterThan(1)
  })

  it('SVG 글자를 그리는 파일은 모두 `useTextScale` 로 배수를 읽는다', () => {
    const missing = svgTextFiles()
      .filter((file) => !readFileSync(file, 'utf8').includes('useTextScale()'))
      .map((file) => relative(SRC, file))

    expect(missing).toEqual([])
  })
})
