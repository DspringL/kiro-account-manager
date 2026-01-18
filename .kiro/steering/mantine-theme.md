# Mantine 组件主题规范

## 问题：Mantine 组件默认颜色继承问题

### 问题描述
在深色主题下，Mantine 组件（Card、Text、Group、Stack 等）会使用默认的深色文字颜色，导致深色背景搭配深色文字，造成可读性问题。

### 症状
- 深色主题下卡片内的文字显示为深色（黑色或深灰色）
- 文字与深色背景对比度不足，难以阅读
- 即使使用了 `className={colors.text}` 也可能被 Mantine 默认样式覆盖

### 根本原因
Mantine 组件有自己的默认颜色系统，不会自动继承父元素的颜色。需要在 MantineProvider 的主题配置中显式设置 `color: 'inherit'`。

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

**关键点**：
- **Card 组件**：必须设置 `color` 属性，深色主题用浅色 `#e5e7eb`，浅色主题用深色 `#1f2937`
- **Text/Group/Stack 组件**：设置 `color: 'inherit'` 继承父元素（Card）的颜色
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

## 常见错误

### 错误 1：Card 没有设置 color
```jsx
// ❌ 错误：Card 不设置 color，Mantine 会使用默认深色文字
Card: {
  styles: {
    root: {
      backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
      // 没有设置 color
    },
  },
}
```

```jsx
// ✅ 正确：Card 必须设置 color，深色主题用浅色文字
Card: {
  styles: {
    root: {
      backgroundColor: isLightTheme ? '#ffffff' : 'rgba(30, 30, 50, 0.8)',
      color: isLightTheme ? '#1f2937' : '#e5e7eb', // 关键
    },
  },
}
```

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

## 测试方法

修改 ThemeContext 后，必须在所有主题下测试：

1. 切换到深色主题
2. 检查所有页面的卡片内文字是否清晰可读
3. 检查是否有深色背景配深色文字的情况
4. 切换到浅色/紫色/绿色主题重复测试

## 历史问题
- 2026-01-18：修复首页所有组件的 `c="dimmed"` 问题（24处）
- 2026-01-18：在 ThemeContext 中添加 Text、Group、Stack 的 `color: 'inherit'` 配置
- 2026-01-18：修复 Select 组件 input 文字颜色缺失问题
- 2026-01-18：**重要修正**：Card 组件必须设置 color，不能省略，否则深色主题下会显示深色文字
