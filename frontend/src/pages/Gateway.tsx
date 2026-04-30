import { useEffect, useState } from 'react'
import { Card, Row, Col, Button, Badge, Tag, Spin, Input, Space, Divider, List, message, Tooltip, Alert } from 'antd'
import {
  ApiOutlined,
  ReloadOutlined,
  CopyOutlined,
  LinkOutlined,
  SyncOutlined,
  KeyOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const GATEWAY_URL = ''  // same origin — gateway is now integrated

export default function Gateway() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'active' | 'inactive' | 'checking'>('checking')
  const [models, setModels] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const checkHealth = async () => {
    setStatus('checking')
    try {
      const res = await fetch(`${GATEWAY_URL}/health`, { signal: AbortSignal.timeout(4000) })
      setStatus(res.ok ? 'active' : 'inactive')
    } catch {
      setStatus('inactive')
    }
  }

  const loadModels = async () => {
    setLoadingModels(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/models`, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json()
        setModels(data?.data || [])
      } else {
        setModels([])
      }
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }

  const refresh = async () => {
    await checkHealth()
    await loadModels()
  }

  const syncAccounts = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/admin/sync`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        message.success(t('gateway.syncSuccess'))
        setLastSync(new Date().toLocaleTimeString())
        await loadModels()
      } else {
        message.error(t('gateway.syncFailed'))
      }
    } catch {
      message.warning(t('gateway.syncUnavailable'))
    } finally {
      setSyncing(false)
    }
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success(t('common.copied')))
  }

  useEffect(() => {
    refresh()
  }, [])

  const isActive = status === 'active'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t('gateway.title')}</h1>
          <p style={{ color: '#7a8ba3', marginTop: 4 }}>{t('gateway.subtitle')}</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={refresh}>
          {t('common.refresh')}
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <ApiOutlined />
                {t('gateway.status')}
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('gateway.connectionStatus')}</span>
                {status === 'checking' ? (
                  <Spin size="small" />
                ) : (
                  <Badge
                    status={isActive ? 'success' : 'error'}
                    text={isActive ? t('dashboard.gatewayActive') : t('dashboard.gatewayInactive')}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('gateway.activeAccounts')}</span>
                <Tag color={isActive ? 'blue' : 'default'}>
                  {isActive ? models.length : '—'}
                </Tag>
              </div>

              <Divider style={{ margin: '4px 0' }} />

              <Space direction="vertical" style={{ width: '100%' }}>
                <Button
                  block
                  type={isActive ? 'default' : 'primary'}
                  icon={<SyncOutlined spin={syncing} />}
                  onClick={syncAccounts}
                  loading={syncing}
                  disabled={!isActive}
                >
                  {syncing ? t('gateway.syncing') : t('gateway.syncAccounts')}
                </Button>
                <Button
                  block
                  icon={<LinkOutlined />}
                  href="/docs"
                  target="_blank"
                >
                  {t('gateway.openDashboard')}
                </Button>
              </Space>

              {lastSync && (
                <div style={{ fontSize: 12, color: '#7a8ba3', textAlign: 'center' }}>
                  {t('gateway.lastSync')}: {lastSync}
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card
            title={
              <Space>
                <KeyOutlined />
                {t('gateway.integration')}
              </Space>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#7a8ba3', marginBottom: 4 }}>
                  <GlobalOutlined style={{ marginRight: 4 }} />
                  {t('gateway.endpoint')}
                </div>
                <Input
                  readOnly
                  value={`${GATEWAY_URL}/v1`}
                  suffix={
                    <Tooltip title={t('common.copy')}>
                      <CopyOutlined
                        style={{ cursor: 'pointer' }}
                        onClick={() => copyText(`${GATEWAY_URL}/v1`)}
                      />
                    </Tooltip>
                  }
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#7a8ba3', marginBottom: 4 }}>
                  <KeyOutlined style={{ marginRight: 4 }} />
                  {t('gateway.apiKeyNote')}
                </div>
                <Alert
                  type="info"
                  showIcon
                  message={t('gateway.apiKeyInfo')}
                  description={t('gateway.apiKeyInfoDesc')}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#7a8ba3', marginBottom: 4 }}>
                  {t('gateway.exampleUsage')}
                </div>
                <Input.TextArea
                  readOnly
                  rows={5}
                  value={`# OpenAI-compatible\ncurl ${GATEWAY_URL}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_GATEWAY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"kiro","messages":[{"role":"user","content":"Hello"}]}'`}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() => copyText(`curl ${GATEWAY_URL}/v1/chat/completions -H "Authorization: Bearer YOUR_GATEWAY_API_KEY" -H "Content-Type: application/json" -d '{"model":"kiro","messages":[{"role":"user","content":"Hello"}]}'`)}
                >
                  {t('common.copy')}
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <ApiOutlined />
            {t('gateway.availableAccounts')}
            {isActive && <Tag color="blue">{models.length}</Tag>}
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadModels} loading={loadingModels}>
            {t('common.refresh')}
          </Button>
        }
      >
        {!isActive ? (
          <Alert
            type="warning"
            showIcon
            message={t('gateway.notRunning')}
            description={t('gateway.notRunningDesc')}
          />
        ) : loadingModels ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : models.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message={t('gateway.noAccounts')}
            description={t('gateway.noAccountsDesc')}
          />
        ) : (
          <List
            dataSource={models}
            renderItem={(model: any) => (
              <List.Item
                key={model.id}
                actions={[
                  <Tooltip title={t('common.copy')} key="copy">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyText(model.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={<ApiOutlined style={{ fontSize: 20, color: '#6366f1' }} />}
                  title={
                    <span style={{ fontFamily: 'monospace' }}>{model.id}</span>
                  }
                  description={
                    <Space>
                      <Tag color="blue">{model.object || 'model'}</Tag>
                      {model.owned_by && <Tag>{model.owned_by}</Tag>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}
