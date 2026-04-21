import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { MantineProvider } from '@mantine/core'
import react from '@vitejs/plugin-react'
import {
  getAdvancedProps,
  getIntegrationProps,
  getObservabilityProps,
  getOverviewProps,
} from './gatewayComponentTestFixtures.mjs'

let viteServer
let GatewayOverview
let GatewayIntegration
let GatewayAdvanced
let GatewayObservability

function renderComponent(Component, props) {
  return renderToStaticMarkup(
    React.createElement(
      MantineProvider,
      null,
      React.createElement(Component, props)
    )
  )
}

before(async () => {
  viteServer = await createServer({
    configFile: false,
    appType: 'custom',
    clearScreen: false,
    plugins: [react()],
    server: {
      middlewareMode: true,
      hmr: false,
      ws: false,
      watch: null,
    },
  })

  GatewayOverview = (await viteServer.ssrLoadModule('/src/components/features/Gateway/GatewayOverview.jsx')).default
  GatewayIntegration = (await viteServer.ssrLoadModule('/src/components/features/Gateway/GatewayIntegration.jsx')).default
  GatewayAdvanced = (await viteServer.ssrLoadModule('/src/components/features/Gateway/GatewayAdvanced.jsx')).default
  GatewayObservability = (await viteServer.ssrLoadModule('/src/components/features/Gateway/GatewayObservability.jsx')).default
})

after(async () => {
  await viteServer?.close()
})

test('GatewayOverview renders summary cards and risk state', () => {
  const html = renderComponent(GatewayOverview, getOverviewProps())

  assert.match(html, /控制台总览/)
  assert.match(html, /http:\/\/127\.0\.0\.1:8765/)
  assert.match(html, /已配置 2 个客户端 Key/)
  assert.match(html, /upstream timeout/)
})

test('GatewayIntegration renders protocol matrix and code samples', () => {
  const html = renderComponent(GatewayIntegration, getIntegrationProps())

  assert.match(html, /接入指南/)
  assert.match(html, /Protocol Surface/)
  assert.match(html, /curl http:\/\/127\.0\.0\.1:8765\/v1\/responses/)
  assert.match(html, /Authorization: Bearer sk-primary/)
})

test('GatewayAdvanced renders multi-key form and routing controls', () => {
  const html = renderComponent(GatewayAdvanced, getAdvancedProps())

  assert.match(html, /高级配置/)
  assert.match(html, /客户端 API Keys/)
  assert.match(html, /sk-primary/)
  assert.match(html, /账号来源与路由/)
})

test('GatewayObservability renders highlights, metrics and request details', () => {
  const html = renderComponent(GatewayObservability, getObservabilityProps())

  assert.match(html, /观测总览/)
  assert.match(html, /gateway-request-log\.jsonl/)
  assert.match(html, /rate limited/)
  assert.match(html, /原始请求/)
  assert.match(html, /\/v1\/responses/)
})
