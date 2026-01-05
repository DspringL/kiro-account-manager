import type { VercelRequest, VercelResponse } from '@vercel/node'

// 强制更新配置
const FORCE_UPDATE = {
  enabled: true,
  minVersion: '1.6.0',  // 低于此版本强制更新
  message: '检测到重要更新，请升级到最新版本以获得更好的体验。'
}

// 公告列表 - 支持多个公告
const ANNOUNCEMENTS = [
  {
    id: '2025-01-05-v2',
    enabled: true,
    title: '重要提示',
    content: [
      '感谢使用本工具，由 hj01857655 独立开发并永久免费开源（GPL-3.0）。',
      '⚠️ 警告：任何以本项目名义收费的行为均属诈骗，我们保留追究法律责任的权利。',
      '请从官网或 GitHub 下载，保护自己的账号安全。'
    ],
    // 官网地址
    websiteUrl: 'https://vercel-api-lemon-five.vercel.app',
    officialUrl: 'https://github.com/hj01857655/kiro-account-manager',
    // 使用教程
    tutorialUrl: 'https://xcn46cm1l4ir.feishu.cn/wiki/YfaAw3qnoixFJgkzTSmcgtPfntc',
    qqGroup: '1020204332',
    qqGroupUrl: 'https://qm.qq.com/q/JjXJiVCiAw'
  }
]

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // 只返回 enabled 的公告
  const activeAnnouncements = ANNOUNCEMENTS.filter(a => a.enabled)
  return res.status(200).json({
    announcements: activeAnnouncements,
    forceUpdate: FORCE_UPDATE
  })
}
