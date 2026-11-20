import { getClipboardPort } from './ports'

/**
 * 글자를 클립보드에 넣는 함수. OS 가 거절하면 던진다.
 *
 * @example
 * await copyText(String(transfer))
 */
export function copyText(text: string): Promise<void> {
  return getClipboardPort().setText(text)
}

/** 복사하면 OS 가 스스로 알림을 띄우는 기기인지. 이 기기에서는 앱이 성공을 또 알리지 않는다. */
export function systemAnnouncesCopy(): boolean {
  return getClipboardPort().announcesCopy()
}
