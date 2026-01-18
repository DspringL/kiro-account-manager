# 弹窗设计规范

## 内边距规范

### 标准内边距
- **Header（顶部）**: `px-6 pt-6 pb-2`
- **Content（内容区）**: `px-6 py-4`
- **Footer（底部按钮区）**: `px-6 py-4`

### 特殊场景
- 如果内容很长（如表单、列表）：Content 可以用 `py-6`
- 如果只有一行文字：Content 可以用 `py-3`
- 如果有多个按钮：Footer 保持 `py-4`，按钮间距用 `gap-3`

## 文字颜色规范

### 错误/警告/信息弹窗
- **标题**：使用 `colors.text`（主文字颜色）
- **内容**：使用 `colors.text`（主文字颜色，而非 textMuted）
- **原因**：错误信息需要清晰可读，不应该用次要颜色

### 确认弹窗
- **标题**：`colors.text`
- **内容**：`colors.text`（重要提示）或 `colors.textMuted`（次要说明）

### 成功弹窗
- **标题**：`colors.text`
- **内容**：`colors.text`

## 按钮规范

### 按钮尺寸
- **标准按钮**：`px-6 py-2.5 text-sm`
- **次要按钮**：`px-5 py-2.5 text-sm`
- **小按钮**：`px-4 py-2 text-xs`

### 按钮间距
- 多个按钮：`gap-3`
- 按钮与内容：`mt-4` 或 `mt-6`

### 按钮样式
- **主按钮**：渐变背景 + 阴影
  ```jsx
  className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30"
  ```
- **次要按钮**：使用 `colors.btnSecondary`
- **危险按钮**：红色渐变
  ```jsx
  className="bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/30"
  ```

## 弹窗宽度

- **小弹窗**（确认/提示）：`max-w-[400px]`
- **中等弹窗**（表单）：`max-w-[480px]`
- **大弹窗**（复杂表单）：`max-w-[600px]`
- **超大弹窗**（编辑器）：`max-w-[800px]`

## 圆角规范

- **弹窗外框**：`rounded-2xl`
- **按钮**：`rounded-xl`
- **输入框**：`rounded-xl`
- **图标容器**：`rounded-2xl`

## 动画规范

### 弹窗入场动画
```jsx
style={{ animation: 'dialogSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
```

### 背景遮罩动画
```jsx
className="animate-fade-in"
```

### 按钮点击动画
```jsx
className="active:scale-[0.98] transition-all duration-200"
```

## 图标规范

### 图标尺寸
- **弹窗主图标**：`size={24}`
- **按钮图标**：`size={16}` 或 `size={14}`
- **关闭按钮图标**：`size={18}`

### 图标容器
```jsx
<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
  <Icon size={24} className="text-blue-400" />
</div>
```

## 类型配色

### 确认（Confirm）
- 图标：`AlertTriangle`
- 颜色：`amber`（琥珀色）
- 渐变：`from-amber-500 to-orange-500`

### 成功（Success）
- 图标：`CheckCircle`
- 颜色：`emerald`（翠绿色）
- 渐变：`from-emerald-500 to-emerald-600`

### 错误（Error）
- 图标：`XCircle`
- 颜色：`red`（红色）
- 渐变：`from-red-500 to-red-600`

### 信息（Info）
- 图标：`Info`
- 颜色：`blue`（蓝色）
- 渐变：`from-blue-500 to-blue-600`

## 常见问题

### Q: 弹窗内容贴边，没有内边距？
A: 检查 Content 区域是否设置了 `px-6 py-4`

### Q: 按钮区域太挤？
A: Footer 应该用 `px-6 py-4`，按钮间距用 `gap-3`

### Q: 错误信息看不清？
A: 错误弹窗的内容应该用 `colors.text` 而非 `colors.textMuted`

### Q: 弹窗太宽或太窄？
A: 根据内容类型选择合适的 `max-w-[xxxpx]`

## 示例代码

### 标准错误弹窗结构
```jsx
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className={`${colors.card} rounded-2xl w-full max-w-[400px] shadow-2xl border ${colors.cardBorder}`}>
    {/* Header */}
    <div className="px-6 pt-6 pb-2">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/10 flex items-center justify-center">
          <XCircle size={24} className="text-red-400" />
        </div>
        <h2 className={`text-lg font-semibold ${colors.text}`}>错误标题</h2>
      </div>
    </div>
    
    {/* Content */}
    <div className="px-6 py-4">
      <p className={`${colors.text} text-sm leading-relaxed`}>
        错误信息内容
      </p>
    </div>
    
    {/* Footer */}
    <div className={`px-6 py-4 ${colors.dialogFooter} flex justify-end gap-3`}>
      <button className="px-6 py-2.5 text-sm font-medium rounded-xl text-white bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/30">
        确定
      </button>
    </div>
  </div>
</div>
```

## 相关文件

- `src/contexts/DialogContext.jsx` - 弹窗管理
- `src/components/AccountManager/ConfirmDialog.jsx` - 通用确认弹窗
- `src/components/UpdateDialog.jsx` - 更新弹窗
