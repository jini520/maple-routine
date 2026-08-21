// 테마와 무관한 축(간격·radius·container)의 값을 지킨다([[ADR-128]] 3단계 → [[ADR-155]] 결정 4).
//
// 이 축들은 원래 **웹의 Tailwind v4** 에서 판 값이었다. 그 웹이 사라지면서 값은 `tailwind-v4-axes.cjs`
// 에 동결됐고, 저장소가 무는 Tailwind 는 이제 NativeWind 용 v3 하나뿐이다. 그래서 이 테스트가 답하는
// 질문도 «두 메이저가 갈리지 않았나» 에서 **«동결한 값이 그대로인가»** 로 바뀌었다 — 여기가 흔들리면
// `h-13`·`max-w-2xs` 같은 클래스가 **빌드가 성공한 채로** 화면에서만 사라진다.
//
// 대조 대상은 **문서가 못박은 실제 수치**다 — 288(파티 인원 모달 폭 하한, [[ADR-121]])·88(히어로
// 높이)처럼 사람이 정한 값들이라, 파생 코드를 다시 파싱해 비교하는 순환에 빠지지 않는다.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '../..')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const axes = require('../../tailwind-v4-axes.cjs') as {
  SPACING_STEP: number
  theme: {
    spacing: Record<string, string>
    borderRadius: Record<string, string>
    maxWidth: Record<string, string>
    minWidth: Record<string, string>
  }
}

function resolvedTailwindVersion(fromPackageDir: string): string {
  const require_ = createRequire(path.join(fromPackageDir, 'noop.js'))
  return JSON.parse(readFileSync(require_.resolve('tailwindcss/package.json'), 'utf8')).version
}

describe('Tailwind 메이저 배치', () => {
  // NativeWind 는 루트로 호이스팅되고 Node 해석은 **위로만** 걷는다. 그래서 그가 집는 것은 저장소
  // 루트의 tailwindcss 이고, 그것이 v3 여야 한다(v4 면 `"NativeWind only supports Tailwind CSS v3"`
  // 로 Metro 가 아예 안 뜬다 — 이쪽은 요란한 실패지만, 왜 루트가 v3 인지를 여기 적어 둔다).
  it('NativeWind 가 집는 루트는 v3 다', () => {
    expect(resolvedTailwindVersion(repoRoot)).toMatch(/^3\./)
  })
})

describe('v4 축 파생', () => {
  it('간격 배수가 v4 기본값(0.25rem)이다', () => {
    expect(axes.SPACING_STEP).toBe(0.25)
  })

  // v3 고정 계단에는 없는 값들 — 파생이 끊기면 클래스가 통째로 사라진다.
  it.each([
    ['4', '1rem'], // p-4 — 화면 패딩(design-system «레이아웃»)
    ['13', '3.25rem'], // h-13
    ['22', '5.5rem'], // h-22 — 파티 인원 모달 히어로 88 ([[ADR-121]])
    ['2.5', '0.625rem'], // py-2.5 — 버튼(design-system «기본 컴포넌트»)
  ])('spacing[%s] = %s', (key, expected) => {
    expect(axes.theme.spacing[key]).toBe(expected)
  })

  // 288 은 4난이도 칩 한 줄이 안 접히는 하한이고 전 기기에서 폭이 같다는 성질도 갖는다([[ADR-121]]).
  it('max-w-2xs 가 288px 다', () => {
    expect(axes.theme.maxWidth['2xs']).toBe('18rem')
  })

  // v3 는 `rounded-sm` 이 2px, v4 는 4px 다. 지금 코드가 안 쓰는 계단이지만 step 3~6 에서 누가 쓰면
  // 조용히 두 배가 되는 자리라 v4 쪽으로 못박는다.
  it('rounded 계단이 v4 기준이다', () => {
    expect(axes.theme.borderRadius).toMatchObject({
      xs: '0.125rem',
      sm: '0.25rem',
      full: '9999px',
    })
  })
})
