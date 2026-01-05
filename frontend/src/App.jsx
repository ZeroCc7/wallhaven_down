import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, message, ConfigProvider, theme, Switch, Space } from 'antd';
import axios from 'axios';
import {
  SettingOutlined,
  LogoutOutlined,
  BulbOutlined,
  BulbFilled,
  GithubOutlined,
  EyeOutlined
} from '@ant-design/icons';
import Login from './pages/Login';
import Config from './pages/Config';
import Preview from './pages/Preview';
import 'antd/dist/reset.css';
import './App.css';

const { Header, Content, Footer } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

const AppContent = ({ isDarkMode, setIsDarkMode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('token'));
  }, [location]);

  // 全局响应拦截器，处理登录过期
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          if (location.pathname !== '/login') {
            navigate('/login');
            message.error(error.response?.data?.message || '登录已过期，请重新登录');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login');
    message.success('已成功退出登录');
  };

  const menuItems = [
    {
      key: '/',
      icon: <SettingOutlined />,
      label: '配置与下载',
      onClick: () => navigate('/'),
    },
    {
      key: '/preview',
      icon: <EyeOutlined />,
      label: '随机预览',
      onClick: () => navigate('/preview'),
    },
    ...(isAuthenticated ? [{
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    }] : []),
  ];

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        width: '100%', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 24px',
        boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.45)' : '0 2px 8px rgba(0,0,0,0.06)',
        background: isDarkMode ? '#141414' : '#fff',
        height: '64px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            color: isDarkMode ? '#fff' : '#1890ff',
            fontSize: '18px',
            fontWeight: 'bold',
            marginRight: '48px',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }} onClick={() => navigate(isAuthenticated ? '/' : '/preview')}>
            <SettingOutlined style={{ marginRight: '8px' }} />
            Wallhaven Downloader
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            style={{ borderBottom: 'none', background: 'transparent', minWidth: '300px' }}
          />
        </div>
        
        <Space size="middle">
          <Switch
            checkedChildren={<BulbFilled />}
            unCheckedChildren={<BulbOutlined />}
            checked={isDarkMode}
            onChange={(checked) => setIsDarkMode(checked)}
          />
          <Button 
            type="text" 
            icon={<GithubOutlined />} 
            href="https://github.com/MacEarl/wallhaven-downloader" 
            target="_blank"
          />
        </Space>
      </Header>

      <Content style={{
        padding: location.pathname === '/preview' ? 0 : '24px',
        flex: '1 0 auto',
        background: location.pathname === '/preview' ? '#000' : (isDarkMode ? '#000' : '#f0f2f5'),
        position: 'relative'
      }}>
        {location.pathname === '/preview' ? (
          <Routes>
            <Route path="/preview" element={<Preview />} />
          </Routes>
        ) : (
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
          }}>
            <Routes>
              <Route path="/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
              <Route
                path="/"
                element={isAuthenticated ? <Config /> : <Navigate to="/login" />}
              />
            </Routes>
          </div>
        )}
      </Content>

      {location.pathname !== '/preview' && (
        <Footer style={{ textAlign: 'center', padding: '24px 50px', flexShrink: 0 }}>
          Wallhaven 壁纸下载器 ©2025 Created by Gemini & Ant Design
        </Footer>
      )}
    </Layout>
  );
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
          borderRadius: 6,
        },
      }}
    >
      <Router>
        <AppContent isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
      </Router>
    </ConfigProvider>
  );
}

export default App;
