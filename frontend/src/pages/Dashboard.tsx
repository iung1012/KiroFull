import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Progress, Tag, Button, Spin, Badge, Tooltip } from 'antd'
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  LinkOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '@/lib/utils'

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: '#3b82f6',
  cursor: '#10b981',
  kiro: '#f59e0b',
  grok: '#8b5cf6',
  openblocklabs: '#06b6d4',
  tavily: '#ec4899',
}

const PLATFORM_ICONS: Record<string, string> = {
  chatgpt: '🤖',
  cursor: '✏️',
  kiro: '⚡',
  grok: '🔮',
  openblocklabs: '🌐',
  tavily: '🔍',
}

const STATUS_COLORS: Record<string, string> = {
  registered: 'default',
  trial: 'processing',
  subscribed: 'success',
  expired: 'warning',
  invalid: 'error',
}

const STATUS_BG: Record<string, string> = {
  registered: 'rgba(99,102,241,0.08)',
  trial: 'rgba(245,158,11,0.08)',
  subscribed: 'rgba(16,185,129,0.08)',
  expired: 'rgba(251,191,36,0.08)',
  invalid: 'rgba(239,68,68,0.08)',
}

export default function Dashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [gatewayStatus, setGatewayStatus] = useState<'active' | 'inactive' | 'checking'>('checking')
  const [gatewayAccounts, setGatewayAccounts] = useState<number>(0)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/accounts/stats')
      setStats(data)
    } finally {
      setLoading(false)
    }
  }

  const checkGateway = async () => {
    setGatewayStatus('checking')
    try {
      const res = await fetch('/health', { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        setGatewayStatus('active')
        try {
          const info = await fetch('/v1/models', { signal: AbortSignal.timeout(3000) })
          const data = await info.json()
          setGatewayAccounts(data?.data?.length || 0)
        } catch {
          setGatewayAccounts(0)
        }
      } else {
        setGatewayStatus('inactive')
      }
    } catch {
      setGatewayStatus('inactive')
    }
  }

  const refresh = () => { load(); checkGateway() }

  useEffect(() => { load(); checkGateway() }, [])

  const statCards = [
    {
      title: t('dashboard.totalAccounts'),
      value: stats?.total ?? 0,
      icon: <UserOutlined />,
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.12)',
    },
    {
      title: t('dashboard.trial'),
      value: stats?.by_status?.trial ?? 0,
      icon: <ClockCircleOutlined />,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.12)',
    },
    {
      title: t('dashboard.subscribed'),
      value: stats?.by_status?.subscribed ?? 0,
      icon: <CheckCircleOutlined />,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.12)',
    },
    {
      title: t('dashboard.expired'),
      value: (stats?.by_status?.expired ?? 0) + (stats?.by_status?.invalid ?? 0),
      icon: <CloseCircleOutlined />,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.12)',
    },
  ]

  const isActive = gatewayStatus === 'active'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'rgba(99,102,241,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RocketOutlined style={{ fontSize: 22, color: '#6366f1' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('dashboard.title')}</h1>
            <p style={{ color: '#7a8ba3', margin: 0, fontSize: 13 }}>{t('dashboard.subtitle')}</p>
          </div>
        </div>
        <Tooltip title={t('common.refresh')}>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={refresh}
            loading={loading}
            shape="circle"
            size="large"
          />
        </Tooltip>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]}>
        {statCards.map(({ title, value, icon, color, bg }) => (
          <Col xs={12} sm={12} lg={6} key={title}>
            <Card
              styles={{ body: { padding: '20px 24px' } }}
              style={{ borderRadius: 12, overflow: 'hidden', position: 'relative' }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: color, borderRadius: '12px 12px 0 0',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Statistic
                  title={<span style={{ fontSize: 12, color: '#7a8ba3' }}>{title}</span>}
                  value={value}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color }}
                />
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color,
                }}>
                  {icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Gateway Banner */}
      <Card
        styles={{ body: { padding: '16px 24px' } }}
        style={{
          borderRadius: 12,
          background: isActive
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(6,182,212,0.08) 100%)'
            : 'rgba(239,68,68,0.05)',
          border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ThunderboltOutlined style={{ fontSize: 18, color: isActive ? '#10b981' : '#ef4444' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {t('dashboard.gatewayStatus')}
                {gatewayStatus === 'checking'
                  ? <Spin size="small" style={{ marginLeft: 8 }} />
                  : <Badge
                      status={isActive ? 'success' : 'error'}
                      text={isActive ? t('dashboard.gatewayActive') : t('dashboard.gatewayInactive')}
                      style={{ marginLeft: 8 }}
                    />}
              </div>
              {isActive && (
                <div style={{ fontSize: 12, color: '#7a8ba3', marginTop: 2 }}>
                  {t('dashboard.gatewayAccounts')}: <strong style={{ color: '#10b981' }}>{gatewayAccounts}</strong>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" icon={<ReloadOutlined />} onClick={checkGateway}>
              {t('common.refresh')}
            </Button>
            <Button size="small" type="primary" icon={<LinkOutlined />} href="/docs" target="_blank" ghost={!isActive}>
              {t('gateway.openDashboard')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Charts Row */}
      <Row gutter={[16, 16]}>
        {/* Platform Distribution */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ApiOutlined style={{ color: '#6366f1' }} />
                {t('dashboard.platformDistribution')}
              </span>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : stats && Object.keys(stats.by_platform || {}).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(stats.by_platform || {}).map(([platform, count]: any) => {
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0
                  const color = PLATFORM_COLORS[platform] || '#6366f1'
                  const emoji = PLATFORM_ICONS[platform] || '🔷'
                  return (
                    <div key={platform}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{emoji}</span>
                          <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{platform}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color }}>{count}</span>
                          <span style={{ color: '#7a8ba3', fontSize: 12 }}>{pct}%</span>
                        </div>
                      </div>
                      <Progress
                        percent={pct}
                        strokeColor={color}
                        trailColor="rgba(255,255,255,0.06)"
                        showInfo={false}
                        strokeLinecap="round"
                        size={['100%', 6]}
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#7a8ba3', padding: 32 }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>

        {/* Status Distribution */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircleOutlined style={{ color: '#10b981' }} />
                {t('dashboard.statusDistribution')}
              </span>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : stats && Object.keys(stats.by_status || {}).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(stats.by_status || {}).map(([status, count]: any) => (
                  <div
                    key={status}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: STATUS_BG[status] || 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <Tag
                      color={STATUS_COLORS[status] || 'default'}
                      style={{ margin: 0, borderRadius: 6 }}
                    >
                      {String(t(`status.${status}`, status))}
                    </Tag>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#7a8ba3', padding: 32 }}>
                {t('common.noData')}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
