// MCP 服务器预设模板

export const MCP_TEMPLATES = {
  fetch: {
    command: 'uvx',
    args: ['mcp-server-fetch'],
    env: {},
    disabled: false,
    autoApprove: ['fetch']
  },
  memory: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    env: {},
    disabled: false,
    autoApprove: []
  },
  context7: {
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    env: {},
    disabled: false,
    autoApprove: []
  },
  thinking: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: {},
    disabled: false,
    autoApprove: ['sequentialthinking']
  },
  'chrome-devtools': {
    command: 'npx',
    args: [
      '-y',
      'chrome-devtools-mcp@latest',
      '--channel=stable',
      '--headless=false',
      '--isolated=true',
      '--viewport=1920x1080',
      '--chromeArg=--incognito'
    ],
    env: {
      SystemRoot: 'C:\\Windows',
      PROGRAMFILES: 'C:\\Program Files'
    },
    disabled: false,
    autoApprove: [
      'take_snapshot',
      'take_screenshot',
      'list_pages',
      'new_page',
      'select_page',
      'close_page',
      'navigate_page',
      'click',
      'fill',
      'fill_form',
      'hover',
      'drag',
      'press_key',
      'wait_for',
      'handle_dialog',
      'evaluate_script',
      'list_console_messages',
      'get_console_message',
      'list_network_requests',
      'get_network_request'
    ]
  }
}
