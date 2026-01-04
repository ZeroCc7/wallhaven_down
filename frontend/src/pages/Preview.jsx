import React, { useState, useEffect, useCallback } from 'react';
import { Button, Space, Typography, message, Spin } from 'antd';
import { ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const API_BASE_URL = window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin;

const Preview = () => {
  const [currentImage, setCurrentImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fetchRandomWallpaper = useCallback(async () => {
    setLoading(true);
    setImageError(false);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/random-wallpaper`);
      console.log('Fetched wallpaper:', response.data);
      setCurrentImage(response.data.url);
      setTotal(response.data.total);
    } catch (error) {
      const errorMsg = error.response?.data?.message || '获取随机壁纸失败';
      message.error(errorMsg);
      console.error('Error fetching wallpaper:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRandomWallpaper();
  }, [fetchRandomWallpaper]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        fetchRandomWallpaper();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [fetchRandomWallpaper, isFullscreen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        message.error('无法进入全屏模式');
      });
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'fixed',
        top: isFullscreen ? 0 : '64px',
        left: 0,
        width: '100vw',
        height: isFullscreen ? '100vh' : 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        zIndex: isFullscreen ? 9999 : 1,
        margin: 0,
        padding: 0
      }}
    >
      {loading && !currentImage ? (
        <Spin size="large" tip="加载中..." style={{ color: '#fff' }} />
      ) : currentImage ? (
        <>
          <img
            src={`${API_BASE_URL}${currentImage}`}
            alt="Random Wallpaper"
            onError={(e) => {
              console.error('Image load error:', e);
              console.log('Failed image URL:', `${API_BASE_URL}${currentImage}`);
              setImageError(true);
              message.error('图片加载失败');
            }}
            onLoad={() => {
              console.log('Image loaded successfully:', `${API_BASE_URL}${currentImage}`);
              setImageError(false);
            }}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              userSelect: 'none',
              display: imageError ? 'none' : 'block'
            }}
          />
          {imageError && (
            <Text style={{ color: '#fff', fontSize: '16px' }}>
              图片加载失败，请尝试换一张
            </Text>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '16px 24px',
              borderRadius: '8px',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Space direction="vertical" align="center" size="middle">
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={fetchRandomWallpaper}
                  loading={loading}
                  size="large"
                >
                  换一张
                </Button>
                <Button
                  icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleFullscreen}
                  size="large"
                >
                  {isFullscreen ? '退出全屏' : '全屏'}
                </Button>
              </Space>
              <Space size="large">
                <Text style={{ color: '#fff', fontSize: '12px' }}>
                  空格键: 换一张
                </Text>
                <Text style={{ color: '#fff', fontSize: '12px' }}>
                  F键: 全屏
                </Text>
                <Text style={{ color: '#fff', fontSize: '12px' }}>
                  ESC: 退出全屏
                </Text>
              </Space>
              <Text style={{ color: '#aaa', fontSize: '12px' }}>
                库存壁纸总数: {total}
              </Text>
            </Space>
          </div>
        </>
      ) : (
        <Text style={{ color: '#fff' }}>暂无壁纸</Text>
      )}
    </div>
  );
};

export default Preview;
