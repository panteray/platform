import type { Browser } from 'puppeteer-core'

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE

export async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import('puppeteer-core')

  if (IS_PROD) {
    const chromiumMod = await import('@sparticuz/chromium')
    const chromium = chromiumMod.default
    return puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  const execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}
