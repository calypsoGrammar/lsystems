import { defineConfig } from 'vite'

export default defineConfig({
  base: '',
  // Several tests trace 130k-400k segments and assert their own 10 s budgets; the 5 s default fails them on a loaded machine.
  test: { testTimeout: 30_000 },
})
