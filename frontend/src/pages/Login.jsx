import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const API_BASE_URL = window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin;

const Login = ({ setIsAuthenticated }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, values);
      localStorage.setItem('token', response.data.token);
      setIsAuthenticated(true);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      message.error(error.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 'calc(100vh - 200px)' 
    }}>
      <Card 
         title={<Title level={4} style={{ textAlign: 'center', margin: '12px 0' }}>登录 Wallhaven 下载器</Title>} 
         style={{ width: 400 }}
         bordered={false}
       >
        <Form
          name="login"
          onFinish={onFinish}
        >
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入管理密码！' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="管理密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
