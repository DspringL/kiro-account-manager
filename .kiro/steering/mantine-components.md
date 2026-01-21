# Mantine 组件样式规范

## 问题描述

Mantine 组件（Select、TextInput、Textarea、NumberInput 等）在使用 `classNames` 配置样式时，必须包含完整的主题颜色变量，否则会导致样式显示异常。

## 核心规则

### 所有输入类组件的 classNames.input 必须包含三个变量

```jsx
classNames={{
  input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
  dropdown: `${colors.card} border ${colors.cardBorder}`,
  option: `${colors.text}`
}}
```

**关键点**：
- `${colors.text}` - 文字颜色
- `${colors.input}` - 背景和边框基础样式
- `${colors.inputFocus}` - 聚焦时的样式（**必须包含，否则会出现显示问题**）

## 受影响的组件

### Select 组件

```jsx
<Select
  value={value}
  onChange={onChange}
  data={[...]}
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
    dropdown: `${colors.card} border ${colors.cardBorder}`,
    option: `${colors.text}`
  }}
/>
```

### TextInput 组件

```jsx
<TextInput
  value={value}
  onChange={onChange}
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`
  }}
/>
```

### Textarea 组件

```jsx
<Textarea
  value={value}
  onChange={onChange}
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`
  }}
/>
```

### NumberInput 组件

```jsx
<NumberInput
  value={value}
  onChange={onChange}
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`
  }}
/>
```

## 常见错误

### ❌ 错误示例 1：缺少 inputFocus

```jsx
<Select
  classNames={{
    input: `${colors.text} ${colors.input}`,  // ❌ 缺少 inputFocus
    dropdown: `${colors.card} border ${colors.cardBorder}`,
    option: `${colors.text}`
  }}
/>
```

**问题**：下拉框展开时样式异常，文字可能不可见

### ❌ 错误示例 2：只有 text

```jsx
<TextInput
  classNames={{
    input: `${colors.text}`  // ❌ 缺少 input 和 inputFocus
  }}
/>
```

**问题**：输入框背景和边框样式丢失

### ❌ 错误示例 3：硬编码样式

```jsx
<Select
  classNames={{
    input: 'text-white bg-gray-800'  // ❌ 硬编码，不支持主题切换
  }}
/>
```

**问题**：主题切换时样式不会更新

## ✅ 正确示例

### 完整的 Select 配置

```jsx
<Select
  value={aiModel}
  onChange={handleApplyModel}
  data={[
    { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
  ]}
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus}`,
    dropdown: `${colors.card} border ${colors.cardBorder}`,
    option: `${colors.text}`
  }}
/>
```

### 带额外样式的 TextInput

```jsx
<TextInput
  value={httpProxy}
  onChange={(e) => setHttpProxy(e.target.value)}
  placeholder="http://127.0.0.1:7890"
  classNames={{
    input: `${colors.text} ${colors.input} ${colors.inputFocus} font-mono`
  }}
/>
```

## 检查清单

在使用 Mantine 输入组件时，确保：

- [ ] `classNames.input` 包含 `${colors.text}`
- [ ] `classNames.input` 包含 `${colors.input}`
- [ ] `classNames.input` 包含 `${colors.inputFocus}` ⚠️ **最容易遗漏**
- [ ] Select 组件的 `dropdown` 和 `option` 也配置了颜色
- [ ] 没有使用硬编码的颜色值

## 调试技巧

### 如何发现问题

1. **症状**：下拉框展开后文字不可见或样式异常
2. **检查**：打开浏览器开发者工具，查看元素的 computed styles
3. **定位**：搜索组件的 `classNames` 配置
4. **修复**：添加缺失的 `${colors.inputFocus}`

### 快速搜索

```bash
# 查找可能有问题的 Select 组件
grep -r "classNames={{" src/ | grep -v "inputFocus"
```

## 相关文件

- `src/contexts/ThemeContext.jsx` - 颜色变量定义
- `src/components/features/Settings.jsx` - 大量使用示例
- `.kiro/steering/ui-style.md` - UI 样式总规范

## 更新记录

- 2026-01-18: 创建规则，修复 Settings.jsx 中所有 Select/TextInput/Textarea/NumberInput 组件
