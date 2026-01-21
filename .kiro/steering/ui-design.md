---
inclusion: always
---

# UI 设计规范

本文档整合了项目的所有 UI 样式规范，包括样式系统架构、组件设计规范、Mantine 组件配置等。

---

## 目录

1. [样式系统架构](#样式系统架构)
2. [ThemeContext 颜色变量](#themecontext-颜色变量)
3. [主题判断规范](#主题判断规范)
4. [Mantine 组件规范](#mantine-组件规范)
5. [弹窗设计规范](#弹窗设计规范)
6. [表单元素规范](#表单元素规范)
7. [样式修改指南](#样式修改指南)

---

## 样式系统架构

本项目采用**三层样式系统**：

```
┌─────────────────────────────────────────────────────────┐
│  1. Tailwind CSS (工具类)                                │
│     - 快速布局和样式                                      │
│     - 响应式设计                                          │
│     - 动画和过渡效果                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. ThemeContext (主题变量)                              │
│     - 定义 4 种主题的颜色变量                             │
│     - 通过 colors.xxx 提供 Tailwind 类名                 │
│     - 组件通过 className={colors.text} 使用              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. Mantine 全局样式 (组件库默认样式)                     │
│     - 为 Mantine 组件设置全局默认样式                     │
│     - 确保 Mantine 组件与 Tailwind 协同工作              │
│     - 设置颜色继承规则                                    │
└─────────────────────────────────────────────────────────┘
```

### 1. Tailwind CSS 层

提供原子化 CSS 类，用于快速构建 UI：

```jsx
<div className="flex items-center gap-4 p-6 rounded-xl">
  <span className="text-sm font-medium">文字</span>
</div>
```

### 2. ThemeContext 层（核心）

统一管理主题颜色，提供 4 种主题：light、dark、purple、green

```jsx
import { useApp } from '../hooks/useApp'

function MyComponent() {
  const { colors } = useApp()
  
  return (
    <div className={`${colors.card} border ${colors.cardBorder}`}>
      <h1 className={colors.text}>标题</h1>
      <p className={colors.textMuted}>描述</p>
    </div>
  )
}
```

### 3. Mantine 全局样式层

为 Mantine 组件库设置全局默认样式，确保与 Tailwind 协同工作。

**关键配置**（`src/contexts/ThemeContext.jsx`）：

```javascript
const mantineTheme = {
  colorScheme: isLightTheme ? 'light' : 'dark',
  components: {
    Card: {
      styles: {
        root: {
          backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
          borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
          color: isLightTheme ? '#1f2937' : '#e5e7eb', // 必须设置！
        },
      },
    },
    Text: {
      styles: {
        root: {
          color: 'inherit', // 继承父元素颜色
        },
      },
    },
    // ... 其他组件
  },
}
```

---

## ThemeContext 颜色变量

### 基础颜色

- `main` - 页面主背景
- `card` - 卡片背景
- `cardBorder` - 卡片边框
- `cardHover` - 卡片 hover 背景
- `cardSecondary` - 次要卡片背景
- `text` - 主文字颜色
- `textMuted` - 次要文字颜色

### 输入框颜色

- `input` - 输入框背景和边框
- `inputFocus` - 输入框聚焦样式

### 按钮颜色

- `btnPrimary` - 主按钮
- `btnSecondary` - 次要按钮
- `btnDisabled` - 禁用按钮

### 状态颜色

- `badgeSuccess` - 成功徽章（绿色）
- `badgeWarning` - 警告徽章（橙色）
- `badgeInfo` - 信息徽章（蓝色）
- `badgeDisabled` - 禁用徽章（灰色）
- `error` - 错误颜色（红色）

### 卡片状态

- `cardSelected` - 选中状态
- `cardCurrent` - 当前使用账号
- `cardBanned` - 封禁账号
- `cardWarning` - 警告状态
- `cardNormal` - 普通状态

### 配额颜色

- `quotaHigh` - 配额高（>80%，红色）
- `quotaMedium` - 配额中（>50%，黄色）
- `quotaLow` - 配额低（<50%，绿色）

---

## Mantine 组件规范

### 核心规则

**所有输入类组件的 classNames.input 必须包含三个变量**：

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
- `${colors.inputFocus}` - 聚焦时的样式（**必须包含**）

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

### Mantine 内边距规范

Mantine 组件支持 style props，可以直接设置 padding：

```jsx
<Stack gap="xl" p="md">
  <SegmentedControl ... />
  <input ... />
</Stack>
```

**可用的 padding props**：
- `p` - 全方向 padding
- `px` - 左右 padding
- `py` - 上下 padding
- `pt`、`pb`、`pl`、`pr` - 单方向 padding

**Mantine spacing 值**：
- `xs` - 10px
- `sm` - 12px
- `md` - 16px
- `lg` - 20px
- `xl` - 32px

### 常见错误

❌ **错误示例 1：缺少 inputFocus**

```jsx
<Select
  classNames={{
    input: `${colors.text} ${colors.input}`,  // ❌ 缺少 inputFocus
  }}
/>
```

❌ **错误示例 2：硬编码样式**

```jsx
<Select
  classNames={{
    input: 'text-white bg-gray-800'  // ❌ 硬编码，不支持主题切换
  }}
/>
```

❌ **错误示例 3：使用 Mantine 颜色属性**

```jsx
<Text c="dimmed">文字</Text>  // ❌ 深色主题下会显示深色
```

✅ **正确做法**：

```jsx
<Text className={colors.textMuted}>文字</Text>  // ✅ 使用 ThemeContext
```

### Mantine 主题问题

**问题**：深色主题下 Mantine 组件文字不可读

**原因**：Mantine 组件有自己的默认颜色系统，不会自动继承父元素颜色

**解决方案**：
1. **Card 组件必须设置 color**：作为基础文字颜色
2. **Text/Group/Stack 设置 color: inherit**：继承 Card 的基础颜色
3. **禁止省略 Card 的 color**：否则会导致深色背景+深色文字

**颜色继承原理**：

```
Card (color: #e5e7eb 浅色) ← 必须设置！
  ├─ Text (color: inherit) → 继承到 #e5e7eb ✅ 可读
  ├─ Text className={colors.text} → 覆盖为 #e5e7eb ✅ 可读
  └─ Text className={colors.textMuted} → 覆盖为 #9ca3af ✅ 可读
```

---

## 弹窗设计规范

### 内边距规范

- **Header（顶部）**: `px-6 pt-6 pb-2`
- **Content（内容区）**: `px-6 py-4`
- **Footer（底部按钮区）**: `px-6 py-4`

### 弹窗宽度

- **小弹窗**（确认/提示）：`max-w-[400px]`
- **中等弹窗**（表单）：`max-w-[480px]`
- **大弹窗**（复杂表单）：`max-w-[600px]`
- **超大弹窗**（编辑器）：`max-w-[800px]`

### 圆角规范

- **弹窗外框**：`rounded-2xl`
- **按钮**：`rounded-xl`
- **输入框**：`rounded-xl`
- **图标容器**：`rounded-2xl`

### 按钮规范

**按钮尺寸**：
- **标准按钮**：`px-6 py-2.5 text-sm`
- **次要按钮**：`px-5 py-2.5 text-sm`
- **小按钮**：`px-4 py-2 text-xs`

**按钮间距**：
- 多个按钮：`gap-3`
- 按钮与内容：`mt-4` 或 `mt-6`

**按钮样式**：
- **主按钮**：`bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30`
- **次要按钮**：使用 `colors.btnSecondary`
- **危险按钮**：`bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/30`

### 图标规范

- **弹窗主图标**：`size={24}`
- **按钮图标**：`size={16}` 或 `size={14}`
- **关闭按钮图标**：`size={18}`

### 类型配色

- **确认（Confirm）**：`AlertTriangle` + `amber`
- **成功（Success）**：`CheckCircle` + `emerald`
- **错误（Error）**：`XCircle` + `red`
- **信息（Info）**：`Info` + `blue`

### 示例代码

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

---

## 表单元素规范

### 下拉框 (select)

使用 ThemeContext 提供的 colors 变量：

```jsx
<select
  className={`px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
>
  <option value="xxx">选项</option>
</select>
```

**禁止**：
- ❌ 不要用 `bg-white/5` 或 `border-white/10` 这类硬编码
- ❌ 不要用 `style={{ backgroundColor: ... }}` 内联样式
- ❌ 不要给 `<option>` 单独设置样式（浏览器不支持）

**正确做法**：
- ✅ 使用 `${colors.input}` 设置背景和边框
- ✅ 使用 `${colors.inputFocus}` 设置聚焦样式
- ✅ 使用 `${colors.text}` 设置文字颜色

### 输入框 (input)

```jsx
<input
  className={`px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
/>
```

### 文本域 (textarea)

```jsx
<textarea
  className={`p-4 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 resize-none`}
/>
```

### 标签选择器交互规范

标签选择器（TagSelector）采用"填充编辑"模式：

1. 用户从下拉框选择已有标签
2. 标签名称填充到输入框（不直接添加到已选列表）
3. 用户可以在输入框中编辑标签名称
4. 点击添加按钮后：
   - 如果名称与已有标签相同 → 直接选中该标签
   - 如果名称是新的 → 创建新标签并选中

**UI 要求**：
- 可用标签必须使用下拉框（select），禁止平铺展示
- 下拉框选择后填充到输入框，不直接添加

---

## 样式修改指南

### 1. 颜色相关 → 修改 ThemeContext

**文件位置**：`src/contexts/ThemeContext.jsx`

**什么时候改这里？**
- "卡片背景太黑了"
- "文字颜色看不清"
- "按钮颜色不好看"
- "hover 效果不明显"

**如何提示修改？**
```
"[主题名]主题下，[元素名]的[颜色属性]改成[目标颜色]"

示例：
- "深色主题下，卡片背景改成深蓝灰色"
- "深色主题的次要文字颜色调亮一点"
```

### 2. 间距/尺寸/布局 → 修改组件文件

**什么时候改这里？**
- "卡片太挤了"
- "按钮太小了"
- "间距太大/太小"
- "圆角太大/太小"

**常用 Tailwind 间距类**：

- **内边距 (padding)**：`p-4` = 16px，`px-4` = 左右 16px，`py-4` = 上下 16px
- **外边距 (margin)**：`m-4` = 16px，`mb-4` = 底部 16px，`gap-4` = Flexbox 间距
- **尺寸**：`w-12` = 48px，`h-12` = 48px，`text-sm` = 14px
- **圆角**：`rounded-xl` = 12px，`rounded-2xl` = 16px，`rounded-full` = 完全圆形

### 3. 快速定位文件

- **颜色、主题** → `src/contexts/ThemeContext.jsx`
- **账号卡片样式** → `src/components/features/AccountManager/AccountCard.jsx`
- **表格视图样式** → `src/components/features/AccountManager/AccountListView.jsx`
- **弹窗样式** → `src/components/modals/ConfirmDialog.jsx`
- **首页样式** → `src/components/features/Home.jsx`
- **全局样式** → `src/index.css`

### 4. 常见问题速查

- **深色主题下文字看不清？** → 修改 ThemeContext 中 `dark` 主题的 `text` 或 `textMuted`
- **卡片背景是纯黑？** → 修改 ThemeContext 中 `dark` 主题的 `card`
- **按钮太小点不到？** → 修改组件中按钮的 `p-2` 或图标的 `size={16}`
- **间距太挤？** → 修改组件中的 `gap-4`、`p-5` 等间距类
- **hover 效果不明显？** → 修改 ThemeContext 中的 `cardHover`

---

## 最佳实践

### ✅ 推荐做法

1. **使用 ThemeContext 颜色变量**
```jsx
<div className={`${colors.card} ${colors.text}`}>
  <span className={colors.textMuted}>次要文字</span>
</div>
```

2. **Mantine 组件使用 className 而非 c 属性**
```jsx
// ❌ 错误
<Text c="dimmed">文字</Text>

// ✅ 正确
<Text className={colors.textMuted}>文字</Text>
```

3. **Card 组件依赖 Mantine 全局样式**
```jsx
// ✅ 正确：依赖 Mantine 全局样式提供的 color
<Card>
  <Text>文字会自动继承正确的颜色</Text>
</Card>
```

### ❌ 避免的做法

1. **不要硬编码颜色**
```jsx
// ❌ 错误
<div className="bg-gray-800 text-white">

// ✅ 正确
<div className={`${colors.card} ${colors.text}`}>
```

2. **不要使用 Mantine 的颜色属性**
```jsx
// ❌ 错误
<Text c="dimmed">
<Badge color="gray">

// ✅ 正确
<Text className={colors.textMuted}>
<Badge className={colors.badgeInfo}>
```

3. **不要在组件内定义主题相关的颜色**
```jsx
// ❌ 错误
const bgColor = theme === 'dark' ? '#1a1a2e' : '#ffffff'

// ✅ 正确
const { colors } = useApp()
// 使用 colors.card
```

---

## 相关文件

- `src/contexts/ThemeContext.jsx` - 主题系统核心
- `src/hooks/useApp.js` - 提供 `colors` 访问
- `tailwind.config.js` - Tailwind 配置
- `src/components/features/Settings.jsx` - Mantine 组件使用示例

---

## 总结

本项目的样式系统设计原则：

1. **分层清晰**：Tailwind（工具）→ ThemeContext（主题）→ Mantine（组件库）
2. **主题驱动**：所有颜色通过 ThemeContext 管理，切换主题自动生效
3. **灵活扩展**：新增主题只需添加配置，无需修改组件
4. **类型安全**：通过 Context 提供，避免拼写错误
5. **性能优化**：Tailwind 类名在构建时生成，运行时无性能损耗

**核心理念**：用 Tailwind 写布局，用 ThemeContext 管理颜色，用 Mantine 全局样式确保组件库协同工作。
