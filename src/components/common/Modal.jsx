import { X } from 'lucide-react'
import { useApp } from '../../hooks/useApp'

/**
 * 统一的 Modal 容器组件
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - 是否显示
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.title - 标题
 * @param {string} props.subtitle - 副标题（可选）
 * @param {React.ReactNode} props.icon - 图标组件
 * @param {string} props.iconColor - 图标颜色类名（如 'text-blue-400'）
 * @param {string} props.gradientFrom - 渐变起始色（如 'blue-500'）
 * @param {string} props.gradientTo - 渐变结束色（如 'purple-500'）
 * @param {React.ReactNode} props.children - 内容区域
 * @param {React.ReactNode} props.footer - 底部按钮区域（可选）
 * @param {string} props.maxWidth - 最大宽度（默认 '600px'）
 * @param {string} props.maxHeight - 内容区最大高度（默认 '70vh'）
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-400',
  gradientFrom = 'blue-500',
  gradientTo = 'purple-500',
  children,
  footer,
  maxWidth = '600px',
  maxHeight = '70vh',
}) {
  const { colors } = useApp()

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`
          relative overflow-hidden
          ${colors.card} 
          rounded-2xl w-full
          shadow-2xl
          border ${colors.cardBorder}
        `}
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部渐变装饰 */}
        <div 
          className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b via-transparent to-transparent pointer-events-none"
          style={{ 
            backgroundImage: `linear-gradient(to bottom, rgba(var(--gradient-from), 0.1), transparent)`,
            '--gradient-from': `var(--${gradientFrom})` 
          }}
        />
        
        {/* 装饰性光晕 */}
        <div 
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-50"
          style={{
            background: `linear-gradient(135deg, rgba(var(--gradient-from), 0.2), rgba(var(--gradient-to), 0.1))`,
            '--gradient-from': `var(--${gradientFrom})`,
            '--gradient-to': `var(--${gradientTo})`
          }}
        />
        
        {/* Header */}
        <div className="relative px-12 pt-8 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {Icon && (
                <div 
                  className={`
                    w-12 h-12 rounded-2xl
                    flex items-center justify-center
                    ring-1 ${colors.ringColor}
                    shadow-lg
                  `}
                  style={{
                    background: `linear-gradient(135deg, rgba(var(--gradient-from), 0.2), rgba(var(--gradient-to), 0.1))`,
                    '--gradient-from': `var(--${gradientFrom})`,
                    '--gradient-to': `var(--${gradientTo})`
                  }}
                >
                  <Icon size={24} className={iconColor} strokeWidth={2} />
                </div>
              )}
              <div>
                <h2 className={`text-lg font-semibold ${colors.text} leading-tight`}>{title}</h2>
                {subtitle && (
                  <p className={`text-xs ${colors.textMuted} mt-0.5`}>{subtitle}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${colors.cardHover}`}
            >
              <X size={18} className={colors.textMuted} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="relative px-12 py-8 overflow-y-auto"
          style={{ maxHeight }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`relative px-12 py-6 ${colors.dialogFooter} flex justify-end gap-3`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 统一的按钮组件
 */
export function ModalButton({ 
  onClick, 
  disabled, 
  loading, 
  variant = 'primary', 
  children,
  icon: Icon,
  ...props 
}) {
  const { colors } = useApp()
  
  const variants = {
    primary: `
      bg-gradient-to-r from-blue-500 to-purple-600
      shadow-lg shadow-blue-500/30
      hover:opacity-90 hover:shadow-xl
      text-white
    `,
    secondary: colors.btnSecondary,
    success: `
      bg-gradient-to-r from-emerald-500 to-teal-600
      shadow-lg shadow-emerald-500/30
      hover:opacity-90 hover:shadow-xl
      text-white
    `,
    danger: `
      bg-gradient-to-r from-red-500 to-pink-600
      shadow-lg shadow-red-500/30
      hover:opacity-90 hover:shadow-xl
      text-white
    `,
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        px-6 py-2.5 text-sm font-medium rounded-xl
        disabled:opacity-50 disabled:cursor-not-allowed 
        flex items-center gap-2
        ${variants[variant]}
      `}
      {...props}
    >
      {loading && (
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {Icon && <Icon size={16} />}
      {children}
    </button>
  )
}
