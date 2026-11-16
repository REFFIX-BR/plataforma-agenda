const http = require("http")
const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.resolve(projectRoot, "../../packages/core"),
  path.resolve(projectRoot, "../../packages/theme"),
]
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")]

const forwardApi = config.server?.enhanceMiddleware
config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const base = forwardApi ? forwardApi(middleware, server) : middleware
    return (req, res, next) => {
      const url = req.url || ""
      if (!url.startsWith("/api")) return base(req, res, next)
      const headers = { ...req.headers, host: "127.0.0.1:3001" }
      const proxy = http.request(
        { hostname: "127.0.0.1", port: 3001, path: url, method: req.method, headers },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
          proxyRes.pipe(res)
        },
      )
      proxy.on("error", () => {
        if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" })
        res.end(JSON.stringify({ error: "A agenda não está aberta neste computador." }))
      })
      req.pipe(proxy)
    }
  },
}

module.exports = config
