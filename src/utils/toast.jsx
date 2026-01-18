// Toast 通知工具
import toast from 'react-hot-toast'

/**
 * 成功提示
 */
export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#10b981',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
    ...options,
  })
}

/**
 * 错误提示
 */
export const showError = (message, options = {}) => {
  return toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#ef4444',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
    ...options,
  })
}

/**
 * 警告提示
 */
export const showWarning = (message, options = {}) => {
  return toast(message, {
    duration: 3500,
    position: 'top-center',
    icon: '⚠️',
    style: {
      background: '#f59e0b',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
    ...options,
  })
}

/**
 * 普通提示
 */
export const showInfo = (message, options = {}) => {
  return toast(message, {
    duration: 3000,
    position: 'top-center',
    icon: 'ℹ️',
    style: {
      background: '#3b82f6',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
    ...options,
  })
}

/**
 * 加载提示
 */
export const showLoading = (message = '加载中...', options = {}) => {
  return toast.loading(message, {
    position: 'top-center',
    style: {
      background: '#6366f1',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
    ...options,
  })
}

/**
 * Promise 提示（自动处理成功/失败）
 */
export const showPromise = (promise, messages = {}) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || '处理中...',
      success: messages.success || '操作成功',
      error: messages.error || '操作失败',
    },
    {
      position: 'top-center',
      style: {
        borderRadius: '12px',
        padding: '12px 20px',
      },
    }
  )
}

/**
 * 确认对话框（使用 Toast）
 */
export const showConfirm = (message, onConfirm, onCancel) => {
  return toast(
    (t) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              toast.dismiss(t.id)
              onCancel?.()
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
            style={{ color: 'var(--toast-text, #000)' }}
          >
            取消
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id)
              onConfirm?.()
            }}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
          >
            确认
          </button>
        </div>
      </div>
    ),
    {
      duration: Infinity,
      position: 'top-center',
      style: {
        background: 'var(--toast-bg, #fff)',
        color: 'var(--toast-text, #000)',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '300px',
      },
    }
  )
}

export default toast
