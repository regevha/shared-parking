import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, Alert, Divider, Tag, Space, theme } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { labelKey: 'login.demoRoles.user',    email: 'alice@parking.dev',  icon: <UserOutlined />,  color: 'blue'   },
  { labelKey: 'login.demoRoles.owner',   email: 'sarah@parking.dev',  icon: <CrownOutlined />, color: 'gold'   },
  { labelKey: 'login.demoRoles.manager', email: 'admin@parking.dev',  icon: <TeamOutlined />,  color: 'purple' },
];

const LoginPage: React.FC = () => {
  const { token: { colorBgLayout } } = theme.useToken();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(values.email, values.password);
    } catch (err: any) {
      setErrorMsg(err.message || t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string) => {
    form.setFieldsValue({ email, password: 'password123' });
    setErrorMsg(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: colorBgLayout,
      padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4 }}>{t('login.title')}</Title>
          <Text type="secondary">{t('login.subtitle')}</Text>
        </div>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label={t('login.emailLabel')}
            rules={[
              { required: true, message: t('login.emailRequired') },
              { type: 'email', message: t('login.emailInvalid') },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder={t('login.emailPlaceholder')}
              autoComplete="email"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('login.passwordLabel')}
            rules={[{ required: true, message: t('login.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              {t('login.signIn')}
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('login.demoAccounts')}</Text>
        </Divider>

        <Space wrap style={{ justifyContent: 'center', width: '100%' }}>
          {DEMO_ACCOUNTS.map(acct => (
            <Tag
              key={acct.email}
              icon={acct.icon}
              color={acct.color as any}
              style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 13 }}
              onClick={() => fillDemo(acct.email)}
            >
              {t(acct.labelKey)}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
