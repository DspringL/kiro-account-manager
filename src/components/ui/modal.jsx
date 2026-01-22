import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useApp } from "../../hooks/useApp"
import { Button } from './button'

const ModalRoot = DialogPrimitive.Root
const ModalTrigger = DialogPrimitive.Trigger
const ModalPortal = DialogPrimitive.Portal
const ModalClose = DialogPrimitive.Close

const ModalOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
ModalOverlay.displayName = DialogPrimitive.Overlay.displayName

const ModalContent = React.forwardRef(({ 
  className, 
  children, 
  maxWidth = "400px",
  showClose = true,
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  return (
    <ModalPortal>
      <ModalOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50",
          "translate-x-[-50%] translate-y-[-50%]",
          "w-full shadow-2xl rounded-2xl border p-4",
          colors.card,
          colors.cardBorder,
          "duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        style={{ maxWidth }}
        {...props}
      >
        <DialogPrimitive.Description className="sr-only">
          弹窗内容
        </DialogPrimitive.Description>
        {children}
        {showClose && (
          <DialogPrimitive.Close 
            className={cn(
              "absolute right-4 top-4 p-2 rounded-xl",
              "transition-all duration-200",
              colors.cardHover,
              "hover:scale-110",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            )}
          >
            <X size={18} className={colors.textMuted} />
            <span className="sr-only">关闭</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </ModalPortal>
  )
})
ModalContent.displayName = DialogPrimitive.Content.displayName

const ModalHeader = React.forwardRef(({ className, icon: Icon, iconColor, iconBg, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("px-6 pt-6 pb-2", className)}
      {...props}
    >
      {Icon && (
        <div className="flex items-center gap-4 mb-2">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
            iconBg || "bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
          )}>
            <Icon size={24} className={iconColor || "text-blue-400"} strokeWidth={2} />
          </div>
        </div>
      )}
      {children}
    </div>
  )
})
ModalHeader.displayName = "ModalHeader"

const ModalTitle = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-tight",
        colors.text,
        className
      )}
      {...props}
    />
  )
})
ModalTitle.displayName = DialogPrimitive.Title.displayName

const ModalDescription = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn("px-6 py-4", colors.text, className)}
      {...props}
    />
  )
})
ModalDescription.displayName = "ModalDescription"

const ModalFooter = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "px-6 py-4 flex justify-end gap-3",
        colors.dialogFooter,
        className
      )}
      {...props}
    />
  )
})
ModalFooter.displayName = "ModalFooter"

/**
 * Modal - 完整的弹窗组件
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidth = '400px',
  icon: Icon,
  iconColor,
  iconBg,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  confirmVariant = 'primary',
  loading = false,
  showCancel = true,
  showClose = true,
}) {
  return (
    <ModalRoot open={open} onOpenChange={onOpenChange}>
      <ModalContent maxWidth={maxWidth} showClose={showClose}>
        <ModalHeader icon={Icon} iconColor={iconColor} iconBg={iconBg}>
          <ModalTitle>{title}</ModalTitle>
          {description && (
            <p className="text-sm text-gray-500 mt-2">{description}</p>
          )}
        </ModalHeader>
        
        {children && (
          <ModalDescription>{children}</ModalDescription>
        )}
        
        <ModalFooter>
          {showCancel && (
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelText}
            </Button>
          )}
          {onConfirm && (
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </ModalRoot>
  )
}

export {
  ModalRoot,
  ModalPortal,
  ModalOverlay,
  ModalClose,
  ModalTrigger,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
}
