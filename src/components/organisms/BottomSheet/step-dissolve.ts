/**
 * 시트가 단계를 갈아탈 때 **언제 흐림을 세우나**.
 *
 * 어떻게 흐리는지는 `BottomSheet.tsx` 의 `StepVeil` 이 안다. 여기는 타이밍만 본다.
 * 떼어 낸 이유는 그 파일이 컴포넌트만 내보내야 패스트 리프레시가 살기 때문이다
 * (`react-refresh/only-export-components`).
 */
import { useCallback, useState } from 'react'

/**
 * 단계가 갈릴 때 **시트 전체가 흐려졌다 걷힌다**.
 *
 * 머리도 바닥 줄도 같은 흐림 밑에 들어간다. 내용만 갈아 들면 제목이 튄다.
 *
 * **내용은 안 붙든다.** 흐림이 짙어지는 동안 옛 화면을 세워 두려면 그만큼 내용을 늦게 갈아야
 * 하는데, 그러면 시트가 값을 늦게 받는 부품이 된다(테스트 237개가 그 시간만큼 어긋났다).
 * 대신 흐림을 **첫 프레임에 짙게 얹고** 걷어 낸다. 갈리는 장면이 그 밑에 묻히고, 눈에는 시트가
 * 초점을 잃었다 되찾는 것으로 읽힌다.
 *
 * `stepKey` 를 안 주면 아무 일도 안 한다.
 */
export function useStepDissolve(stepKey: string | undefined): {
  /** 흐림 층이 서 있나. */
  busy: boolean
  /** 몇 번째 갈아탐인가. 흐림 층의 `key` 로 쓴다. 단계마다 층을 새로 세워야 한다. */
  turn: number
  /** 다 걷혔다고 알린다. 흐림 층이 부르고, 그러면 층이 트리에서 빠진다. */
  done: () => void
} {
  const [dissolving, setDissolving] = useState(false)
  const [turn, setTurn] = useState(0)
  /** 마지막으로 그린 단계. ref 가 아니라 상태인 것은 **그리는 중에 읽기 때문**이다. */
  const [seen, setSeen] = useState(stepKey)

  if (stepKey !== undefined && seen !== stepKey) {
    /*
      **그리는 중에 세운다. 효과로 미루면 안 된다.** 효과는 커밋 뒤에 도는데, 그 커밋에는 이미
      새 단계가 들어 있고 흐림은 아직 없다. 그 한 장이 그대로 화면에 나가 **새 화면이 또렷하게
      번쩍인다**(사용자 보고. 60fps 녹화에서 두 장 확인했고, 첫 장은 아이콘도 아직 안 붙어
      있었다). 여기서 세우면 React 가 커밋하기 전에 이 컴포넌트를 다시 그리므로, 새 단계가
      들어간 첫 커밋에 흐림이 함께 있다.
    */
    setSeen(stepKey)
    setDissolving(true)
    setTurn((count) => count + 1)
  }

  const done = useCallback(() => {
    setDissolving(false)
  }, [])

  return { busy: dissolving, turn, done }
}
