import { useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { useDialog } from '../../contexts/DialogContext'

// 更新检查组件 - 启动时自动检查，有更新则弹窗
function UpdateChecker() {
  const { showUpdate } = useDialog()

  const checkForUpdate = async () => {
    try {
      // 先用自定义命令检查（支持代理）
      const result = await invoke('check_update')

      if (result.has_update && result.latest_version) {
        // 有更新，再用 Tauri updater 获取完整的 update 对象
        const updateResult = await check()
        if (updateResult) {
          // 显示更新弹窗
          showUpdate(
            { version: result.latest_version, body: result.notes },
            updateResult
          )
        }
      }
    } catch (e) {
      // 静默处理
    }
  }

  useEffect(() => {
    checkForUpdate()
  }, [])

  // 不渲染任何内容，弹窗由 DialogContext 管理
  return null
}

export default UpdateChecker
