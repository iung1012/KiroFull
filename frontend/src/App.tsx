import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { App as AntdApp, ConfigProvider, Layout, Menu, Button, Spin, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  DashboardOutlined,
  UserOutlined,
  GlobalOutlined,
  HistoryOutlined,
  SettingOutlined,
  SunOutlined,
  MoonOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  TranslationOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import enUS from 'antd/locale/en_US'
import ptBR from 'antd/locale/pt_BR'
import i18n from './i18n'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import RegisterTaskPage from '@/pages/RegisterTaskPage'
import Proxies from '@/pages/Proxies'
import Settings from '@/pages/Settings'
import TaskHistory from '@/pages/TaskHistory'
import RunningTasks from '@/pages/RunningTasks'
import Gateway from '@/pages/Gateway'
import Login from '@/pages/Login'
import { darkTheme, lightTheme } from './theme'
import { apiFetch, clearToken, getToken } from '@/lib/utils'

const { Sider, Content } = Layout

function ProtectedLayout() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(s => {
        const token = getToken()
        if (s.has_password && !token) {
          navigate('/login', { replace: true })
        } else {
          setReady(true)
        }
      })
      .catch(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return <AppContent />
}

function AppContent() {
  const { t } = useTranslation()
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )
  const [lang, setLang] = useState<'pt' | 'en'>(() =>
    (localStorage.getItem('language') as 'pt' | 'en') || 'pt'
  )
  const [collapsed, setCollapsed] = useState(false)
  const [platforms, setPlatforms] = useState<{ key: string; label: string }[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('light', themeMode === 'light')
    document.documentElement.style.setProperty(
      '--sider-trigger-border',
      themeMode === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)'
    )
    localStorage.setItem('theme', themeMode)
  }, [themeMode])

  useEffect(() => {
    fetch('/api/auth/status').then(r => r.json()).then(s => setHasPassword(s.has_password)).catch(() => {})
  }, [])

  useEffect(() => {
    apiFetch('/platforms')
      .then(d => setPlatforms((d || [])
        .filter((p: any) => !['tavily', 'cursor'].includes(p.name))
        .map((p: any) => ({ key: p.name, label: p.display_name }))))
      .catch(() => {})
  }, [])

  const toggleLang = () => {
    const next = lang === 'pt' ? 'en' : 'pt'
    setLang(next)
    localStorage.setItem('language', next)
    i18n.changeLanguage(next)
  }

  const isLight = themeMode === 'light'
  const currentTheme = isLight ? lightTheme : darkTheme
  const antdLocale = lang === 'pt' ? ptBR : enUS

  const getSelectedKey = () => {
    const path = location.pathname
    if (path === '/') return ['/']
    if (path.startsWith('/accounts')) return [path]
    if (path === '/history') return ['/history']
    if (path === '/proxies') return ['/proxies']
    if (path === '/settings') return ['/settings']
    if (path === '/running-tasks') return ['/running-tasks']
    if (path === '/gateway') return ['/gateway']
    return ['/']
  }

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: t('menu.dashboard'),
    },
    {
      key: '/running-tasks',
      icon: <PlayCircleOutlined />,
      label: t('menu.runningTasks'),
    },
    {
      key: '/accounts',
      icon: <UserOutlined />,
      label: t('menu.accounts'),
      children: platforms.map(p => ({
        key: `/accounts/${p.key}`,
        label: p.label,
      })),
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: t('menu.history'),
    },
    {
      key: '/proxies',
      icon: <GlobalOutlined />,
      label: t('menu.proxies'),
    },
    {
      key: '/gateway',
      icon: <ApiOutlined />,
      label: t('menu.gateway'),
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: t('menu.settings'),
    },
  ]

  return (
    <ConfigProvider theme={currentTheme} locale={antdLocale}>
      <AntdApp>
        <Layout style={{ minHeight: '100vh' }}>
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            style={{
              background: currentTheme.token?.colorBgContainer,
              borderRight: `1px solid ${currentTheme.token?.colorBorder}`,
            }}
            width={220}
          >
            <div
              style={{
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: `1px solid ${currentTheme.token?.colorBorder}`,
                gap: 8,
              }}
            >
              <DashboardOutlined style={{ fontSize: 20, color: currentTheme.token?.colorPrimary }} />
              {!collapsed && (
                <span style={{ fontWeight: 700, fontSize: 15, color: currentTheme.token?.colorText }}>
                  Kiro Suite
                </span>
              )}
            </div>

            <Menu
              mode="inline"
              selectedKeys={getSelectedKey()}
              defaultOpenKeys={['/accounts']}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0, background: 'transparent' }}
            />

            <div
              style={{
                position: 'absolute',
                bottom: 56,
                left: 0,
                right: 0,
                padding: '0 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <Tooltip title={collapsed ? t('common.language') : ''} placement="right">
                <Button
                  block
                  icon={<TranslationOutlined />}
                  onClick={toggleLang}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 8,
                  }}
                >
                  {!collapsed && (lang === 'pt' ? '🇧🇷 Português' : '🇺🇸 English')}
                </Button>
              </Tooltip>

              <Tooltip title={collapsed ? t(isLight ? 'common.darkMode' : 'common.lightMode') : ''} placement="right">
                <Button
                  block
                  icon={isLight ? <SunOutlined /> : <MoonOutlined />}
                  onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 8,
                  }}
                >
                  {!collapsed && t(isLight ? 'common.lightMode' : 'common.darkMode')}
                </Button>
              </Tooltip>

              {hasPassword && (
                <Button
                  block
                  danger
                  icon={<LogoutOutlined />}
                  onClick={() => { clearToken(); navigate('/login') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 8,
                  }}
                >
                  {!collapsed && t('common.logout')}
                </Button>
              )}
            </div>
          </Sider>

          <Content
            style={{
              padding: 24,
              overflow: 'auto',
              background: currentTheme.token?.colorBgLayout,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/accounts/:platform" element={<Accounts />} />
              <Route path="/register" element={<RegisterTaskPage />} />
              <Route path="/running-tasks" element={<RunningTasks />} />
              <Route path="/history" element={<TaskHistory />} />
              <Route path="/proxies" element={<Proxies />} />
              <Route path="/gateway" element={<Gateway />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </BrowserRouter>
  )
}
