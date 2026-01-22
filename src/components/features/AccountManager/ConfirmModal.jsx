import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import {
  ModalRoot,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '../../ui/modal'
import { Button } from '../../ui/button'

/**
 * 通用确认/提示模态框
 * @param {string} type - 'confirm' | 'success' | 'error' | 'info'
 * @param {string} title - 标题
 * @param {string} message - 内容
 * @param {object} rawData - 原始响应数据（可选，用于展开查看）
 * @param {function} onConfirm - 确认回调
 * @param {function} onCancel - 取消回调
 * @param {string} confirmText - 确认按钮文字
 * @param {string} cancelText - 取消按钮文字
 */
function ConfirmModal({
  type = 'confirm',
  title,
  message,
  rawData,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  loading = false,
}) {
  const { t, colors } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Use i18n defaults if not provided
  const finalConfirmText = confirmText || t('common.ok')
  const finalCancelText = cancelText || t('common.cancel')

  const config = {
    confirm: {
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      iconBg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/10',
      btnVariant: 'primary',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-gradient-to-br from-emerald-500/20 to-green-500/10',
      btnVariant: 'success',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-400',
      iconBg: 'bg-gradient-to-br from-red-500/20 to-rose-500/10',
      btnVariant: 'danger',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-400',
      iconBg: 'bg-gradient-to-br from-blue-500/20 to-indigo-500/10',
      btnVariant: 'primary',
    },
  }

  const { icon: Icon, iconColor, iconBg, btnVariant } = config[type]

  return (
    <ModalRoot open={true} onOpenChange={(open) => !open && onCancel()}>
      <ModalContent maxWidth="400px">
        <ModalHeader icon={Icon} iconColor={iconColor} iconBg={iconBg}>
          <ModalTitle>{title}</ModalTitle>
        </ModalHeader>

        <ModalDescription>
          <p className={`${colors.text} text-sm leading-relaxed whitespace-pre-line`}>
            {message}
          </p>
          
          {/* 原始响应展开区域 */}
          {rawData && (
            <div className="mt-4">
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1.5 text-xs ${colors.textMuted} hover:text-blue-500 transition-colors`}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? '收起原始响应' : '查看原始响应'}
              </button>
              {expanded && (
                <div className="mt-2 relative">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(rawData, null, 2))
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                    className={`absolute top-2 right-2 p-1.5 rounded ${colors.cardHover} transition-colors`}
                    title="复制"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className={colors.textMuted} />}
                  </button>
                  <pre className={`text-xs p-3 rounded-lg overflow-auto max-h-48 ${colors.codeBlock}`}>
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </ModalDescription>

        <ModalFooter>
          {type === 'confirm' && (
            <Button 
              variant="secondary" 
              size="lg"
              onClick={onCancel}
            >
              {finalCancelText}
            </Button>
          )}
          <Button
            variant={btnVariant}
            size="lg"
            onClick={onConfirm}
            disabled={loading}
            loading={loading}
          >
            {finalConfirmText}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}

export default ConfirmModal
