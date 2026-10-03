/** In-process Vite lifecycle avoids Windows taskkill-based webServer teardown. */
export default async function setup() {
  process.env.VISUAL_PREVIEW_PORT = '5181'
  const { default: server } = await import('../visual-preview.mjs')
  return async () => { await server.close() }
}
