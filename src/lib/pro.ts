const KEY = 'plotkeep.pro'

export const PRO_DEMO_KEY = 'PLOTKEEP-PRO'
export const PRO_PRICE = '$29'
export const PRO_PRICE_NOTE = 'one-time, per operator, honor-system license idea — this build does not take payment'

export function isProUnlocked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function unlockPro(code: string): boolean {
  const ok = code.trim().toUpperCase() === PRO_DEMO_KEY
  if (ok) localStorage.setItem(KEY, '1')
  return ok
}

export function lockPro(): void {
  localStorage.removeItem(KEY)
}
