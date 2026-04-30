import { useCallback, useEffect, useState } from 'react'
import { Card, Table, Select, Button, Tag, Space, Popconfirm, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '@/lib/utils'

const { Text } = Typography

interface TaskLogItem {
  id: number
  created_at: string
  platform: string
  email: string
  status: 'success' | 'failed'
  error: string
}

interface TaskLogListResponse {
  total: number
  items: TaskLogItem[]
}

interface TaskLogBatchDeleteResponse {
  deleted: number
  not_found: number[]
  total_requested: number
}

export default function TaskHistory() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<TaskLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [platform, setPlatform] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', page_size: '50' })
      if (platform) params.set('platform', platform)
      const data = await apiFetch(`/tasks/logs?${params}`) as TaskLogListResponse
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setSelectedRowKeys((prev) => prev.filter((key) => data.items.some((item) => item.id === key)))
    } finally {
      setLoading(false)
    }
  }, [platform])

  useEffect(() => { load() }, [load])

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return
    const result = await apiFetch('/tasks/logs/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: selectedRowKeys }),
    }) as TaskLogBatchDeleteResponse
    message.success(`${t('common.deletedSuccess')}: ${result.deleted}`)
    setSelectedRowKeys([])
    await load()
  }

  const columns: TableColumnsType<TaskLogItem> = [
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: t('common.platform'),
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: t('common.email'),
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</span>,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === 'success' ? 'success' : 'error'}>
          {status === 'success' ? t('history.statusSuccess') : t('history.statusFailed')}
        </Tag>
      ),
    },
    {
      title: t('history.errorDetail'),
      dataIndex: 'error',
      key: 'error',
      render: (text: string) => text ? <Text type="danger" style={{ fontSize: 12 }}>{text}</Text> : '-',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t('history.title')}</h1>
          <p style={{ color: '#7a8ba3', marginTop: 4 }}>{total} {t('common.total').toLowerCase()}</p>
        </div>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Text type="success">{selectedRowKeys.length} {t('common.selectAll').toLowerCase()}</Text>
          )}
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title={t('common.confirmDelete')}
              onConfirm={handleBatchDelete}
              okText={t('common.delete')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                {t('history.deleteSelected')} ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Select
            value={platform}
            onChange={(value) => { setPlatform(value); setSelectedRowKeys([]) }}
            style={{ width: 140 }}
            options={[
              { value: '', label: t('history.allPlatforms') },
              { value: 'chatgpt', label: 'ChatGPT' },
              { value: 'kiro', label: 'Kiro' },
              { value: 'grok', label: 'Grok' },
              { value: 'cursor', label: 'Cursor' },
              { value: 'openblocklabs', label: 'OpenBlock Labs' },
            ]}
          />
          <Button icon={<ReloadOutlined spin={loading} />} onClick={load} loading={loading} />
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </Card>
    </div>
  )
}
