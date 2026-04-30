import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  message,
  Popconfirm,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '@/lib/utils'
import { TaskLogPanel } from '@/components/TaskLogPanel'

const { Text, Title } = Typography

interface TaskSnapshot {
  id: string
  platform: string
  source: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'stopped'
  total: number
  progress: string
  success: number
  registered: number
  skipped: number
  errors: string[]
  created_at: number | string | null
  updated_at: number | string | null
  control: { stop_requested: boolean }
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  cursor: 'Cursor',
  grok: 'Grok',
  kiro: 'Kiro',
  tavily: 'Tavily',
  openblocklabs: 'OpenBlock Labs',
}

function toUnixSeconds(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const maybeNum = Number(trimmed)
    if (Number.isFinite(maybeNum)) return maybeNum > 1_000_000_000_000 ? maybeNum / 1000 : maybeNum
    const parsed = Date.parse(trimmed)
    if (Number.isFinite(parsed)) return parsed / 1000
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value > 1_000_000_000_000 ? value / 1000 : value
}

function formatDuration(startTs: unknown, endTs?: unknown): string {
  const start = toUnixSeconds(startTs)
  const end = toUnixSeconds(endTs) ?? (Date.now() / 1000)
  if (start === null || !Number.isFinite(end)) return '-'
  const seconds = Math.max(0, Math.floor(end - start))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default function RunningTasks() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [logTaskId, setLogTaskId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now() / 1000)

  const statusConfig = {
    pending: { color: 'default', label: t('status.pending'), icon: <LoadingOutlined /> },
    running: { color: 'processing', label: t('status.running'), icon: <LoadingOutlined /> },
    done: { color: 'success', label: t('status.done') },
    failed: { color: 'error', label: t('status.failed') },
    stopped: { color: 'warning', label: t('status.stopped') },
  }

  const sourceLabels: Record<string, string> = {
    manual: t('runningTasks.source.manual'),
    api: t('runningTasks.source.api'),
    schedule: t('runningTasks.source.schedule'),
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = (await apiFetch('/tasks')) as TaskSnapshot[]
      const order = { running: 0, pending: 1, done: 2, failed: 3, stopped: 4 }
      const sorted = [...(data || [])].sort((a, b) => {
        const oa = order[a.status] ?? 9
        const ob = order[b.status] ?? 9
        if (oa !== ob) return oa - ob
        const ta = toUnixSeconds(a.created_at) ?? 0
        const tb = toUnixSeconds(b.created_at) ?? 0
        return tb - ta
      })
      setTasks(sorted)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const poll = setInterval(() => { load(); setNow(Date.now() / 1000) }, 2500)
    const tick = setInterval(() => setNow(Date.now() / 1000), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  const isActive = (task: TaskSnapshot) => task.status === 'running' || task.status === 'pending'
  const activeTasks = tasks.filter(isActive)
  const finishedTasks = tasks.filter((task) => !isActive(task))

  const handleDelete = async (taskId: string) => {
    try {
      await apiFetch(`/tasks/${taskId}`, { method: 'DELETE' })
      if (logTaskId === taskId) setLogTaskId(null)
      setTasks((prev) => prev.filter((task) => task.id !== taskId))
      message.success(t('common.deletedSuccess'))
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('common.deleteFailed'))
    }
  }

  const renderTask = (task: TaskSnapshot) => {
    const cfg = statusConfig[task.status] || { color: 'default', label: task.status }
    const failed = task.errors?.length ?? 0
    const total = Number.isFinite(Number(task.total)) && Number(task.total) > 0 ? Math.floor(Number(task.total)) : 0
    const done = Number.isFinite(Number(task.registered)) && Number(task.registered) > 0 ? Math.floor(Number(task.registered)) : 0
    const success = Number.isFinite(Number(task.success)) ? Number(task.success) : 0
    const skipped = Number.isFinite(Number(task.skipped)) ? Number(task.skipped) : 0
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0
    const duration = isActive(task)
      ? formatDuration(task.created_at, now)
      : formatDuration(task.created_at, task.updated_at)

    return (
      <Card key={task.id} size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Row gutter={[12, 8]} align="middle" wrap>
          <Col flex="220px">
            <Space direction="vertical" size={2}>
              <Text code style={{ fontSize: 11 }}>{task.id}</Text>
              <Space size={4}>
                <Tag color="blue" style={{ margin: 0 }}>{PLATFORM_LABELS[task.platform] || task.platform}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{sourceLabels[task.source] || task.source || '-'}</Text>
              </Space>
            </Space>
          </Col>

          <Col flex="100px">
            <Badge status={cfg.color as any} text={cfg.label} />
          </Col>

          <Col flex="70px">
            <Text type="secondary" style={{ fontSize: 12 }}>⏱ {duration}</Text>
          </Col>

          <Col flex="1" style={{ minWidth: 160 }}>
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Progress
                percent={pct}
                size="small"
                status={task.status === 'failed' || task.status === 'stopped' ? 'exception' : task.status === 'done' ? 'success' : 'active'}
                format={() => `${done}/${total}`}
              />
              <Space size={8}>
                <Text style={{ fontSize: 11, color: '#10b981' }}>✓ {t('runningTasks.success')} {success}</Text>
                {failed > 0 && <Text style={{ fontSize: 11, color: '#dc2626' }}>✗ {t('runningTasks.errors')} {failed}</Text>}
                {skipped > 0 && <Text style={{ fontSize: 11, color: '#d97706' }}>→ {t('runningTasks.skipped')} {skipped}</Text>}
              </Space>
            </Space>
          </Col>

          <Col>
            <Space>
              <Button size="small" icon={<FileTextOutlined />} onClick={() => setLogTaskId(task.id)}>
                {t('runningTasks.viewLogs')}
              </Button>
              {!isActive(task) && (
                <Popconfirm
                  title={t('common.confirmDelete')}
                  okText={t('common.delete')}
                  cancelText={t('common.cancel')}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(task.id)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                </Popconfirm>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{t('runningTasks.title')}</Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>{t('common.refresh')}</Button>
      </div>

      {activeTasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#6366f1' }}>
            {t('status.running')} ({activeTasks.length})
          </Text>
          {activeTasks.map(renderTask)}
        </div>
      )}

      {finishedTasks.length > 0 && (
        <div>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#6b7280' }}>
            {t('status.done')} ({finishedTasks.length})
          </Text>
          {finishedTasks.map(renderTask)}
        </div>
      )}

      {tasks.length === 0 && !loading && (
        <Empty description={t('runningTasks.noTasks')} style={{ marginTop: 60 }} />
      )}

      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            <span>{t('runningTasks.viewLogs')}</span>
            {logTaskId && <Text code style={{ fontSize: 11 }}>{logTaskId}</Text>}
          </Space>
        }
        open={!!logTaskId}
        onClose={() => setLogTaskId(null)}
        width={720}
        destroyOnClose
        bodyStyle={{ padding: 16 }}
      >
        {logTaskId && <TaskLogPanel taskId={logTaskId} />}
      </Drawer>
    </div>
  )
}
