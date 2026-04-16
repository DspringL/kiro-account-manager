import { showError } from './toast.jsx'

/**
 * 统一错误日志与用户提示
 * @param {string} context 业务上下文，如“加载 MCP 配置失败”
 * @param {unknown} error 原始错误对象
 * @param {{ userMessage?: string }} options 可选用户提示
 */
export function handleUiError(context, error, options = {}) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[${context}]`, error)
  if (options.userMessage) {
    showError(options.userMessage)
  }
  return message
}
