import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('App startup does not gate the whole shell behind auth loading', async () => {
  const source = await readFile(new URL('./App.jsx', import.meta.url), 'utf8')

  assert.match(source, /const url = new URL\(window\.location\.href\)/)
  assert.doesNotMatch(source, /const \[loading, setLoading\] = useState\(true\)/)

  assert.doesNotMatch(source, /setLoading\(false\)/)
  assert.match(source, /useEffect\(\(\) => \{\s*requestAnimationFrame\(\(\) => \{\s*dismissBootSplash\(\)\s*\}\)\s*\}, \[\]\)/)
})
