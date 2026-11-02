import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// CAL-1516: the page must not load third-party scripts or styles (no CDN, no jQuery).
const external = /<(?:script|link)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\//i

describe('no external resources', () => {
  for (const file of ['index.html', 'dist/index.html']) {
    // dist/ is untracked (CAL-1554); only check it when a build is present.
    it.skipIf(!existsSync(file))(`${file} loads nothing from a CDN`, () => {
      const html = readFileSync(file, 'utf8')
      expect(html).not.toMatch(external)
      expect(html).not.toMatch(/jquery/i)
    })
  }
})
