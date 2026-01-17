import { lazy } from 'react'
import { Home, Key, Settings2, LogIn, Settings, Info } from 'lucide-react'

// 路由配置：菜单项 + 懒加载组件
// id 对应 nameKey 去掉 nav. 前缀
export const routes = [
  { id: 'home', icon: Home, nameKey: 'nav.home', component: lazy(() => import('./components/Home')) },
  { id: 'accounts', icon: Key, nameKey: 'nav.accounts', component: lazy(() => import('./components/AccountManager/index')) },
  { id: 'kiroConfig', icon: Settings2, nameKey: 'nav.kiroConfig', component: lazy(() => import('./components/KiroConfig/index')) },
  { id: 'desktopOAuth', icon: LogIn, nameKey: 'nav.desktopOAuth', descKey: 'nav.socialIdC', component: lazy(() => import('./components/Login')) },
  { id: 'settings', icon: Settings, nameKey: 'nav.settings', component: lazy(() => import('./components/Settings')) },
  { id: 'about', icon: Info, nameKey: 'nav.about', component: lazy(() => import('./components/About')) },
]

// 内部路由（不在侧边栏显示）
export const internalRoutes = {
  callback: lazy(() => import('./components/AuthCallback')),
}
