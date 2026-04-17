import * as React from "react"
import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Description, DialogBackdrop, CloseButton } from '@headlessui/react'
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { useApp } from "../../hooks/useApp"

/**
 * DialogRoot - 弹窗根组件
 */
const DialogRoot = ({ open, onOpenChange, children }) => {
  return (
    <HeadlessDialog 
      open={open}
      onClose={() => onOpenChange?.(false)}
      className="relative z-50"
    >
      {children}
    </HeadlessDialog>
  )
}

/**
 * DialogOverlay - 背景遮罩
 */
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <DialogBackdrop
      ref={ref}
      transition
      className={cn(
        "fixed inset-0",
        "bg-black/60 backdrop-blur-sm",
        "duration-300 ease-out",
        "data-[closed]:opacity-0",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = "DialogOverlay"

/**
 * DialogContent - 弹窗内容容器
 */
const DialogContent = React.forwardRef(({ 
  className, 
  children, 
  maxWidth = "400px",
  showClose = true,
  ...props 
}, ref) => {
  const { colors } = useApp()
  
  return (
    <>
      <DialogOverlay />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          ref={ref}
          transition
          className={cn(
            "relative w-full max-h-[90vh]",
            "flex flex-col",
            "rounded-2xl border shadow-2xl",
            "duration-300 ease-out",
            "data-[closed]:opacity-0 data-[closed]:scale-95",
            colors.card,
            colors.cardBorder,
            className
          )}
          style={{ maxWidth }}
          {...props}
        >
          {children}
          {showClose && (
            <CloseButton
              className={cn(
                "absolute right-4 top-4 z-10",
                "p-2 rounded-xl",
                "transition-all duration-200",
                "hover:scale-110",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                colors.cardHover
              )}
            >
              <X size={18} className={colors.textMuted} />
              <span className="sr-only">关闭</span>
            </CloseButton>
          )}
        </DialogPanel>
      </div>
    </>
  )
})
DialogContent.displayName = "DialogContent"

/**
 * DialogHeader - 弹窗头部
 */
const DialogHeader = React.forwardRef(({ 
  className, 
  icon: Icon, 
  iconColor, 
  iconBg, 
  children, 
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn("px-6 pt-6 pb-2", className)}
      {...props}
    >
      {Icon && (
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-10 h-10 rounded-xl",
            "flex items-center justify-center",
            "shadow-md",
            iconBg || "bg-gradient-to-br from-blue-500/20 to-indigo-500/10"
          )}>
            <Icon 
              size={20} 
              className={iconColor || "text-blue-400"} 
              strokeWidth={2} 
            />
          </div>
        </div>
      )}
      {children}
    </div>
  )
})
DialogHeader.displayName = "DialogHeader"

/**
 * DialogTitle - 弹窗标题
 */
const DialogTitleComponent = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <DialogTitle
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
DialogTitleComponent.displayName = "DialogTitle"

/**
 * DialogDescription - 弹窗描述
 */
const DialogDescriptionComponent = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <Description
      ref={ref}
      className={cn("text-sm mt-1", colors.textMuted, className)}
      {...props}
    />
  )
})
DialogDescriptionComponent.displayName = "DialogDescription"

/**
 * DialogBody - 弹窗内容区域
 */
const DialogBody = React.forwardRef(({ 
  className, 
  gap = "md",
  noPadding = false,
  ...props 
}, ref) => {
  const gapClasses = {
    none: "",
    sm: "space-y-3",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        !noPadding && "px-6 py-4",
        "overflow-y-auto flex-1",
        gapClasses[gap],
        className
      )}
      style={{ scrollbarWidth: 'thin' }}
      {...props}
    />
  )
})
DialogBody.displayName = "DialogBody"

/**
 * DialogFooter - 弹窗底部
 */
const DialogFooter = React.forwardRef(({ className, ...props }, ref) => {
  const { colors } = useApp()
  
  return (
    <div
      ref={ref}
      className={cn(
        "px-6 py-4",
        "flex justify-end gap-3",
        colors.dialogFooter,
        className
      )}
      {...props}
    />
  )
})
DialogFooter.displayName = "DialogFooter"

/**
 * DialogClose - 关闭按钮（用于手动关闭）
 */
const DialogClose = CloseButton

/**
 * Dialog - 完整的对话框组件
 * 
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onOpenChange - 状态改变回调
 * @param {string} props.title - 标题
 * @param {string} props.description - 描述文本
 * @param {ReactNode} props.children - 内容区域
 * @param {ReactNode} props.footer - 底部按钮区域
 * @param {string} props.maxWidth - 最大宽度
 * @param {Component} props.icon - 图标组件
 * @param {string} props.iconColor - 图标颜色
 * @param {string} props.iconBg - 图标背景
 * @param {boolean} props.showClose - 是否显示关闭按钮
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = '400px',
  icon: Icon,
  iconColor,
  iconBg,
  showClose = true,
}) {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth={maxWidth} showClose={showClose}>
        {(title || description || Icon) && (
          <DialogHeader icon={Icon} iconColor={iconColor} iconBg={iconBg}>
            {title && <DialogTitleComponent>{title}</DialogTitleComponent>}
            {description && <DialogDescriptionComponent>{description}</DialogDescriptionComponent>}
          </DialogHeader>
        )}
        
        {children && (
          <DialogBody>{children}</DialogBody>
        )}
        
        {footer && (
          <DialogFooter>{footer}</DialogFooter>
        )}
      </DialogContent>
    </DialogRoot>
  )
}

export {
  DialogRoot,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitleComponent as DialogTitle,
  DialogDescriptionComponent as DialogDescription,
  DialogBody,
}
