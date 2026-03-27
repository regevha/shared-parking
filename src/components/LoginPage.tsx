import React, { useState } from 'react';
import { Form, Input, Button, Typography, Card, Alert, Divider, Tag, Space } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  { label: 'User',    email: 'alice@parking.dev',  icon: <UserOutlined />,  color: 'blue'   },
  { label: 'Owner',   email: 'sarah@parking.dev',  icon: <CrownOutlined />, color: 'gold'   },
  { label: 'Manager', email: 'admin@parking.dev',  icon: <TeamOutlined />,  color: 'purple' },
];

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(values.email, values.password);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
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
      background: 'var(--bg-color, #0a0a0a)',
      padding: 24,
    }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4 }}>Parking Management</Title>
          <Text type="secondary">Sign in to your account</Text>
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
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="you@parking.dev"
              autoComplete="email"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
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
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider plain>
          <Text type="secondary" style={{ fontSize: 12 }}>Demo accounts — password: password123</Text>
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
              {acct.label}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default LoginPage;
