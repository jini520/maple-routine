import { getStatusBarPort } from './ports'

export async function setStatusBarStyle(isDarkTheme: boolean): Promise<void> {
  await getStatusBarPort().setStyle(isDarkTheme)
}
