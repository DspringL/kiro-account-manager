---
inclusion: fileMatch
fileMatchPattern: "scripts/register/**/*.py"
---

# SeleniumBase Driver 使用规范

基于官方文档：https://github.com/seleniumbase/seleniumbase/blob/master/help_docs/method_summary.md

## Driver vs BaseCase

项目使用 `Driver` 类（轻量级，适合多线程），不是 `BaseCase`。

## 可用方法

Driver 类支持的方法：
- `open(url)` - 打开 URL
- `wait_for_element_visible(selector)` - 等待元素可见
- `wait_for_element_present(selector)` - 等待元素存在
- `wait_for_text(text, selector)` - 等待文本出现
- `is_element_visible(selector)` - 检查元素是否可见
- `type(selector, text)` - 输入文本
- `click(selector)` - 点击元素
- `uc_click(selector, reconnect_time)` - UC 模式点击（推荐）
- `uc_open_with_reconnect(url, reconnect_time)` - UC 模式打开
- `uc_gui_click_captcha()` - 自动点击 CF 验证码
- `find_element(selector)` / `find_elements(selector)` - 查找元素
- `get_text(selector)` - 获取文本
- `get_attribute(selector, attribute)` - 获取属性
- `get_current_url()` - 获取当前 URL
- `get_page_source()` - 获取页面源码
- `save_screenshot(path)` - 保存截图
- `sleep(seconds)` - 等待
- `quit()` - 关闭浏览器

## 不可用方法

Driver 类**没有**以下方法（这些是 BaseCase 专属）：
- ❌ `wait_for_ready_state_complete()` - 用 `wait_for_element_visible` 替代

## 等待页面加载

不需要单独等待页面加载，直接用 `wait_for_element_visible` 等待目标元素即可。
