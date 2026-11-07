import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, Alert, Divider, Tag, Space, theme, Modal } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../utils/notify';

const { Title, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { name: 'Sarah', email: 'sarah@parking.dev', icon: <CrownOutlined />, color: 'gold'   },
  { name: 'Mike',  email: 'mike@parking.dev',  icon: <CrownOutlined />, color: 'gold'   },
  { name: 'Admin', email: 'admin@parking.dev', icon: <TeamOutlined />,  color: 'purple' },
];

const LoginPage: React.FC = () => {
  const { token: { colorBgLayout } } = theme.useToken();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showForgotModal = () => {
    Modal.info({
      title: t('login.forgotPasswordModal.title'),
      content: (
        <div>
          <p>{t('login.forgotPasswordModal.content')}</p>
        </div>
      ),
      okText: t('login.forgotPasswordModal.ok'),
      maskClosable: true,
    });
  };

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(values.email, values.password);
    } catch (err) {
      setErrorMsg(errorMessage(err) || t('login.loginFailed'));
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
            className="mb-16"
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

          <div style={{ textAlign: 'right', marginBottom: 24, marginTop: -12 }}>
            <Button type="link" onClick={showForgotModal} style={{ padding: 0, fontSize: 13, height: 'auto' }}>
              {t('login.forgotPassword')}
            </Button>
          </div>

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
              color={acct.color}
              style={{ cursor: 'pointer', padding: '4px 10px', fontSize: 13 }}
              onClick={() => fillDemo(acct.email)}
            >
              {acct.name}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
