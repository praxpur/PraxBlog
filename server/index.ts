/** 生产环境独立服务：托管 dist 静态文件 + /api。用法：pnpm build && pnpm start */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { apiMiddleware } from './api.ts'

const DIST = path.resolve(process.cwd(), 'dist')
const PORT = Number(process.env.PORT ?? 3000)
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml',
}

http
  .createServer((req, res) => {
    apiMiddleware(req, res, () => {
      const rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
      let file = path.join(DIST, rel)
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html') // 预渲染页面
      if (!file.startsWith(DIST) || !fs.existsSync(file)) file = path.join(DIST, '404.html') // 其余路径交给前端路由
      res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
      fs.createReadStream(file).pipe(res)
    })
  })
  .listen(PORT, () => console.log(`Blog running at http://localhost:${PORT}`))
