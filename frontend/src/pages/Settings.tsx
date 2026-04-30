import { useEffect, useRef, useState } from 'react'
import { App, Card, Form, Input, Select, Button, message, Tabs, Space, Tag, Typography, Modal, QRCode, Switch, Alert } from 'antd'
import {
  SaveOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  MailOutlined,
  SafetyOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  PlusOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { parseBooleanConfigValue } from '@/lib/configValueParsers'
import MailImportPanel from '@/components/settings/MailImportPanel'
import { apiFetch } from '@/lib/utils'

function resolveEffectiveMailProvider(mailProvider: string, mailImportSource: string) {
  if (mailProvider !== 'mail_import') return mailProvider
  return mailImportSource === 'applemail' ? 'applemail' : 'microsoft'
}

const SELECT_FIELDS: Record<string, { label: string; value: string }[]> = {
  mail_provider: [
    { label: 'LuckMail (Order / Purchased mailbox)', value: 'luckmail' },
    { label: 'Email Import', value: 'mail_import' },
    { label: 'Laoudo (Fixed mailbox)', value: 'laoudo' },
    { label: 'TempMail.lol (Auto-generated)', value: 'tempmail_lol' },
    { label: 'SkyMail (CloudMail API)', value: 'skymail' },
    { label: 'CloudMail (genToken mode)', value: 'cloudmail' },
    { label: 'DuckMail (Auto-generated)', value: 'duckmail' },
    { label: 'MoeMail (sall.cc)', value: 'moemail' },
    { label: 'YYDS Mail / MaliAPI', value: 'maliapi' },
    { label: 'GPTMail', value: 'gptmail' },
    { label: 'OpenTrashMail', value: 'opentrashmail' },
    { label: 'Freemail (Self-hosted CF Worker)', value: 'freemail' },
    { label: 'CF Worker (Custom domain)', value: 'cfworker' },
  ],
  maliapi_auto_domain_strategy: [
    { label: 'balanced', value: 'balanced' },
    { label: 'prefer_owned', value: 'prefer_owned' },
    { label: 'prefer_public', value: 'prefer_public' },
  ],
  default_executor: [
    { label: 'API Protocol (no browser)', value: 'protocol' },
    { label: 'Headless browser', value: 'headless' },
    { label: 'Headed browser', value: 'headed' },
  ],
  default_captcha_solver: [
    { label: 'YesCaptcha', value: 'yescaptcha' },
    { label: 'Local Solver (Camoufox)', value: 'local_solver' },
    { label: 'Manual', value: 'manual' },
  ],
  outlook_backend: [
    { label: 'Graph (default)', value: 'graph' },
    { label: 'IMAP', value: 'imap' },
  ],
  luckmail_email_type: [
    { label: 'Auto / Empty', value: '' },
    { label: 'Microsoft - Graph', value: 'ms_graph' },
    { label: 'Microsoft - IMAP', value: 'ms_imap' },
    { label: 'Self-hosted', value: 'self_built' },
  ],
  cpa_cleanup_enabled: [
    { label: 'Disabled', value: '0' },
    { label: 'Enabled', value: '1' },
  ],
  codex_proxy_upload_type: [
    { label: 'AT (Access Token, recommended)', value: 'at' },
    { label: 'RT (Refresh Token)', value: 'rt' },
  ],
  external_apps_update_mode: [
    { label: 'Latest semver tag (recommended)', value: 'tag' },
    { label: 'Branch HEAD', value: 'branch' },
  ],
}

interface FieldConfig {
  key: string
  label: string
  placeholder?: string
  type?: 'select' | 'input' | 'boolean'
  secret?: boolean
}

interface SectionConfig {
  title: string
  desc?: string
  fields: FieldConfig[]
}

interface TabConfig {
  key: string
  label: string
  icon: React.ReactNode
  sections: SectionConfig[]
}

const TAB_ITEMS: TabConfig[] = [
  {
    key: 'register',
    label: 'Registration',
    icon: <ApiOutlined />,
    sections: [
      {
        title: 'Default Registration Mode',
        desc: 'Controls how registration tasks are executed',
        fields: [{ key: 'default_executor', label: 'Executor type', type: 'select' }],
      },
    ],
  },
  {
    key: 'mailbox',
    label: 'Email Service',
    icon: <MailOutlined />,
    sections: [
      {
        title: 'Default Email Service',
        desc: 'Select the email provider used during registration',
        fields: [
          { key: 'mail_provider', label: 'Email service', type: 'select' },
          { key: 'mailbox_otp_timeout_seconds', label: 'OTP wait timeout (seconds)', placeholder: 'e.g. 60 / 90 / 120' },
        ],
      },
      {
        title: 'Laoudo',
        desc: 'Fixed mailbox, manually configured',
        fields: [
          { key: 'laoudo_email', label: 'Email address', placeholder: 'xxx@laoudo.com' },
          { key: 'laoudo_account_id', label: 'Account ID', placeholder: '563' },
          { key: 'laoudo_auth', label: 'JWT Token', placeholder: 'eyJ...', secret: true },
        ],
      },
      {
        title: 'Freemail',
        desc: 'Cloudflare Worker-based self-hosted mailbox, supports admin token or username/password',
        fields: [
          { key: 'freemail_api_url', label: 'API URL', placeholder: 'https://mail.example.com' },
          { key: 'freemail_admin_token', label: 'Admin token', secret: true },
          { key: 'freemail_username', label: 'Username (optional)' },
          { key: 'freemail_password', label: 'Password (optional)', secret: true },
          { key: 'freemail_domain', label: 'Email domain (optional)', placeholder: 'example.com' },
        ],
      },
      {
        title: 'MoeMail',
        desc: 'Auto-registers account and generates temporary mailbox',
        fields: [
          { key: 'moemail_api_url', label: 'API URL', placeholder: 'https://sall.cc' },
          { key: 'moemail_api_key', label: 'API Key', secret: true },
        ],
      },
      {
        title: 'SkyMail',
        desc: 'CloudMail compatible API (addUser / emailList)',
        fields: [
          { key: 'skymail_api_base', label: 'API Base', placeholder: 'https://api.skymail.ink' },
          { key: 'skymail_token', label: 'Authorization Token', secret: true },
          { key: 'skymail_domain', label: 'Email domain', placeholder: 'mail.example.com' },
        ],
      },
      {
        title: 'CloudMail',
        desc: 'CloudMail token mode (genToken + emailList)',
        fields: [
          { key: 'cloudmail_api_base', label: 'API Base', placeholder: 'https://cloudmail.example.com' },
          { key: 'cloudmail_admin_email', label: 'Admin email (optional)', placeholder: 'admin@example.com' },
          { key: 'cloudmail_admin_password', label: 'Admin password', secret: true },
          { key: 'cloudmail_domain', label: 'Email domain (optional)', placeholder: 'mail.example.com,mail2.example.com' },
          { key: 'cloudmail_subdomain', label: 'Subdomain (optional)', placeholder: 'pool-a' },
          { key: 'cloudmail_timeout', label: 'Request timeout (seconds)', placeholder: '30' },
        ],
      },
      {
        title: 'YYDS Mail / MaliAPI',
        desc: 'API Key-based temporary mailbox with inbox polling',
        fields: [
          { key: 'maliapi_base_url', label: 'API URL', placeholder: 'https://maliapi.215.im/v1' },
          { key: 'maliapi_api_key', label: 'API Key', secret: true },
          { key: 'maliapi_domain', label: 'Email domain (optional)', placeholder: 'example.com' },
          { key: 'maliapi_auto_domain_strategy', label: 'Auto domain strategy', type: 'select' },
        ],
      },
      {
        title: 'Email Import (Microsoft / Outlook)',
        desc: 'Use locally imported Microsoft account pool with Graph / IMAP polling',
        fields: [
          { key: 'outlook_backend', label: 'Microsoft inbox method', type: 'select' },
        ],
      },
      {
        title: 'Email Import (AppleMail)',
        desc: 'Read local mailbox pool file via refresh_token + client_id',
        fields: [
          { key: 'applemail_base_url', label: 'API URL', placeholder: 'https://www.appleemail.top' },
          { key: 'applemail_pool_dir', label: 'Mailbox pool directory', placeholder: 'mail' },
          { key: 'applemail_pool_file', label: 'Current pool file (optional)', placeholder: 'Leave empty to auto-read latest' },
          { key: 'applemail_mailboxes', label: 'Poll folders', placeholder: 'INBOX,Junk' },
        ],
      },
      {
        title: 'GPTMail',
        desc: 'GPTMail API-based temporary mailbox with inbox polling',
        fields: [
          { key: 'gptmail_base_url', label: 'API URL', placeholder: 'https://mail.chatgpt.org.uk' },
          { key: 'gptmail_api_key', label: 'API Key', secret: true, placeholder: 'gpt-test' },
          { key: 'gptmail_domain', label: 'Email domain (optional)', placeholder: 'example.com' },
        ],
      },
      {
        title: 'OpenTrashMail',
        desc: 'Connect to opentrashmail service; polls /json/<email>',
        fields: [
          { key: 'opentrashmail_api_url', label: 'API URL', placeholder: 'http://mail.example.com:8085' },
          { key: 'opentrashmail_domain', label: 'Email domain (optional)', placeholder: 'xiyoufm.com' },
          { key: 'opentrashmail_password', label: 'Site password (optional)', secret: true },
        ],
      },
      {
        title: 'TempMail.lol',
        desc: 'Auto-generated mailbox, no config needed (blocked on CN IPs, use proxy)',
        fields: [],
      },
      {
        title: 'DuckMail',
        desc: 'Auto-generated mailbox with random account creation',
        fields: [
          { key: 'duckmail_api_url', label: 'Web URL', placeholder: 'https://www.duckmail.sbs' },
          { key: 'duckmail_provider_url', label: 'Provider URL', placeholder: 'https://api.duckmail.sbs' },
          { key: 'duckmail_bearer', label: 'Bearer Token', placeholder: 'kevin273945', secret: true },
          { key: 'duckmail_domain', label: 'Custom domain', placeholder: 'Leave empty to derive from Provider URL' },
          { key: 'duckmail_api_key', label: 'API Key (private domain)', placeholder: 'dk_xxx', secret: true },
        ],
      },
      {
        title: 'CF Worker Self-hosted Mailbox',
        desc: 'Cloudflare Worker-based temporary mailbox service',
        fields: [
          { key: 'cfworker_api_url', label: 'API URL', placeholder: 'https://apimail.example.com' },
          { key: 'cfworker_admin_token', label: 'Admin Token', secret: true },
          { key: 'cfworker_custom_auth', label: 'Site password', secret: true },
          { key: 'cfworker_subdomain', label: 'Fixed subdomain', placeholder: 'mail / pool-a' },
          { key: 'email_domain_rule_enabled', label: 'Enable domain rules', type: 'boolean' },
          { key: 'email_domain_level_count', label: 'Domain level count (N)', placeholder: 'e.g. 2 / 3 / 4' },
          { key: 'cfworker_random_subdomain', label: 'Random subdomain', type: 'boolean' },
          { key: 'cfworker_random_name_subdomain', label: 'Random name subdomain', type: 'boolean' },
          { key: 'cfworker_fingerprint', label: 'Fingerprint', placeholder: '6703363b...' },
        ],
      },
      {
        title: 'LuckMail',
        desc: 'ChatGPT uses purchased mailbox; other platforms use order-based logic',
        fields: [
          { key: 'luckmail_base_url', label: 'Platform URL', placeholder: 'https://mails.luckyous.com' },
          { key: 'luckmail_api_key', label: 'API Key', secret: true },
          { key: 'luckmail_email_type', label: 'Email type (optional)', type: 'select' },
          { key: 'luckmail_domain', label: 'Email domain (optional)', placeholder: 'outlook.com / gmail.com' },
        ],
      },
    ],
  },
  {
    key: 'captcha',
    label: 'CAPTCHA',
    icon: <SafetyOutlined />,
    sections: [
      {
        title: 'CAPTCHA Service',
        desc: 'Used to bypass bot verification on registration pages',
        fields: [
          { key: 'default_captcha_solver', label: 'Default service', type: 'select' },
          { key: 'yescaptcha_key', label: 'YesCaptcha Key', secret: true },
        ],
      },
    ],
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    icon: <ApiOutlined />,
    sections: [
      {
        title: 'CPA Panel',
        desc: 'Auto-upload registered accounts to CPA management platform',
        fields: [
          { key: 'cpa_enabled', label: 'Enable auto-upload', type: 'boolean' },
          { key: 'cpa_api_url', label: 'API URL', placeholder: 'https://your-cpa.example.com' },
          { key: 'cpa_api_key', label: 'API Key', secret: true },
        ],
      },
      {
        title: 'Sub2API Panel',
        desc: 'Auto-upload registered accounts to Sub2API backend',
        fields: [
          { key: 'sub2api_enabled', label: 'Enable auto-upload', type: 'boolean' },
          { key: 'sub2api_api_url', label: 'API URL', placeholder: 'https://your-sub2api.example.com' },
          { key: 'sub2api_api_key', label: 'API Key', secret: true },
          { key: 'sub2api_group_ids', label: 'Group IDs', placeholder: 'Comma-separated, e.g. 2,4,8' },
        ],
      },
      {
        title: 'CPA Auto Maintenance',
        desc: 'Auto-delete error credentials and re-register when below threshold',
        fields: [
          { key: 'cpa_cleanup_enabled', label: 'Auto maintenance', type: 'select' },
          { key: 'cpa_cleanup_interval_minutes', label: 'Check interval (minutes)', placeholder: '60' },
          { key: 'cpa_cleanup_threshold', label: 'Minimum credential threshold', placeholder: '5' },
          { key: 'cpa_cleanup_concurrency', label: 'Re-registration concurrency', placeholder: '1' },
          { key: 'cpa_cleanup_register_delay_seconds', label: 'Delay per registration (seconds)', placeholder: '0' },
        ],
      },
      {
        title: 'Team Manager',
        desc: 'Upload to self-hosted Team Manager system',
        fields: [
          { key: 'team_manager_url', label: 'API URL', placeholder: 'https://your-tm.example.com' },
          { key: 'team_manager_key', label: 'API Key', secret: true },
        ],
      },
      {
        title: 'CodexProxy',
        desc: 'Auto-upload registered accounts to CodexProxy management platform',
        fields: [
          { key: 'codex_proxy_url', label: 'API URL', placeholder: 'https://your-codex-proxy.example.com' },
          { key: 'codex_proxy_key', label: 'Admin Key', secret: true },
          { key: 'codex_proxy_upload_type', label: 'Upload type' },
        ],
      },
      {
        title: 'SMSToMe Phone Verification',
        desc: 'Auto-fetch phone number and poll SMS code during ChatGPT add_phone stage',
        fields: [
          { key: 'smstome_cookie', label: 'SMSToMe Cookie', secret: true },
          { key: 'smstome_country_slugs', label: 'Country list', placeholder: 'united-kingdom,poland' },
          { key: 'smstome_phone_attempts', label: 'Phone number attempts', placeholder: '3' },
          { key: 'smstome_otp_timeout_seconds', label: 'SMS wait timeout (seconds)', placeholder: '45' },
          { key: 'smstome_poll_interval_seconds', label: 'Poll interval (seconds)', placeholder: '5' },
          { key: 'smstome_sync_max_pages_per_country', label: 'Max sync pages per country', placeholder: '5' },
        ],
      },
    ],
  },
  {
    key: 'cliproxyapi',
    label: 'CLIProxyAPI',
    icon: <ApiOutlined />,
    sections: [
      {
        title: 'Management Panel',
        desc: 'Login credentials for CLIProxyAPI management page',
        fields: [
          { key: 'cliproxyapi_base_url', label: 'API URL', placeholder: 'http://127.0.0.1:8317' },
          { key: 'cliproxyapi_management_key', label: 'Management key', secret: true, placeholder: 'default: cliproxyapi' },
        ],
      },
    ],
  },
  {
    key: 'grok',
    label: 'Grok',
    icon: <ApiOutlined />,
    sections: [
      {
        title: 'grok2api',
        desc: 'Auto-import to grok2api backend after successful registration',
        fields: [
          { key: 'grok2api_url', label: 'API URL', placeholder: 'http://127.0.0.1:7860' },
          { key: 'grok2api_app_key', label: 'App Key', secret: true },
          { key: 'grok2api_pool', label: 'Token Pool', placeholder: 'ssoBasic or ssoSuper' },
          { key: 'grok2api_quota', label: 'Quota (optional)', placeholder: 'Leave empty for pool default' },
        ],
      },
    ],
  },
  {
    key: 'kiro',
    label: 'Kiro',
    icon: <ApiOutlined />,
    sections: [
      {
        title: 'Kiro Account Manager',
        desc: 'Auto-write to kiro-account-manager accounts.json after successful registration',
        fields: [
          {
            key: 'kiro_manager_path',
            label: 'accounts.json path (optional)',
            placeholder: 'Leave empty to use system default path',
          },
          {
            key: 'kiro_manager_exe',
            label: 'Kiro Manager executable (optional)',
            placeholder: 'Path to KiroAccountManager.exe',
          },
        ],
      },
    ],
  },
  {
    key: 'contribution',
    label: 'Contribution',
    icon: <PlusOutlined />,
    sections: [],
  },
  {
    key: 'integrations',
    label: 'Plugins',
    icon: <ApiOutlined />,
    sections: [],
  },
  {
    key: 'security',
    label: 'Security',
    icon: <LockOutlined />,
    sections: [],
  },
]

const MAILBOX_SECTION_FIELD_KEY_BY_PROVIDER: Record<string, string> = {
  laoudo: 'laoudo_email',
  freemail: 'freemail_api_url',
  moemail: 'moemail_api_url',
  skymail: 'skymail_api_base',
  cloudmail: 'cloudmail_api_base',
  maliapi: 'maliapi_base_url',
  microsoft: 'outlook_backend',
  applemail: 'applemail_base_url',
  gptmail: 'gptmail_base_url',
  opentrashmail: 'opentrashmail_api_url',
  duckmail: 'duckmail_api_url',
  cfworker: 'cfworker_api_url',
  luckmail: 'luckmail_base_url',
}

const MAILBOX_SECTION_INDEX_BY_PROVIDER: Record<string, number> = {
  tempmail_lol: 10,
}

function splitMailboxSections(sections: SectionConfig[], mailProvider: string) {
  const defaultSection = sections[0] || null
  let selectedSection: SectionConfig | null = null
  const byIndex = MAILBOX_SECTION_INDEX_BY_PROVIDER[mailProvider]
  if (Number.isInteger(byIndex)) {
    selectedSection = sections[byIndex] || null
  } else {
    const fieldKey = MAILBOX_SECTION_FIELD_KEY_BY_PROVIDER[mailProvider]
    if (fieldKey) {
      selectedSection = sections.find((section) => section.fields.some((field) => field.key === fieldKey)) || null
    }
  }
  if (selectedSection === defaultSection) selectedSection = null
  const remainingSections = sections.filter((section) => section !== defaultSection && section !== selectedSection)
  return { defaultSection, selectedSection, remainingSections }
}

function formatResultText(data: unknown) {
  if (typeof data === 'string') return data
  try { return JSON.stringify(data, null, 2) } catch { return String(data) }
}

function normalizeDomainList(input: unknown): string[] {
  const items = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const domains: string[] = []
  for (const item of items) {
    const domain = String(item || '').trim().toLowerCase().replace(/^@/, '')
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    domains.push(domain)
  }
  return domains
}

function parseStoredDomainList(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeDomainList(value)
  if (typeof value !== 'string') return []
  const text = value.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return normalizeDomainList(parsed)
  } catch {}
  return normalizeDomainList(text.split('\n').flatMap((line) => line.split(',')).map((item) => item.trim()))
}

function resolveFeatureEnabledConfig(value: unknown, fallbackEnabled: boolean): boolean {
  const normalized = String(value ?? '').trim()
  if (!normalized) return fallbackEnabled
  return parseBooleanConfigValue(normalized)
}

const CONTRIBUTION_REDEEM_OPTIONS = [10, 100, 1000]

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickRecord(value: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  if (!value) return null
  for (const key of keys) {
    const record = asRecord(value[key])
    if (record) return record
  }
  return null
}

function pickString(value: Record<string, unknown> | null, keys: string[]): string {
  if (!value) return ''
  for (const key of keys) {
    const text = String(value[key] ?? '').trim()
    if (text) return text
  }
  return ''
}

function pickNumber(value: Record<string, unknown> | null, keys: string[]): number | null {
  if (!value) return null
  for (const key of keys) {
    const raw = value[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function formatDisplayNumber(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatDisplayPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(2)}%`
}

function ConfigField({ field }: { field: FieldConfig }) {
  const [showSecret, setShowSecret] = useState(false)
  const options = SELECT_FIELDS[field.key]
  const isBooleanField = field.type === 'boolean'

  return (
    <Form.Item label={field.label} name={field.key} valuePropName={isBooleanField ? 'checked' : undefined}>
      {options ? (
        <Select options={options} style={{ width: '100%' }} />
      ) : isBooleanField ? (
        <Switch checkedChildren="On" unCheckedChildren="Off" />
      ) : field.secret ? (
        <Input.Password
          placeholder={field.placeholder}
          visibilityToggle={{ visible: !showSecret, onVisibleChange: setShowSecret }}
          iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
        />
      ) : (
        <Input placeholder={field.placeholder} />
      )}
    </Form.Item>
  )
}

function ConfigSection({ section }: { section: SectionConfig }) {
  return (
    <Card
      title={section.title}
      extra={section.desc && <span style={{ fontSize: 12, color: '#7a8ba3' }}>{section.desc}</span>}
      style={{ marginBottom: 16 }}
    >
      {section.fields.map((field) => <ConfigField key={field.key} field={field} />)}
    </Card>
  )
}

function CFWorkerDomainPoolSection({ form }: { form: any }) {
  const watchedDomains = Form.useWatch('cfworker_domains', form) || []
  const watchedEnabledDomains = Form.useWatch('cfworker_enabled_domains', form) || []
  const normalizedDomains = normalizeDomainList(watchedDomains)
  const enabledDomains = normalizeDomainList(watchedEnabledDomains).filter((domain) => normalizedDomains.includes(domain))

  const updateEnabledDomains = (nextDomains: string[]) => {
    form.setFieldValue('cfworker_enabled_domains', normalizeDomainList(nextDomains))
  }

  const toggleEnabledDomain = (domain: string, checked: boolean) => {
    if (checked) { updateEnabledDomains([...enabledDomains, domain]); return }
    updateEnabledDomains(enabledDomains.filter((item) => item !== domain))
  }

  return (
    <Card
      title="CF Worker Domain Pool"
      extra={<span style={{ fontSize: 12, color: '#7a8ba3' }}>A random enabled domain will be used during registration</span>}
      style={{ marginBottom: 16 }}
    >
      <Form.List name="cfworker_domains">
        {(fields, { add, remove }) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fields.map((field) => {
              const { key, ...restField } = field
              return (
                <Space key={key} align="start" style={{ display: 'flex' }}>
                  <Form.Item
                    {...restField}
                    label={field.name === 0 ? 'All domains' : ''}
                    style={{ flex: 1, marginBottom: 0 }}
                    rules={[{ validator: async (_, value) => { if (!String(value || '').trim()) throw new Error('Please enter a domain') } }]}
                  >
                    <Input placeholder="example.com" />
                  </Form.Item>
                  <Button danger onClick={() => {
                    const currentDomains = Array.isArray(form.getFieldValue('cfworker_domains')) ? [...form.getFieldValue('cfworker_domains')] : []
                    const removedDomain = String(currentDomains[field.name] || '').trim().toLowerCase().replace(/^@/, '')
                    remove(field.name)
                    if (!removedDomain) return
                    const enabled = normalizeDomainList(form.getFieldValue('cfworker_enabled_domains'))
                    form.setFieldValue('cfworker_enabled_domains', enabled.filter((d) => d !== removedDomain))
                  }}>Remove</Button>
                </Space>
              )
            })}
            {fields.length === 0 && <Typography.Text type="secondary">No domains configured. Add one to enable selection below.</Typography.Text>}
            <Button type="dashed" onClick={() => add('')} icon={<PlusOutlined />} block>Add domain</Button>
          </div>
        )}
      </Form.List>

      <Form.Item name="cfworker_enabled_domains" hidden>
        <Select mode="multiple" options={normalizedDomains.map((domain) => ({ label: domain, value: domain }))} />
      </Form.Item>

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Enabled domains</div>
        {enabledDomains.length > 0 ? (
          <Space wrap>
            {enabledDomains.map((domain) => (
              <Tag key={domain} color="blue" closable onClose={(e) => { e.preventDefault(); updateEnabledDomains(enabledDomains.filter((item) => item !== domain)) }}>
                {domain}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">No enabled domains. Click a domain below to enable it.</Typography.Text>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Click to toggle status</div>
        {normalizedDomains.length > 0 ? (
          <Space wrap>
            {normalizedDomains.map((domain) => (
              <Tag.CheckableTag key={domain} checked={enabledDomains.includes(domain)} onChange={(checked) => toggleEnabledDomain(domain, checked)}>
                {domain}
              </Tag.CheckableTag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">Add domains above first.</Typography.Text>
        )}
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
        Only enabled domains are used for registration. Click an enabled tag to remove it.
      </Typography.Text>
    </Card>
  )
}

function SolverStatus() {
  const { t } = useTranslation()
  const [running, setRunning] = useState<boolean | null>(null)

  const checkSolver = async () => {
    try {
      const d = await apiFetch('/solver/status')
      setRunning(d.running)
    } catch { setRunning(false) }
  }

  const restartSolver = async () => {
    await apiFetch('/solver/restart', { method: 'POST' })
    setRunning(null)
    setTimeout(checkSolver, 2000)
  }

  useEffect(() => {
    checkSolver()
    const timer = window.setInterval(checkSolver, 5000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Card title="Turnstile Solver" size="small" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Space size={8}>
          {running === null ? <SyncOutlined spin style={{ color: '#7a8ba3' }} /> : running ? <CheckCircleOutlined style={{ color: '#10b981' }} /> : <CloseCircleOutlined style={{ color: '#ef4444' }} />}
          <span style={{ color: running ? '#10b981' : '#7a8ba3', fontWeight: 500 }}>
            {running === null ? t('common.loading') : running ? t('status.running') : t('status.stopped')}
          </span>
        </Space>
        <Button size="small" onClick={restartSolver}>Restart Solver</Button>
      </div>
    </Card>
  )
}

function IntegrationsPanel() {
  const { t } = useTranslation()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [updateMode, setUpdateMode] = useState<'tag' | 'branch'>('tag')
  const [resultModal, setResultModal] = useState({ open: false, title: '', ok: true, content: '' })

  const showResultModal = (title: string, data: unknown, ok = true) => {
    setResultModal({ open: true, title, ok, content: formatResultText(data) })
  }

  const load = async () => {
    setLoading(true)
    try {
      const [d, cfg] = await Promise.all([apiFetch('/integrations/services'), apiFetch('/config')])
      setItems(d.items || [])
      const mode = String(cfg?.external_apps_update_mode || 'tag').trim().toLowerCase()
      setUpdateMode(mode === 'branch' ? 'branch' : 'tag')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 5000)
    return () => window.clearInterval(timer)
  }, [])

  const doAction = async (key: string, request: Promise<any>) => {
    setBusy(key)
    try {
      const result = await request
      await load()
      message.success('Operation completed')
      showResultModal('Result', result, true)
    } catch (e: any) {
      message.error(e?.message || 'Operation failed')
      showResultModal('Result', e?.message || e || 'Failed', false)
      await load()
    } finally { setBusy('') }
  }

  const backfill = async (platforms: string[], label: string, busyKey: string) => {
    setBusy(busyKey)
    try {
      const d = await apiFetch('/integrations/backfill', { method: 'POST', body: JSON.stringify({ platforms }) })
      message.success(`${label} backfill complete: ${d.success} / ${d.total}`)
      showResultModal(`${label} backfill result`, d, true)
    } catch (e: any) {
      message.error(e?.message || `${label} backfill failed`)
      showResultModal(`${label} backfill result`, e?.message || e || 'Failed', false)
    } finally { setBusy('') }
  }

  const updateInstallMode = async (nextMode: 'tag' | 'branch') => {
    setBusy('update-mode')
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ data: { external_apps_update_mode: nextMode } }) })
      setUpdateMode(nextMode)
      message.success(nextMode === 'tag' ? 'Switched to tag mode' : 'Switched to branch mode')
    } catch (e: any) {
      message.error(e?.message || 'Switch failed')
    } finally { setBusy('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Modal
        open={resultModal.open}
        title={resultModal.title}
        onCancel={() => setResultModal((v) => ({ ...v, open: false }))}
        onOk={() => setResultModal((v) => ({ ...v, open: false }))}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={760}
      >
        <Typography.Paragraph style={{ marginBottom: 8, color: resultModal.ok ? '#10b981' : '#ef4444' }}>
          {resultModal.ok ? 'Operation completed.' : 'Operation failed.'}
        </Typography.Paragraph>
        <pre style={{ margin: 0, maxHeight: 420, overflow: 'auto', padding: 12, borderRadius: 8, background: 'rgba(127,127,127,0.08)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {resultModal.content}
        </pre>
      </Modal>

      <Card title="Install/Update Strategy">
        <Space wrap align="center">
          <Select style={{ width: 320 }} value={updateMode} options={SELECT_FIELDS.external_apps_update_mode} onChange={(value) => setUpdateMode(value as 'tag' | 'branch')} />
          <Button type="primary" loading={busy === 'update-mode'} onClick={() => updateInstallMode(updateMode)}>Save Strategy</Button>
        </Space>
      </Card>

      <Card title="Batch Operations">
        <Space wrap>
          <Button loading={busy === 'start-all'} onClick={() => doAction('start-all', apiFetch('/integrations/services/start-all', { method: 'POST' }))}>Start All (installed)</Button>
          <Button loading={busy === 'stop-all'} onClick={() => doAction('stop-all', apiFetch('/integrations/services/stop-all', { method: 'POST' }))}>Stop All</Button>
          <Button loading={loading} onClick={load}>{t('common.refresh')}</Button>
        </Space>
      </Card>

      {items.map((item) => (
        <Card key={item.name} title={item.label}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              Status:
              <Tag color={item.running ? 'green' : 'default'} style={{ marginLeft: 8 }}>{item.running ? t('status.running') : t('status.stopped')}</Tag>
              <Tag color={item.repo_exists ? 'blue' : 'orange'} style={{ marginLeft: 8 }}>{item.repo_exists ? 'Installed' : 'Not installed'}</Tag>
              {item.pid ? <span style={{ marginLeft: 8 }}>PID: {item.pid}</span> : null}
            </div>
            <div>Directory: <Typography.Text copyable>{item.repo_path}</Typography.Text></div>
            {item.url ? <div>URL: <Typography.Text copyable>{item.url}</Typography.Text></div> : null}
            {item.management_url ? <div>Management: <Typography.Text copyable>{item.management_url}</Typography.Text></div> : null}
            {item.management_key ? <div>Key: <Typography.Text copyable>{item.management_key}</Typography.Text></div> : null}
            <div>Log: <Typography.Text copyable>{item.log_path}</Typography.Text></div>
            {item.last_error ? <div style={{ color: '#ef4444' }}>Last error: {item.last_error}</div> : null}
            <Space wrap>
              {item.management_url && <Button onClick={() => window.open(item.management_url, '_blank')}>Open Management</Button>}
              {!item.repo_exists ? (
                <Button type="primary" loading={busy === `install-${item.name}`} onClick={() => doAction(`install-${item.name}`, apiFetch(`/integrations/services/${item.name}/install`, { method: 'POST' }))}>Install Latest</Button>
              ) : (
                <Button loading={busy === `install-${item.name}`} onClick={() => doAction(`install-${item.name}`, apiFetch(`/integrations/services/${item.name}/install`, { method: 'POST' }))}>Update to Latest</Button>
              )}
              <Button loading={busy === `start-${item.name}`} disabled={!item.repo_exists} onClick={() => doAction(`start-${item.name}`, apiFetch(`/integrations/services/${item.name}/start`, { method: 'POST' }))}>Start</Button>
              <Button loading={busy === `stop-${item.name}`} onClick={() => doAction(`stop-${item.name}`, apiFetch(`/integrations/services/${item.name}/stop`, { method: 'POST' }))}>Stop</Button>
              <Button danger loading={busy === `uninstall-${item.name}`} disabled={!item.repo_exists} onClick={() => {
                if (!window.confirm(`Uninstall ${item.label}?\nThis will stop the service and delete the local plugin directory.`)) return
                doAction(`uninstall-${item.name}`, apiFetch(`/integrations/services/${item.name}/uninstall`, { method: 'POST' }))
              }}>Uninstall</Button>
              {item.name === 'grok2api' && <Button loading={busy === 'backfill-grok'} onClick={() => backfill(['grok'], 'Grok', 'backfill-grok')}>Backfill Grok accounts</Button>}
              {item.name === 'kiro-manager' && <Button loading={busy === 'backfill-kiro'} onClick={() => backfill(['kiro'], 'Kiro', 'backfill-kiro')}>Backfill Kiro accounts</Button>}
            </Space>
          </Space>
        </Card>
      ))}
    </div>
  )
}

function ContributionPanel({ form, onSave, saving, saved }: { form: any; onSave: () => Promise<void>; saving: boolean; saved: boolean }) {
  const [loadingStats, setLoadingStats] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState<number>(CONTRIBUTION_REDEEM_OPTIONS[0])
  const [statsResponse, setStatsResponse] = useState<Record<string, unknown> | null>(null)
  const [redeemResponse, setRedeemResponse] = useState<Record<string, unknown> | null>(null)
  const [statsError, setStatsError] = useState('')
  const [bindingCustom, setBindingCustom] = useState(false)
  const [customEmail, setCustomEmail] = useState('')
  const [customStatsResponse, setCustomStatsResponse] = useState<Record<string, unknown> | null>(null)
  const [customBalanceResponse, setCustomBalanceResponse] = useState<Record<string, unknown> | null>(null)
  const [loadingCustomStats, setLoadingCustomStats] = useState(false)

  const contributionEnabled = Form.useWatch('contribution_enabled', form)
  const contributionMode = String(Form.useWatch('contribution_mode', form) || 'codex').trim()
  const contributionServerUrl = String(Form.useWatch('contribution_server_url', form) || '').trim()
  const contributionKey = String(Form.useWatch('contribution_key', form) || '').trim()
  const customContributionUrl = String(Form.useWatch('custom_contribution_url', form) || '').trim()
  const customContributionToken = String(Form.useWatch('custom_contribution_token', form) || '').trim()
  const isCustomMode = contributionMode === 'custom'

  const rawData = asRecord(statsResponse?.['data'])
  const serverInfo = pickRecord(rawData, ['server_info', 'server', 'server_stats', 'stats']) || rawData
  const keyInfo = pickRecord(rawData, ['key_info', 'keyInfo', 'public_key_info', 'quota']) || rawData
  const keyFromStats = pickString(keyInfo, ['key', 'public_key', 'api_key']) || contributionKey
  const keyBalance = pickNumber(keyInfo, ['balance_usd', 'balance', 'current_balance', 'remaining_balance_usd']) ?? pickNumber(rawData, ['balance_usd', 'balance', 'current_balance'])
  const keySource = pickString(keyInfo, ['source', 'key_source', 'origin']) || '-'
  const boundAccounts = pickNumber(keyInfo, ['bound_account_count', 'bind_account_count', 'bound_accounts', 'account_count']) ?? (Array.isArray(keyInfo?.['accounts']) ? (keyInfo as any)['accounts'].length : null)
  const settlementAmount = pickNumber(keyInfo, ['settlement_amount_usd', 'settlement_amount', 'settled_amount_usd']) ?? pickNumber(rawData, ['settlement_amount_usd', 'settlement_amount'])
  const serverQuotaAccountCount = pickNumber(serverInfo, ['quota_account_count'])
  const serverQuotaTotal = pickNumber(serverInfo, ['quota_total'])
  const serverQuotaUsed = pickNumber(serverInfo, ['quota_used'])
  const serverQuotaRemaining = pickNumber(serverInfo, ['quota_remaining'])
  const serverQuotaUsedPercent = pickNumber(serverInfo, ['quota_used_percent'])
  const serverQuotaRemainingPercent = pickNumber(serverInfo, ['quota_remaining_percent'])
  const serverQuotaRemainingAccounts = pickNumber(serverInfo, ['quota_remaining_accounts'])
  const redeemData = asRecord(redeemResponse?.['data']) || asRecord(redeemResponse)
  const redeemCode = pickString(redeemData, ['code', 'redeem_code', 'voucher_code'])
  const redeemedAmountUSD = pickNumber(redeemData, ['redeemed_amount_usd', 'redeemed_amount', 'amount_usd'])
  const redeemSuccessText = redeemResponse ? `Redeemed! Amount: ${redeemedAmountUSD !== null ? formatDisplayNumber(redeemedAmountUSD, 2) : '-'} Code: ${redeemCode || '-'}` : ''

  const fetchStats = async (silent = false, keyOverride?: string) => {
    if (!contributionEnabled) { if (!silent) message.warning('Enable contribution mode first'); return }
    if (!contributionServerUrl) { if (!silent) message.error('Enter server URL first'); return }
    setLoadingStats(true); setStatsError('')
    try {
      const data = await apiFetch('/contribution/quota-stats', { method: 'POST', body: JSON.stringify({ server_url: contributionServerUrl, key: keyOverride ?? contributionKey }) })
      setStatsResponse(asRecord(data))
      if (!silent) message.success('Quota info refreshed')
    } catch (e: any) {
      const detail = String(e?.message || 'Failed to fetch quota info')
      setStatsError(detail)
      if (!silent) message.error(detail)
    } finally { setLoadingStats(false) }
  }

  const doRedeem = async () => {
    if (!contributionEnabled) { message.warning('Enable contribution mode first'); return }
    if (!contributionServerUrl) { message.error('Enter server URL first'); return }
    if (!contributionKey) { message.error('Enter API Key first'); return }
    if (!window.confirm(`Confirm redemption of ${redeemAmount}?`)) return
    setRedeeming(true)
    try {
      const data = await apiFetch('/contribution/redeem', { method: 'POST', body: JSON.stringify({ server_url: contributionServerUrl, key: contributionKey, amount_usd: redeemAmount }) })
      const result = asRecord(data)
      const payload = asRecord(result?.['data']) || result
      const code = pickString(payload, ['code', 'redeem_code', 'voucher_code'])
      const amount = pickNumber(payload, ['redeemed_amount_usd', 'redeemed_amount', 'amount_usd'])
      setRedeemResponse(result)
      message.success(amount !== null || code ? `Redeemed! Amount: ${amount !== null ? formatDisplayNumber(amount, 2) : '-'} Code: ${code || '-'}` : 'Redemption successful')
      await fetchStats(true)
    } catch (e: any) {
      const detail = String(e?.message || 'Redemption failed')
      setRedeemResponse({ ok: false, error: detail })
      message.error(detail)
    } finally { setRedeeming(false) }
  }

  const doGenerateKey = async () => {
    if (!contributionServerUrl) { message.error('Enter server URL first'); return }
    setCreatingKey(true)
    try {
      const result = await apiFetch('/contribution/generate-key', { method: 'POST', body: JSON.stringify({ server_url: contributionServerUrl }) })
      const payload = asRecord(asRecord(result)?.data)
      const generated = pickString(payload, ['key', 'api_key', 'public_key'])
      if (!generated) throw new Error('Server did not return a valid key')
      form.setFieldValue('contribution_key', generated)
      message.success('API Key generated and filled. Click Save Settings.')
      if (contributionEnabled) await fetchStats(true, generated)
    } catch (e: any) {
      message.error(String(e?.message || 'Failed to generate key'))
    } finally { setCreatingKey(false) }
  }

  const doBindCustom = async () => {
    if (!customEmail.trim()) { message.error('Enter email'); return }
    if (!customContributionUrl) { message.error('Enter custom server URL first'); return }
    setBindingCustom(true)
    try {
      const data = await apiFetch('/contribution/custom/bind', { method: 'POST', body: JSON.stringify({ email: customEmail.trim(), server_url: customContributionUrl }) })
      const token = pickString(asRecord(data), ['token'])
      if (token) { form.setFieldValue('custom_contribution_token', token); message.success('Bound! Token auto-filled. Click Save Settings.'); setCustomEmail('') }
      else message.success('Binding successful')
    } catch (e: any) { message.error(String(e?.message || 'Binding failed')) }
    finally { setBindingCustom(false) }
  }

  const fetchCustomStats = async () => {
    if (!contributionEnabled) { message.warning('Enable contribution mode first'); return }
    if (!customContributionUrl) { message.error('Enter custom server URL first'); return }
    if (!customContributionToken) { message.error('Bind email to get token first'); return }
    setLoadingCustomStats(true)
    try {
      const [status, balance] = await Promise.all([
        apiFetch(`/contribution/custom/status?server_url=${encodeURIComponent(customContributionUrl)}&token=${encodeURIComponent(customContributionToken)}`),
        apiFetch(`/contribution/custom/balance?server_url=${encodeURIComponent(customContributionUrl)}&token=${encodeURIComponent(customContributionToken)}`),
      ])
      setCustomStatsResponse(asRecord(status))
      setCustomBalanceResponse(asRecord(balance))
      message.success('Info refreshed')
    } catch (e: any) { message.error(String(e?.message || 'Failed to fetch info')) }
    finally { setLoadingCustomStats(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Configuration">
        <Alert type="warning" showIcon banner style={{ marginBottom: 12 }}
          message="When contribution mode is enabled, registered accounts will only be uploaded to the contribution server"
          description="CPA / CodexProxy / Sub2API auto-upload will be disabled to avoid duplicate reporting."
        />
        <Form.Item name="contribution_enabled" label="Enable" valuePropName="checked">
          <Switch checkedChildren="On" unCheckedChildren="Off" />
        </Form.Item>
        <Form.Item name="contribution_mode" label="Contribution mode">
          <Select>
            <Select.Option value="codex">Codex2API</Select.Option>
            <Select.Option value="custom">Custom contribution system</Select.Option>
          </Select>
        </Form.Item>
        {!isCustomMode ? (
          <>
            <Form.Item name="contribution_server_url" label="Server URL" rules={[{ required: true, message: 'Enter server URL' }]}>
              <Input placeholder="http://server.example.com:7317/" />
            </Form.Item>
            <Form.Item name="contribution_key" label="API Key">
              <Input placeholder="Leave empty to auto-create" addonAfter={
                <Button type="link" size="small" loading={creatingKey} onClick={() => { void doGenerateKey() }} style={{ paddingInline: 0 }}>
                  No key? Generate one
                </Button>
              } />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="custom_contribution_url" label="Custom server URL" rules={[{ required: true, message: 'Enter server URL' }]}>
              <Input placeholder="http://127.0.0.1:5000" />
            </Form.Item>
            <Form.Item label="Bind email">
              <Space.Compact style={{ width: '100%' }}>
                <Input placeholder="Enter email to bind account" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} onPressEnter={() => { void doBindCustom() }} />
                <Button type="primary" loading={bindingCustom} onClick={() => { void doBindCustom() }}>Bind</Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="custom_contribution_token" label="Token">
              <Input.TextArea placeholder="Auto-filled after binding email" rows={3} />
            </Form.Item>
          </>
        )}
        <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} block>
          {saved ? 'Saved ✓' : 'Save Settings'}
        </Button>
      </Card>

      {!isCustomMode ? (
        <>
          <Card title="Info" extra={<Button loading={loadingStats} onClick={() => { void fetchStats() }}>Refresh</Button>}>
            {!contributionEnabled ? (
              <Alert type="info" showIcon message="Enable contribution mode to view server and key info." />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {statsError ? <Alert type="error" showIcon message={statsError} /> : null}
                <div>
                  <Typography.Text strong>Server Info</Typography.Text>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <Tag color="blue">Accounts: {formatDisplayNumber(serverQuotaAccountCount)}</Tag>
                    <Tag color="geekblue">Total quota: {formatDisplayNumber(serverQuotaTotal)}</Tag>
                    <Tag color="volcano">Used quota: {formatDisplayNumber(serverQuotaUsed)}</Tag>
                    <Tag color="green">Remaining quota: {formatDisplayNumber(serverQuotaRemaining)}</Tag>
                    <Tag color="orange">Used %: {formatDisplayPercent(serverQuotaUsedPercent)}</Tag>
                    <Tag color="cyan">Remaining %: {formatDisplayPercent(serverQuotaRemainingPercent)}</Tag>
                    <Tag color="purple">Remaining accounts: {formatDisplayNumber(serverQuotaRemainingAccounts, 2)}</Tag>
                  </div>
                </div>
                <div>
                  <Typography.Text strong>API Key</Typography.Text>
                  <Space style={{ marginLeft: 8 }}>
                    <Typography.Text copyable={keyFromStats ? { text: keyFromStats } : undefined}>{keyFromStats || '-'}</Typography.Text>
                  </Space>
                </div>
                <div>
                  <Typography.Text strong>Key Info</Typography.Text>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                    <Tag color="blue">Balance: {keyBalance ?? '-'}</Tag>
                    <Tag color="geekblue">Source: {keySource}</Tag>
                    <Tag color="cyan">Bound accounts: {boundAccounts ?? '-'}</Tag>
                    <Tag color="purple">Settlement: {settlementAmount ?? '-'}</Tag>
                  </div>
                </div>
              </Space>
            )}
          </Card>

          <Card title="Redeem">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text>Current key balance: {keyBalance ?? '-'}</Typography.Text>
              <Form.Item label="Redeem amount" style={{ marginBottom: 0 }}>
                <Select value={redeemAmount} onChange={setRedeemAmount} style={{ width: 240 }}
                  options={CONTRIBUTION_REDEEM_OPTIONS.map((amount) => ({ label: String(amount), value: amount }))} />
              </Form.Item>
              <Button type="primary" danger onClick={() => { void doRedeem() }} loading={redeeming}>Confirm Redeem</Button>
              {redeemResponse ? (
                <Alert type={redeemResponse.ok === false ? 'error' : 'success'} showIcon
                  message={redeemResponse.ok === false ? `Redeem failed: ${String(redeemResponse.error || '-')}` : redeemSuccessText}
                  description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{formatResultText(redeemResponse)}</pre>}
                />
              ) : null}
            </Space>
          </Card>
        </>
      ) : (
        <Card title="Info" extra={<Button loading={loadingCustomStats} onClick={() => { void fetchCustomStats() }}>Refresh</Button>}>
          {!contributionEnabled ? (
            <Alert type="info" showIcon message="Enable contribution mode to view info." />
          ) : !customContributionToken ? (
            <Alert type="warning" showIcon message="Bind email to get token first" />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Typography.Text strong>Balance</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">Balance: {pickNumber(asRecord(customBalanceResponse), ['balance']) ?? '-'}</Tag>
                </div>
              </div>
              <div>
                <Typography.Text strong>Contribution records</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="green">Success: {pickNumber(asRecord(customStatsResponse), ['success_count']) ?? '-'}</Tag>
                  <Tag color="orange">Pending: {pickNumber(asRecord(customStatsResponse), ['pending_count']) ?? '-'}</Tag>
                  <Tag color="red">Failed: {pickNumber(asRecord(customStatsResponse), ['failed_count']) ?? '-'}</Tag>
                </div>
              </div>
            </Space>
          )}
        </Card>
      )}
    </div>
  )
}

function SecurityPanel() {
  const { message: msg } = App.useApp()
  const { t } = useTranslation()
  const [status, setStatus] = useState<{ has_password: boolean; has_totp: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [enableForm] = Form.useForm()
  const [pwForm] = Form.useForm()
  const [codeForm] = Form.useForm()
  const [totpSetupState, setTotpSetupState] = useState<'idle' | 'setup'>('idle')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpUri, setTotpUri] = useState('')

  const loadStatus = async () => {
    try { const s = await apiFetch('/auth/status'); setStatus(s) } catch {}
  }

  useEffect(() => { loadStatus() }, [])

  const handleEnable = async (values: { password: string; confirm: string }) => {
    if (values.password !== values.confirm) { msg.error('Passwords do not match'); return }
    setLoading(true)
    try {
      const d = await apiFetch('/auth/setup', { method: 'POST', body: JSON.stringify({ password: values.password }) })
      localStorage.setItem('auth_token', d.access_token)
      msg.success('Password protection enabled')
      enableForm.resetFields()
      await loadStatus()
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  const handleDisableAuth = async () => {
    setLoading(true)
    try {
      await apiFetch('/auth/disable', { method: 'POST' })
      localStorage.removeItem('auth_token')
      msg.success('Password protection disabled')
      await loadStatus()
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  const handleChangePassword = async (values: { current_password: string; new_password: string; confirm: string }) => {
    if (values.new_password !== values.confirm) { msg.error('New passwords do not match'); return }
    setLoading(true)
    try {
      await apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: values.current_password, new_password: values.new_password }) })
      msg.success('Password updated')
      pwForm.resetFields()
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  const handleSetupTotp = async () => {
    setLoading(true)
    try {
      const d = await apiFetch('/auth/2fa/setup')
      setTotpSecret(d.secret); setTotpUri(d.uri); setTotpSetupState('setup')
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  const handleEnableTotp = async (values: { code: string }) => {
    setLoading(true)
    try {
      await apiFetch('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ secret: totpSecret, code: values.code }) })
      msg.success('Two-factor authentication enabled')
      setTotpSetupState('idle'); codeForm.resetFields(); await loadStatus()
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  const handleDisableTotp = async () => {
    setLoading(true)
    try {
      await apiFetch('/auth/2fa/disable', { method: 'POST' })
      msg.success('Two-factor authentication disabled')
      await loadStatus()
    } catch (e: any) { msg.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title={t('settings.setPassword')} extra={status?.has_password ? <Tag color="green"><CheckCircleOutlined /> Enabled</Tag> : <Tag color="default"><CloseCircleOutlined /> Disabled</Tag>}>
        {!status?.has_password ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">When enabled, a password is required to access the panel. By default anyone with access to this URL can use it.</Typography.Text>
            <Form form={enableForm} layout="vertical" onFinish={handleEnable} requiredMark={false} style={{ maxWidth: 360, marginTop: 8 }}>
              <Form.Item name="password" label={t('settings.newPassword')} rules={[{ required: true, message: 'Enter password' }, { min: 6, message: 'At least 6 characters' }]}>
                <Input.Password placeholder="At least 6 characters" />
              </Form.Item>
              <Form.Item name="confirm" label={t('settings.confirmPassword')} rules={[{ required: true, message: 'Re-enter password' }]}>
                <Input.Password placeholder="Re-enter password" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={loading} icon={<LockOutlined />}>Enable Password Protection</Button>
              </Form.Item>
            </Form>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">Password protection is enabled. Disabling it allows anyone to access without a password.</Typography.Text>
            <Button danger loading={loading} onClick={handleDisableAuth}>Disable Password Protection</Button>
          </Space>
        )}
      </Card>

      {status?.has_password && (
        <>
          <Card title="Change Password">
            <Form form={pwForm} layout="vertical" onFinish={handleChangePassword} requiredMark={false} style={{ maxWidth: 360 }}>
              <Form.Item name="current_password" label={t('settings.currentPassword')} rules={[{ required: true, message: 'Enter current password' }]}>
                <Input.Password placeholder="Current password" />
              </Form.Item>
              <Form.Item name="new_password" label={t('settings.newPassword')} rules={[{ required: true, message: 'Enter new password' }, { min: 6, message: 'At least 6 characters' }]}>
                <Input.Password placeholder="New password (at least 6 characters)" />
              </Form.Item>
              <Form.Item name="confirm" label={t('settings.confirmPassword')} rules={[{ required: true, message: 'Re-enter new password' }]}>
                <Input.Password placeholder="Re-enter new password" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>Update Password</Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Two-Factor Authentication (2FA)" extra={status?.has_totp ? <Tag color="green"><CheckCircleOutlined /> Enabled</Tag> : <Tag color="default"><CloseCircleOutlined /> Disabled</Tag>}>
            {status?.has_totp ? (
              <Space direction="vertical">
                <Typography.Text type="secondary">Login requires a 6-digit code from Google Authenticator / Authy.</Typography.Text>
                <Button danger loading={loading} onClick={handleDisableTotp}>Disable 2FA</Button>
              </Space>
            ) : totpSetupState === 'idle' ? (
              <Space direction="vertical">
                <Typography.Text type="secondary">When enabled, login requires both your password and a code from an authenticator app.</Typography.Text>
                <Button type="primary" loading={loading} onClick={handleSetupTotp} icon={<SafetyOutlined />}>Enable 2FA</Button>
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text strong>1. Scan the QR code with your authenticator app</Typography.Text>
                <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <QRCode value={totpUri} size={180} />
                  <div style={{ flex: 1 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Can't scan? Enter the key manually:</Typography.Text>
                    <Typography.Paragraph copyable style={{ fontFamily: 'monospace', fontSize: 13, marginTop: 4 }}>{totpSecret}</Typography.Paragraph>
                  </div>
                </div>
                <Typography.Text strong>2. Enter the 6-digit code from your app to confirm</Typography.Text>
                <Form form={codeForm} layout="inline" onFinish={handleEnableTotp}>
                  <Form.Item name="code" rules={[{ required: true, message: 'Enter code' }, { len: 6, message: '6 digits' }]}>
                    <Input placeholder="000000" maxLength={6} style={{ width: 140, letterSpacing: 4, textAlign: 'center' }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>Confirm</Button>
                  </Form.Item>
                  <Form.Item>
                    <Button onClick={() => setTotpSetupState('idle')}>{t('common.cancel')}</Button>
                  </Form.Item>
                </Form>
              </Space>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('register')
  const currentMailProviderRaw = String(Form.useWatch('mail_provider', form) || '')
  const currentMailImportSource = String(Form.useWatch('mail_import_source', form) || 'microsoft')
  const currentMailProvider = resolveEffectiveMailProvider(currentMailProviderRaw, currentMailImportSource)
  const showFloatingSaveButton = activeTab === 'mailbox' || activeTab === 'chatgpt'
  const contentPaneRef = useRef<HTMLDivElement | null>(null)
  const [floatingSaveBounds, setFloatingSaveBounds] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    apiFetch('/config').then((data) => {
      const configMailProvider = String(data.mail_provider || 'luckmail')
      const isMailImportProvider = configMailProvider === 'microsoft' || configMailProvider === 'outlook' || configMailProvider === 'applemail'
      if (!data.mail_provider) data.mail_provider = 'luckmail'
      if (!data.applemail_base_url) data.applemail_base_url = 'https://www.appleemail.top'
      if (!data.applemail_pool_dir) data.applemail_pool_dir = 'mail'
      if (!data.applemail_mailboxes) data.applemail_mailboxes = 'INBOX,Junk'
      if (!data.outlook_backend) data.outlook_backend = 'graph'
      if (!data.gptmail_base_url) data.gptmail_base_url = 'https://mail.chatgpt.org.uk'
      if (!data.maliapi_base_url) data.maliapi_base_url = 'https://maliapi.215.im/v1'
      if (!data.luckmail_base_url) data.luckmail_base_url = 'https://mails.luckyous.com/'
      if (!String(data.contribution_enabled ?? '').trim()) data.contribution_enabled = false
      if (!data.contribution_server_url) data.contribution_server_url = 'http://new.xem8k5.top:7317/'
      if (!data.contribution_mode) data.contribution_mode = 'codex'
      if (!data.custom_contribution_url) data.custom_contribution_url = 'http://127.0.0.1:5000'
      if (!data.cloudmail_timeout) data.cloudmail_timeout = 30
      data.cpa_enabled = resolveFeatureEnabledConfig(data.cpa_enabled, Boolean(String(data.cpa_api_url ?? '').trim()))
      data.sub2api_enabled = resolveFeatureEnabledConfig(data.sub2api_enabled, Boolean(String(data.sub2api_api_url ?? '').trim() && String(data.sub2api_api_key ?? '').trim()))
      data.cfworker_domains = parseStoredDomainList(data.cfworker_domains)
      data.cfworker_enabled_domains = parseStoredDomainList(data.cfworker_enabled_domains)
      data.cfworker_random_subdomain = parseBooleanConfigValue(data.cfworker_random_subdomain)
      data.cfworker_random_name_subdomain = parseBooleanConfigValue(data.cfworker_random_name_subdomain)
      data.contribution_enabled = parseBooleanConfigValue(data.contribution_enabled)
      data.email_domain_rule_enabled = parseBooleanConfigValue(data.email_domain_rule_enabled)
      if (!String(data.email_domain_level_count ?? '').trim()) data.email_domain_level_count = 2
      data.mail_import_source = configMailProvider === 'applemail' ? 'applemail' : 'microsoft'
      data.mail_provider = isMailImportProvider ? 'mail_import' : configMailProvider
      form.setFieldsValue(data)
    })
  }, [form])

  useEffect(() => {
    if (!showFloatingSaveButton) { setFloatingSaveBounds(null); return }
    const element = contentPaneRef.current
    if (!element) return
    const updateBounds = () => {
      const rect = element.getBoundingClientRect()
      setFloatingSaveBounds({ left: rect.left, width: rect.width })
    }
    updateBounds()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateBounds()) : null
    observer?.observe(element)
    window.addEventListener('resize', updateBounds)
    return () => { observer?.disconnect(); window.removeEventListener('resize', updateBounds) }
  }, [showFloatingSaveButton, activeTab])

  const save = async () => {
    setSaving(true)
    try {
      const values = form.getFieldsValue(true)
      values.mail_provider = resolveEffectiveMailProvider(values.mail_provider, values.mail_import_source)
      delete values.mail_import_source
      const domains = normalizeDomainList(values.cfworker_domains)
      const enabledDomains = normalizeDomainList(values.cfworker_enabled_domains).filter((domain) => domains.includes(domain))
      if (domains.length > 0 && enabledDomains.length === 0) {
        setActiveTab('mailbox')
        message.error('CF Worker requires at least one enabled domain')
        return
      }
      values.cfworker_domains = JSON.stringify(domains)
      values.cfworker_enabled_domains = JSON.stringify(enabledDomains)
      if (domains.length > 0) values.cfworker_domain = ''
      values.cpa_enabled = parseBooleanConfigValue(values.cpa_enabled)
      values.sub2api_enabled = parseBooleanConfigValue(values.sub2api_enabled)
      values.cfworker_random_subdomain = parseBooleanConfigValue(values.cfworker_random_subdomain)
      values.cfworker_random_name_subdomain = parseBooleanConfigValue(values.cfworker_random_name_subdomain)
      values.contribution_enabled = parseBooleanConfigValue(values.contribution_enabled)
      values.email_domain_rule_enabled = parseBooleanConfigValue(values.email_domain_rule_enabled)
      const rawDomainLevelCount = Number.parseInt(String(values.email_domain_level_count ?? '').trim(), 10)
      if (values.mail_provider === 'cfworker' && values.email_domain_rule_enabled) {
        if (!Number.isInteger(rawDomainLevelCount) || rawDomainLevelCount < 2) {
          setActiveTab('mailbox')
          message.error('Domain level count must be an integer >= 2')
          return
        }
      }
      values.email_domain_level_count = Number.isInteger(rawDomainLevelCount) && rawDomainLevelCount >= 2 ? String(rawDomainLevelCount) : '2'
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ data: values }) })
      form.setFieldsValue({
        mail_provider: values.mail_provider === 'microsoft' || values.mail_provider === 'applemail' ? 'mail_import' : values.mail_provider,
        mail_import_source: values.mail_provider === 'applemail' ? 'applemail' : 'microsoft',
        cpa_enabled: values.cpa_enabled, sub2api_enabled: values.sub2api_enabled,
        cfworker_domains: domains, cfworker_enabled_domains: enabledDomains,
        cfworker_domain: domains.length > 0 ? '' : values.cfworker_domain,
        cfworker_random_subdomain: values.cfworker_random_subdomain,
        cfworker_random_name_subdomain: values.cfworker_random_name_subdomain,
        contribution_enabled: values.contribution_enabled, contribution_mode: values.contribution_mode,
        custom_contribution_url: values.custom_contribution_url, custom_contribution_token: values.custom_contribution_token,
        email_domain_rule_enabled: values.email_domain_rule_enabled, email_domain_level_count: values.email_domain_level_count,
      })
      message.success(t('common.savedSuccess'))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const currentTab = TAB_ITEMS.find((tab) => tab.key === activeTab) as TabConfig
  const mailboxSections = activeTab === 'mailbox'
    ? splitMailboxSections(currentTab.sections, currentMailProvider)
    : { defaultSection: null, selectedSection: null, remainingSections: currentTab.sections }
  const floatingSaveWidth = floatingSaveBounds ? Math.max(floatingSaveBounds.width, 0) : 0
  const floatingSaveLeft = floatingSaveBounds && floatingSaveWidth > 0 ? floatingSaveBounds.left + (floatingSaveBounds.width - floatingSaveWidth) / 2 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: showFloatingSaveButton ? 96 : 0 }}>
      {showFloatingSaveButton && floatingSaveBounds && floatingSaveWidth > 0 ? (
        <div style={{ position: 'fixed', left: floatingSaveLeft, bottom: 24, zIndex: 1000, width: floatingSaveWidth, pointerEvents: 'none' }}>
          <div style={{ width: '100%', padding: 0, borderRadius: 0, border: 'none', background: 'transparent', boxShadow: 'none', backdropFilter: 'none', pointerEvents: 'auto' }}>
            <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} block>
              {saved ? `${t('common.savedSuccess')} ✓` : t('settings.saveSettings')}
            </Button>
          </div>
        </div>
      ) : null}

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>{t('settings.title')}</h1>
        <p style={{ color: '#7a8ba3', marginTop: 4 }}>Settings are persisted and used automatically by registration tasks</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 200 }}>
          <Tabs
            tabPosition="left"
            activeKey={activeTab}
            onChange={setActiveTab}
            items={TAB_ITEMS.map((tab) => ({
              key: tab.key,
              label: <span>{tab.icon}<span style={{ marginLeft: 8 }}>{tab.label}</span></span>,
            }))}
          />
        </div>

        <div ref={contentPaneRef} style={{ flex: 1 }}>
          {activeTab === 'integrations' ? (
            <IntegrationsPanel />
          ) : activeTab === 'security' ? (
            <SecurityPanel />
          ) : (
            <Form form={form} layout="vertical">
              {activeTab === 'contribution' ? (
                <ContributionPanel form={form} onSave={save} saving={saving} saved={saved} />
              ) : (
                <>
                  {activeTab === 'captcha' ? <SolverStatus /> : null}
                  {activeTab === 'mailbox' ? (
                    <>
                      {mailboxSections.defaultSection && <ConfigSection key={mailboxSections.defaultSection.title} section={mailboxSections.defaultSection} />}
                      {mailboxSections.selectedSection && <ConfigSection key={`${mailboxSections.selectedSection.title}-selected`} section={mailboxSections.selectedSection} />}
                      <MailImportPanel form={form} />
                      {currentMailProviderRaw === 'cfworker' ? <CFWorkerDomainPoolSection form={form} /> : null}
                      {mailboxSections.remainingSections.map((section) => <ConfigSection key={section.title} section={section} />)}
                      {currentMailProviderRaw !== 'cfworker' ? <CFWorkerDomainPoolSection form={form} /> : null}
                    </>
                  ) : (
                    currentTab.sections.map((section) => <ConfigSection key={section.title} section={section} />)
                  )}
                  {showFloatingSaveButton ? <div style={{ height: 8 }} /> : null}
                  {!showFloatingSaveButton ? (
                    <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} block>
                      {saved ? `${t('common.savedSuccess')} ✓` : t('settings.saveSettings')}
                    </Button>
                  ) : null}
                </>
              )}
            </Form>
          )}
        </div>
      </div>
    </div>
  )
}
