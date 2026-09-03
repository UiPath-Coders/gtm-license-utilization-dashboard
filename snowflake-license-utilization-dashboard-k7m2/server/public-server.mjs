import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const entityId = '146eb717-2895-f111-9b33-7c1e521513a8'
const profile = 'license-portal'
const port = Number(process.env.PORT || 25173)
const uip = path.join(process.env.APPDATA, 'npm', 'uip.cmd')
let cache = { items: [], loadedAt: '', expires: 0 }

async function query(cursor) {
  const args = ['df','records','query',entityId,'--limit','1000','--profile',profile,'--output','json','--log-level','error']
  if (cursor) args.push('--cursor', cursor)
  const { stdout } = await exec(uip, args, { cwd: root, timeout: 90000, windowsHide: true, shell: true, maxBuffer: 20 * 1024 * 1024 })
  const parsed = JSON.parse(stdout)
  if (parsed.Result !== 'Success') throw new Error(parsed.Message || 'Data Fabric query failed')
  return parsed.Data
}

async function loadRows(force) {
  if (!force && cache.expires > Date.now()) return cache
  const first = await query()
  const items = [...first.Items]
  let cursor = first.NextCursor?.Value
  while (cursor) {
    const page = await query(cursor)
    items.push(...page.Items)
    cursor = page.NextCursor?.Value
  }
  cache = { items, loadedAt: new Date().toISOString(), expires: Date.now() + 5 * 60_000 }
  return cache
}

const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' }
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.pathname === '/api/license-utilization') {
      const data = await loadRows(url.searchParams.get('refresh') === '1')
      res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' })
      return res.end(JSON.stringify(data))
    }
    let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
    try { if (!(await stat(file)).isFile()) file = path.join(dist, 'index.html') } catch { file = path.join(dist, 'index.html') }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'x-content-type-options':'nosniff' })
    res.end(await readFile(file))
  } catch (error) {
    res.writeHead(500, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' })
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }))
  }
}).listen(port, '127.0.0.1', () => console.log(`Public license portal: http://localhost:${port}`))
