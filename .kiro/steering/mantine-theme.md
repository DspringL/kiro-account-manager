# Mantine 组件主题规范

## 问题：Mantine 组件默认颜色继承问题

### 问题描述
在深色主题下，Mantine 组件（Card、Text、Group、Stack 等）会使用默认的深色文字颜色，导致深色背景搭配深色文字，造成可读性问题。

### 症状
- 深色主题下卡片内的文字显示为深色（黑色或深灰色）
- 文字与深色背景对比度不足，难以阅读
- 即使使用了 `className={colors.text}` 也可能被 Mantine 默认样式覆盖

### 根本原因
Mantine 组件有自己的默认颜色系统，不会自动继承父元素的颜色。必须：
1. **Card 组件必须设置 color**：作为基础文字颜色（深色主题用浅色，浅色主题用深色）
2. **Text/Group/Stack 设置 color: inherit**：继承 Card 的基础颜色
3. **禁止省略 Card 的 color**：否则会继承 Mantine 默认深色，导致深色背景+深色文字

## 解决方案

### 1. ThemeContext 配置
在 `src/contexts/ThemeContext.jsx` 的 `mantineTheme.components` 中为所有 Mantine 组件添加颜色配置：

```jsx
const mantineTheme = {
  colorScheme: isLightTheme ? 'light' : 'dark',
  components: {
    // Card 必须设置 color，确保深色主题下文字是浅色
    Card: {
      styles: {
        root: {
          backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
          borderColor: isLightTheme ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
          color: isLightTheme ? '#1f2937' : '#e5e7eb', // 关键：设置文字颜色
        },
      },
    },
    // Text、Group、Stack 设置 color: 'inherit' 继承父元素颜色
    Text: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
    Group: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
    Stack: {
      styles: {
        root: {
          color: 'inherit',
        },
      },
    },
  },
}
```

**关键点（必须严格遵守）**：
- **Card 组件**：
  - ✅ **必须设置 color**：`color: isLightTheme ? '#1f2937' : '#e5e7eb'`
  - ❌ **禁止省略 color**：否则 Mantine 会使用默认深色，导致深色主题下不可读
  - 原理：Card 的 color 是所有子组件的基础颜色
- **Text/Group/Stack 组件**：
  - ✅ 设置 `color: 'inherit'` 继承父元素（Card）的颜色
  - 如需特殊颜色，用 `className={colors.xxx}` 覆盖
- **Select 组件**：input 和 option 都要设置 color

### 2. 避免使用 Mantine 的颜色属性
❌ **错误做法**：
```jsx
<Text c="dimmed">文字</Text>  // Mantine 的 c 属性在深色主题下会显示深色
```

✅ **正确做法**：
```jsx
<Text className={colors.textMuted}>文字</Text>  // 使用 ThemeContext 的颜色变量
```

### 3. 需要配置的 Mantine 组件
以下组件都需要在 `mantineTheme.components` 中配置颜色继承：
- Card - 设置 root 的 color
- Text - 设置 root 的 color: inherit
- Group - 设置 root 的 color: inherit
- Stack - 设置 root 的 color: inherit
- Select - **重要**：必须同时配置 input 和 option 的 color
- TextInput - 设置 input 的 color: inherit
- Textarea - 设置 input 的 color: inherit
- NumberInput - 设置 input 的 color: inherit
- Badge（如果使用自定义颜色）
- Button（如果使用自定义样式）
- Modal
- Drawer
- Popover

## 检查清单

新增或修改 Mantine 组件时，检查以下事项：

- [ ] 是否使用了 `c="dimmed"` 或其他 Mantine 颜色属性？→ 替换为 `className={colors.textMuted}`
- [ ] 是否在深色主题下测试过？
- [ ] 文字与背景对比度是否足够？
- [ ] 是否在 ThemeContext 中为该组件配置了颜色继承？

## 相关文件
- `src/contexts/ThemeContext.jsx` - 主题配置
- `src/components/Home/*.jsx` - 首页组件（已修复）
- `src/components/AccountManager/*.jsx` - 账号管理组件

## 常见错误（必读）

### ⚠️ 错误 1：Card 没有设置 color（最常见的错误）
```jsx
// ❌ 错误：Card 不设置 color，Mantine 会使用默认深色文字
// 结果：深色背景 + 深色文字 = 不可读
Card: {
  styles: {
    root: {
      backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
      // 没有设置 color ← 这是错误的！
    },
  },
}
```

```jsx
// ✅ 正确：Card 必须设置 color，深色主题用浅色文字
// 结果：深色背景 + 浅色文字 = 可读
Card: {
  styles: {
    root: {
      backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
      color: isLightTheme ? '#1f2937' : '#e5e7eb', // 必须设置！
    },
  },
}
```

**为什么必须设置？**
- Card 的 `color` 是所有子组件（Text/Group/Stack）的基础颜色
- 子组件通过 `color: 'inherit'` 继承这个基础颜色
- 如果 Card 不设置，子组件会继承 Mantine 的默认深色
- 深色主题下：深色背景 + 深色文字 = 完全不可读

### 错误 2：Text/Group/Stack 没有设置 color: 'inherit'
```jsx
// ❌ 错误：没有设置继承，Mantine 会使用默认颜色
Text: {
  styles: {
    root: {
      // 没有设置 color
    },
  },
}
```

```jsx
// ✅ 正确：设置 color: 'inherit' 继承父元素颜色
Text: {
  styles: {
    root: {
      color: 'inherit',
    },
  },
}
```

## 颜色继承原理图

```
深色主题下的正确继承链：

Card (color: #e5e7eb 浅色) ← 必须设置！
  ├─ Text (color: inherit) → 继承到 #e5e7eb ✅ 可读
  ├─ Text className={colors.text} → 覆盖为 #e5e7eb ✅ 可读
  └─ Text className={colors.textMuted} → 覆盖为 #9ca3af ✅ 可读

深色主题下的错误继承链：

Card (color: 未设置) ← 错误！
  └─ Text (color: inherit) → 继承 Mantine 默认深色 ❌ 不可读
     结果：深色背景 + 深色文字 = 完全看不见
```

## 测试方法

修改 ThemeContext 后，必须在所有主题下测试：

1. **切换到深色主题**（最重要）
2. 检查所有页面的卡片内文字是否清晰可读
3. 检查是否有深色背景配深色文字的情况
4. 切换到浅色/紫色/绿色主题重复测试

**快速检查**：如果深色主题下看不清文字，99% 是 Card 没设置 color

## 历史问题与教训

### 2026-01-18 修复过程（第二轮）
1. **Textarea/TextInput/NumberInput 文字颜色问题**
   - **问题**：深色主题下 Mantine 输入组件文字显示为黑色，无法阅读
   - **根本原因**：ThemeContext 中只配置了 `backgroundColor` 和 `borderColor`，**缺少 `color` 属性**
   - **解决方案**：在所有输入组件的 styles 中添加 `color: isLightTheme ? '#1f2937' : '#e5e7eb'`
   - **影响组件**：
     - `Textarea` - JSON 输入框、规则编辑器
     - `TextInput` - 所有文本输入框
     - `NumberInput` - 数字输入框
   - **修复位置**：`src/contexts/ThemeContext.jsx` 的 `mantineTheme.components`

### 2026-01-18 修复过程（第一轮）
1. **第一阶段**：修复首页所有组件的 `c="dimmed"` 问题（24处）
2. **第二阶段**：在 ThemeContext 中添加 Text、Group、Stack 的 `color: 'inherit'` 配置
3. **第三阶段**：修复 Select 组件 input 文字颜色缺失问题
4. **第四阶段（关键修正）**：
   - **错误理解**：以为 Card 不应该设置 color，让子组件自由控制
   - **实际问题**：Card 不设置 color 会导致子组件继承 Mantine 默认深色
   - **正确做法**：Card 必须设置 color 作为基础颜色，子组件通过 inherit 继承
   - **教训**：深色主题下文字不可读，99% 是 Card 没设置 color

### 核心教训
- ❌ **错误思路**：Card 不设置 color，让子组件用 className 控制
- ✅ **正确思路**：Card 设置基础 color，子组件 inherit 继承，需要时用 className 覆盖
- 🔑 **记住**：Card 的 color 不是可选的，是必须的！

### 特殊场景：有色背景配白色文字
- **UpdateDialog 顶部横幅**：蓝色渐变背景 `from-blue-500 to-indigo-600`，使用 `c="white"` 是正确的
- **Sidebar**：渐变色背景（蓝/紫/绿），使用 `c="white"` 是正确的
- **原则**：有色背景（非深色卡片）配白色文字，对比度足够，可以使用 `c="white"`
- **区别**：深色卡片（如 `bg-[#1a1a2e]`）配深色文字才是问题
