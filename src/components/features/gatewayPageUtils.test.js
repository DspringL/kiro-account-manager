import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGatewayBaseUrl, buildGatewayConnectHost, createGatewayFieldErrors, formatGatewayAccountOptionLabel } from './gatewayPageUtils.js'

test('formatGatewayAccountOptionLabel prefers email over verbose label for current account display', () => {
  const label = formatGatewayAccountOptionLabel({
    label: 'Kiro BuilderId 账号',
    email: 'hjj09903+260205210415kv6h@gmail.com',
    userId: 'd-9067642ac7.945864e8-00e1-7095-94d3-eb71ba0e2398',
    id: '0d24370c-1111-2222-3333-444455556666',
    status: 'active',
  })

  assert.equal(label, 'hjj09903+260205210415kv6h@gmail.com')
})

test('formatGatewayAccountOptionLabel falls back to userId only when email is missing', () => {
  assert.equal(
    formatGatewayAccountOptionLabel({
      label: 'Kiro BuilderId 账号',
      userId: 'builder-user-1',
      id: '0d24370c-1111-2222-3333-444455556666',
    }),
    'builder-user-1'
  )

  assert.equal(
    formatGatewayAccountOptionLabel({
      label: 'Kiro BuilderId 账号',
      id: '0d24370c-1111-2222-3333-444455556666',
    }),
    '未知账号'
  )
})

test('createGatewayFieldErrors rejects unsupported host values', () => {
  const errors = createGatewayFieldErrors({
    host: 'bad host',
    port: 8765,
    apiKey: 'sk-test',
    region: 'us-east-1',
    accountMode: 'single',
    accountId: 'account-1',
    groupId: null,
    allowedIpsText: '',
  })

  assert.equal(errors.host, '监听地址必须是 localhost、IPv4 或 IPv6 地址')
})

test('buildGatewayConnectHost maps wildcard binds to a usable client host', () => {
  assert.equal(buildGatewayConnectHost('0.0.0.0', true), '127.0.0.1')
  assert.equal(buildGatewayConnectHost('0.0.0.0', false), 'localhost')
  assert.equal(buildGatewayConnectHost('::', false), 'localhost')
})

test('buildGatewayBaseUrl brackets ipv6 addresses for clients', () => {
  assert.equal(buildGatewayBaseUrl('::1', 8765, true), 'http://[::1]:8765')
  assert.equal(buildGatewayBaseUrl('0.0.0.0', 8765, false), 'http://localhost:8765')
})
