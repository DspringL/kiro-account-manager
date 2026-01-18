# 样式修改指南

## 样式系统架构

本项目使用 **三层样式系统**：

```
Tailwind CSS (原子类)
    ↓
ThemeContext (主题颜色变量)
    ↓
组件样式 (具体实现)
```

---

## 1. 颜色相关 → 修改 ThemeContext

**文件位置**：`src/contexts/ThemeContext.jsx`

### 什么时候改这里？
- ❓ "卡片背景太黑了"
- ❓ "文字颜色看不清"
- ❓ "按钮颜色不好看"
- ❓ "hover 效果不明显"
- ❓ "徽章颜色太亮/太暗"

### 如何提示我修改？
```
示例 1：深色主题下卡片背景太黑
→ "深色主题的卡片背景改成深蓝灰色"

示例 2：文字颜色不清晰
→ "深色主题的次要文字颜色调亮一点"

示例 3：按钮 hover 效果
→ "卡片 hover 背景色改成半透明白色"
```

### ThemeContext 颜色变量列表

#### 基础颜色
- `main` - 页面主背景
- `card` - 卡片背景
- `cardBorder` - 卡片边框
- `cardHover` - 卡片 hover 背景
- `cardSecondary` - 次要卡片背景（配额区域等）
- `text` - 主文字颜色
- `textMuted` - 次要文字颜色

#### 状态颜色
- `badgeSuccess` - 成功徽章（绿色）
- `badgeWarning` - 警告徽章（橙色）
- `badgeInfo` - 信息徽章（蓝色）
- `badgeDisabled` - 禁用徽章（灰色）
- `error` - 错误颜色（红色）

#### 卡片状态
- `cardSelected` - 选中状态
- `cardCurrent` - 当前使用账号
- `cardBanned` - 封禁账号
- `cardWarning` - 警告状态
- `cardNormal` - 普通状态

#### 提供商徽章
- `providerGoogle` - Google 徽章
- `providerGithub` - GitHub 徽章
- `providerBuilderId` - BuilderId 徽章

#### 配额颜色
- `quotaHigh` - 配额高（>80%，红色）
- `quotaMedium` - 配额中（>50%，黄色）
- `quotaLow` - 配额低（<50%，绿色）

---

## 2. 间距/尺寸/布局 → 修改组件文件

**文件位置**：`src/components/AccountManager/AccountCard.jsx`（卡片）或其他组件

### 什么时候改这里？
- ❓ "卡片太挤了"
- ❓ "按钮太小了"
- ❓ "间距太大/太小"
- ❓ "圆角太大/太小"
- ❓ "图标尺寸不合适"

### 如何提示我修改？
```
示例 1：卡片内边距
→ "卡片内边距增大一点，现在太挤了"

示例 2：按钮尺寸
→ "底部操作按钮图标改大一点"

示例 3：区块间距
→ "账号卡片各个区块之间的间距减小"

示例 4：圆角
→ "卡片圆角改小一点，不要那么圆"
```

### 常用 Tailwind 间距类

#### 内边距 (padding)
- `p-4` = 16px（四周）
- `px-4` = 16px（左右）
- `py-4` = 16px（上下）
- `pt-4` = 16px（顶部）

#### 外边距 (margin)
- `m-4` = 16px
- `mb-4` = 16px（底部）
- `gap-4` = 16px（Flexbox 间距，推荐）

#### 尺寸
- `w-12` = 48px（宽度）
- `h-12` = 48px（高度）
- `text-sm` = 14px（文字）
- `text-xs` = 12px（文字）

#### 圆角
- `rounded-xl` = 12px
- `rounded-2xl` = 16px
- `rounded-full` = 完全圆形

---

## 3. 弹窗样式 → 参考 dialog-design.md

**文件位置**：`src/components/AccountManager/ConfirmDialog.jsx`

### 标准规范
- Header: `px-6 pt-6 pb-2`
- Content: `px-6 py-4`
- Footer: `px-6 py-4`
- 弹窗圆角: `rounded-2xl`
- 按钮圆角: `rounded-xl`

---

## 4. 表格视图 → AccountListView.jsx

**文件位置**：`src/components/AccountManager/AccountListView.jsx`

### 关键点
- 行高必须固定：`h-[56px]`（与虚拟滚动的 `estimateSize: 56` 匹配）
- 表头圆角：`rounded-t-xl`（顶部）
- 表格圆角：`rounded-b-xl`（底部）

---

## 5. 常见问题速查

### Q: 深色主题下文字看不清？
A: 修改 `ThemeContext.jsx` 中 `dark` 主题的 `text` 或 `textMuted`

### Q: 卡片背景是纯黑？
A: 修改 `ThemeContext.jsx` 中 `dark` 主题的 `card` 或 `cardNormal`

### Q: 按钮太小点不到？
A: 修改组件中按钮的 `p-2`（padding）或图标的 `size={16}`

### Q: 间距太挤？
A: 修改组件中的 `gap-4`、`p-5` 等间距类

### Q: hover 效果不明显？
A: 修改 `ThemeContext.jsx` 中的 `cardHover`

### Q: 圆角太大/太小？
A: 修改组件中的 `rounded-xl` 或 `rounded-2xl`

### Q: 表格行 hover 错位？
A: 检查行高 `h-[56px]` 是否与 `estimateSize: 56` 一致

---

## 6. 提示词模板

### 颜色修改
```
"[主题名]主题下，[元素名]的[颜色属性]改成[目标颜色]"

示例：
- "深色主题下，卡片背景改成深蓝灰色"
- "浅色主题下，次要文字颜色改成灰色"
```

### 间距修改
```
"[组件名]的[位置]间距[增大/减小]"

示例：
- "账号卡片的内边距增大"
- "配额区块和标签之间的间距减小"
```

### 尺寸修改
```
"[元素名]的[尺寸属性][增大/减小]"

示例：
- "头像尺寸增大"
- "底部按钮图标改大"
```

### 布局修改
```
"[组件名]的[布局描述]"

示例：
- "卡片各区块之间用统一间距"
- "底部按钮改成居中对齐"
```

---

## 7. 快速定位文件

| 想改什么 | 修改哪个文件 |
|---------|-------------|
| 颜色、主题 | `src/contexts/ThemeContext.jsx` |
| 账号卡片样式 | `src/components/AccountManager/AccountCard.jsx` |
| 表格视图样式 | `src/components/AccountManager/AccountListView.jsx` |
| 弹窗样式 | `src/components/AccountManager/ConfirmDialog.jsx` |
| 首页样式 | `src/components/Home.jsx` |
| 侧边栏样式 | `src/components/Sidebar.jsx` |
| 全局样式 | `src/index.css` |

---

## 8. 调试技巧

### 不知道元素用了什么颜色？
1. 打开浏览器开发者工具（F12）
2. 点击元素检查器
3. 查看 Computed 样式中的 `background-color`、`color` 等
4. 告诉我具体的颜色值或类名

### 不知道间距是多少？
1. 开发者工具检查元素
2. 查看 Computed 样式中的 `padding`、`margin`、`gap`
3. 告诉我具体数值

### 不知道怎么描述？
直接截图 + 简单描述问题即可，例如：
- "这里太挤了"
- "这个颜色太暗了"
- "这个按钮太小了"

---

## 9. 示例对话

### ❌ 不好的提示
- "改一下样式"（太模糊）
- "好看一点"（主观，不明确）
- "优化一下"（不知道优化什么）

### ✅ 好的提示
- "深色主题下卡片背景太黑，改成深蓝灰色"
- "账号卡片内边距太小，增大到 20px"
- "底部按钮图标从 15px 改成 16px"
- "配额进度条高度减小，现在太粗了"

---

## 10. 相关文档

- `dialog-design.md` - 弹窗设计规范
- `mantine-theme.md` - Mantine 组件主题规范
- `style-system.md` - 样式系统架构详解
- `ui-style.md` - UI 样式规范
