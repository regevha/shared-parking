import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, Alert, Divider, Tag, Space, theme, Modal } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { errorMessage } from '../utils/notify';
import './LoginPage.css';

const { Title, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { name: 'Sarah', role: 'owner',   email: 'sarah@parking.dev', icon: <CrownOutlined />, color: 'gold'   },
  { name: 'Mike',  role: 'owner',   email: 'mike@parking.dev',  icon: <CrownOutlined />, color: 'gold'   },
  { name: 'Admin', role: 'manager', email: 'admin@parking.dev', icon: <TeamOutlined />,  color: 'purple' },
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
    <div className="login-page" style={{ background: colorBgLayout }}>
      <Card className="login-card">
        <div className="login-header">
          <Title level={3} className="login-title">{t('login.title')}</Title>
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

          <div className="login-forgot">
            <Button type="link" onClick={showForgotModal} className="login-forgot-btn">
              {t('login.forgotPassword')}
            </Button>
          </div>

          <Form.Item className="login-submit-item">
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
          <Text type="secondary" className="login-demo-label">{t('login.demoAccounts')}</Text>
        </Divider>

        <Space wrap className="login-demo-list">
          {DEMO_ACCOUNTS.map(acct => (
            <Tag
              key={acct.email}
              icon={acct.icon}
              color={acct.color}
              role="button"
              tabIndex={0}
              className="login-demo-tag"
              onClick={() => fillDemo(acct.email)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fillDemo(acct.email);
                }
              }}
            >
              {acct.name} · {t(`login.demoRoles.${acct.role}`)}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
