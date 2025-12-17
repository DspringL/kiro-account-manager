// 硬件指纹水印组件 - 随机位置
import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from '../i18n'

export default function Watermark() {
  const { t } = useI18n()
  const [fingerprint, setFingerprint] = useState('')
  const [position, setPosition] = useState({ x: 0, y: 0 })

  // 生成随机位置（避开边缘 50px）
  const randomPosition = useCallback(() => {
    const maxX = window.innerWidth - 150
    const maxY = window.innerHeight - 50
    setPosition({
      x: Math.floor(Math.random() * Math.max(maxX, 100)) + 20,
      y: Math.floor(Math.random() * Math.max(maxY, 100)) + 20
    })
  }, [])

  useEffect(() => {
    invoke('get_hardware_fingerprint')
      .then(fp => setFingerprint(fp))
      .catch(err => {
        console.error('获取硬件指纹失败:', err)
        setFingerprint(t('common.unknown'))
      })
    
    // 初始随机位置
    randomPosition()
    
    // 随机间隔切换位置（2-5秒）
    const scheduleNext = () => {
      const delay = 2000 + Math.random() * 3000
      return setTimeout(() => {
        randomPosition()
        timerId = scheduleNext()
      }, delay)
    }
    
    let timerId = scheduleNext()
    
    return () => clearTimeout(timerId)
  }, [randomPosition])

  if (!fingerprint) return null

  return (
    <div
      className="fixed text-xs opacity-20 pointer-events-none select-none z-50 transition-all duration-500"
      style={{ 
        left: position.x,
        top: position.y,
        userSelect: 'none'
      }}
    >
      {fingerprint}
    </div>
  )
}
