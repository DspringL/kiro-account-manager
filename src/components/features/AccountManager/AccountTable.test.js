import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('AccountTable avoids dynamic row measurement that triggers virtual flushSync warnings', async () => {
  const source = await readFile(new URL('./AccountTable.jsx', import.meta.url), 'utf8')

  assert.match(source, /estimateSize:\s*\(\)\s*=>\s*320/)
  assert.doesNotMatch(source, /measureElement:\s*\(/)
  assert.doesNotMatch(source, /ref=\{rowVirtualizer\.measureElement\}/)
})
