import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { openContext, scalar, signIn, trackProblems } from './helpers'

/**
 * A file chosen in the portal goes up on its own request before the form is submitted, so the browser can count the bytes that have really left.
 * The button shows that count; a connection kept slow on purpose makes the intermediate values visible.
 */
test('an upload shows the bytes really sent, then the stored result', async ({ browser }) => {
  test.setTimeout(180_000)
  const problems: string[] = []
  const { context, page } = await openContext(browser)
  trackProblems(page, 'admin', problems, { strict4xx: true, benign: /Content Security Policy/ })   // the test server's stand-in storage is not an allowed image host
  await signIn(page)

  // Noise does not compress: about 2 MB of PNG, which a 400 KB/s connection needs several seconds to send.
  const noise = Buffer.alloc(900 * 700 * 3)
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24
  const file = await sharp(noise, { raw: { width: 900, height: 700, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer()
  expect(file.length).toBeGreaterThan(1_500_000)

  await page.goto('/admin/media', { waitUntil: 'networkidle' })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: -1, uploadThroughput: 400 * 1024 })
  await page.setInputFiles('input[name=image]', { name: 'big.png', mimeType: 'image/png', buffer: file })
  await page.fill('input[name=alt]', 'Noise test image')
  const button = page.locator('button:has-text("Upload"), button.is-busy').first()
  await button.click({ noWaitAfter: true })

  const seen: number[] = []
  const deadline = Date.now() + 40_000
  while (Date.now() < deadline) {
    const text = (await page.locator('button.is-busy').first().innerText({ timeout: 500 }).catch(() => '')) || ''
    const m = text.match(/(\d+)%/)
    if (m) seen.push(Number(m[1]))
    if (/Memeriksa dan menyimpan/.test(text) || page.url().includes('notice=')) break
    await page.waitForTimeout(150)
  }
  const middle = seen.filter((n) => n > 0 && n < 100)
  expect(new Set(middle).size, `percentages seen: ${seen.join(',')}`).toBeGreaterThanOrEqual(2)
  expect([...seen].sort((a, b) => a - b), 'the count never goes backwards').toEqual(seen)

  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await expect(page.locator('.alert, .toast, [role=status]').filter({ hasText: 'Image uploaded' }).first()).toBeVisible({ timeout: 40_000 })
  expect(await scalar(`select size from media where filename = 'big.png' order by id desc limit 1`)).toBe(String(file.length))

  expect(problems.filter((p) => !/Failed to load resource/.test(p))).toEqual([])
  await context.close()
})
