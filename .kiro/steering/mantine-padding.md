# Mantine 组件内边距规范

## 问题描述

在 Modal 弹窗中使用 Mantine 组件（如 Stack、SegmentedControl）时，组件内容会贴到圆角边框，没有内边距。

## 根本原因

Mantine 组件会覆盖父容器的 padding，导致 Modal 的 `px-12 py-8` 对 Mantine 组件内的子元素不生效。

## 解决方案

### 方案 1：使用 Mantine Style Props（推荐）

Mantine 组件支持 style props，可以直接设置 padding：

```jsx
// ✅ 推荐：使用 Mantine 的 p、px、py props
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

### 方案 2：使用内层容器（备选）

如果不是 Mantine 组件，可以用普通 div 包裹：

```jsx
// ✅ 备选：用 div 包裹并设置 padding
<div style={{ padding: 'var(--mantine-spacing-md)' }}>
  <div className="space-y-6">
    {/* 内容 */}
  </div>
</div>
```

## 实际应用

### Modal 中使用 Stack

```jsx
<Modal ...>
  <Stack gap="xl" p="md">
    <SegmentedControl fullWidth />
    <input className="..." />
  </Stack>
</Modal>
```

### Modal 中使用普通 div

```jsx
<Modal ...>
  <div style={{ padding: 'var(--mantine-spacing-md)' }}>
    <div className="space-y-6">
      {/* 内容 */}
    </div>
  </div>
</Modal>
```

## 注意事项

1. **优先使用 Mantine style props**：更符合 Mantine 设计规范
2. **不要嵌套多层 div**：会增加 DOM 层级，影响性能
3. **统一使用 Mantine spacing 值**：保持间距一致性
4. **Modal 的 px-12 py-8 保留**：用于 header 和 footer 的内边距

## 已修复的文件

- ✅ `AddAccountModal.jsx` - Stack 使用 `p="md"`
- ✅ `EditAccountModal.jsx` - Stack 使用 `p="md"`
- ✅ `BatchTagModal.jsx` - div 使用 `style={{ padding: 'var(--mantine-spacing-md)' }}`

## 参考文档

- [Mantine Style Props](https://mantine.dev/styles/style-props/)
- [Mantine Stack](https://mantine.dev/core/stack/)
