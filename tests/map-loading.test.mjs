import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchMapStyle,
  mapInitializationMessage
} from '../src/utils/mapLoading.ts'

test('distinguishes missing style files from SPA HTML fallback and malformed styles', async () => {
  await assert.rejects(
    fetchMapStyle('/style', '', async () => new Response('', { status: 404 })),
    /HTTP 404/
  )
  await assert.rejects(
    fetchMapStyle('/style', '', async () => new Response('<html>app</html>')),
    /内容无效/
  )
  await assert.rejects(
    fetchMapStyle('/style', '', async () => new Response('{}')),
    /格式不正确/
  )
})

test('valid style is preserved and its provider key placeholder is filled', async () => {
  const style = await fetchMapStyle(
    '/style',
    'test-key',
    async () =>
      new Response(
        JSON.stringify({
          version: 8,
          sources: {
            test: { url: 'https://example.invalid/?key=__PROTOMAPS_KEY__' }
          },
          layers: []
        })
      )
  )
  assert.equal(style.sources.test.url, 'https://example.invalid/?key=test-key')
})

test('timeout cancels the style request and reports a retryable reason', async () => {
  await assert.rejects(
    fetchMapStyle(
      '/style',
      '',
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true
          })
        }),
      10
    ),
    /加载超时/
  )
  await assert.rejects(
    fetchMapStyle('/style', '', async () => {
      throw new TypeError('Failed to fetch')
    }),
    /无法连接/
  )
})

test('renderer startup and WebGL context errors do not look like content API failures', () => {
  assert.match(
    mapInitializationMessage(
      new Error('Failed to initialize WebGL'),
      'renderer'
    ),
    /图形渲染启动失败/
  )
  assert.match(
    mapInitializationMessage(new Error('worker startup failed'), 'renderer'),
    /渲染器启动失败/
  )
  assert.match(
    mapInitializationMessage(new Error('setup failed'), 'setup'),
    /初始化未完成/
  )
})
