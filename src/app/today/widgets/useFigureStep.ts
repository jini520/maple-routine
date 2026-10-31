import { useEffect, useState } from 'react'
import { Image } from 'react-native'

import { LOOK_FRAMES, lookFrameUrl } from '../../../lib/character-look'
import { figureRestSteps, planFigureSteps, type FigureAction, type FigureStep } from './figure-motion'

/**
 * 프레임을 전부 미리 받았는지 내는 훅. 하나라도 못 받으면 계속 거짓이다.
 *
 * 움직이다가 비는 칸이 생기면 캐릭터가 깜빡이므로, 다 받기 전에는 움직이지 않는다.
 *
 * @param imageUrl 캐릭터 그림 주소. `null` 이면 받지 않는다
 * @returns 이 주소의 프레임을 다 받았으면 참
 */
export function useLookFramesReady(imageUrl: string | null): boolean {
  const [readyUrl, setReadyUrl] = useState<string | null>(null)

  useEffect(() => {
    if (imageUrl === null) return
    let cancelled = false

    Promise.all(LOOK_FRAMES.map((frame) => Image.prefetch(lookFrameUrl(imageUrl, frame))))
      .then((results) => {
        if (!cancelled && results.every(Boolean)) setReadyUrl(imageUrl)
      })
      .catch(() => {
        // 못 받으면 기본 그림 한 장으로 남는다. 알릴 일이 아니다.
      })

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  return imageUrl !== null && readyUrl === imageUrl
}

/**
 * 대기로 시작해 무작위 동작을 이어 가는 훅.
 *
 * @param running 움직여도 되면 참. 거짓이 되면 멈추고, 다시 참이 되면 대기부터 시작한다
 * @returns 지금 프레임. 멈춰 있으면 `null`
 */
export function useFigureStep(running: boolean): FigureStep | null {
  const [step, setStep] = useState<FigureStep | null>(null)

  useEffect(() => {
    if (!running) return

    let queue = figureRestSteps(Math.random)
    let last: FigureAction | null = null
    let timer: ReturnType<typeof setTimeout>

    const advance = (): void => {
      if (queue.length === 0) {
        const plan = planFigureSteps(last, Math.random)
        last = plan.action
        queue = plan.steps
      }
      const [next, ...rest] = queue
      queue = rest
      setStep(next)
      timer = setTimeout(advance, next.ms)
    }

    timer = setTimeout(advance, 0)
    return () => clearTimeout(timer)
  }, [running])

  return running ? step : null
}
