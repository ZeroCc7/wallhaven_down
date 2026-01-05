import React, { useState, useEffect } from 'react';
import { Form, Input, Button, InputNumber, Select, Checkbox, Card, Space, Divider, Typography, Progress, message, Row, Col, Switch, Tooltip, Tabs, List, Image, theme, Empty, Popconfirm, Upload } from 'antd';
import { DownloadOutlined, FileZipOutlined, InfoCircleOutlined, DeleteOutlined, FolderOpenOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE_URL = window.location.origin.includes('localhost') ? 'http://localhost:5000' : window.location.origin;

const Config = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [status, setStatus] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [activeTab, setActiveTab] = useState('config');
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    // Load saved config from localStorage
    const savedConfig = localStorage.getItem('wallhaven_config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        form.setFieldsValue(parsedConfig);
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }

    const fetchStatus = async () => {
      try {
        const tokenStr = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/status`, {
          headers: { Authorization: `Bearer ${tokenStr}` }
        });
        setStatus(response.data);
      } catch (error) { 
        // 401 errors are handled by global interceptor in App.jsx
        if (error.response?.status !== 401) {
          console.error('Failed to fetch status', error);
        }
      }
    };

    const interval = setInterval(fetchStatus, 2000);
    fetchStatus();
    return () => clearInterval(interval);
  }, [form]);

  const fetchFolders = async () => {
    try {
      const tokenStr = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/images`, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      setFolders(response.data);
    } catch (error) {
      if (error.response?.status !== 401) {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
        message.error(`获取文件夹列表失败: ${errorMsg}`);
      }
    }
  };

  const fetchImages = async (folder) => {
    try {
      const tokenStr = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/images/${folder}`, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      setImages(response.data);
      setSelectedFolder(folder);
    } catch (error) {
      if (error.response?.status !== 401) {
        message.error('获取图片列表失败');
      }
    }
  };

  const deleteFolder = async (folder) => {
    try {
      const tokenStr = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/images/${folder}`, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      message.success('文件夹已删除');
      fetchFolders();
      if (selectedFolder === folder) {
        setSelectedFolder(null);
        setImages([]);
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        message.error('删除文件夹失败');
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'preview') {
      fetchFolders();
    }
  }, [activeTab]);

  const onValuesChange = (changedValues, allValues) => {
    // Save on every change to prevent data loss on refresh
    localStorage.setItem('wallhaven_config', JSON.stringify(allValues));
  };

  const handleCustomUpload = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    
    setUploadLoading(true);
    try {
      const tokenStr = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${tokenStr}`
        }
      });
      message.success('图片上传成功');
      fetchFolders(); // 刷新文件夹列表
      if (selectedFolder === 'my-uploads') {
        fetchImages('my-uploads'); // 如果当前就在预览上传文件夹，刷新图片列表
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        message.error('上传失败: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setUploadLoading(false);
    }
    return false; // 阻止自动上传
  };

  const onFinish = async (values) => {
    // Save current config to localStorage
    localStorage.setItem('wallhaven_config', JSON.stringify(values));
    
    setLoading(true);
    try {
      const tokenStr = localStorage.getItem('token');
      // Convert checkbox arrays to bit strings for categories and filter
      const categories = ['general', 'anime', 'people'].map(c => values.categories.includes(c) ? '1' : '0').join('');
      const filter = ['sfw', 'sketchy', 'nsfw'].map(f => values.filter.includes(f) ? '1' : '0').join('');

      const payload = {
        ...values,
        categories,
        filter,
      };

      await axios.post(`${API_BASE_URL}/api/download`, payload, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      message.success('下载任务已启动');
    } catch (error) {
      if (error.response?.status !== 401) {
        message.error(error.response?.data?.message || '启动下载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleZipDownload = async (folderName) => {
    const targetFolder = folderName || (status?.lastDownloadPath ? status.lastDownloadPath.split(/[\\/]/).pop() : null);
    if (!targetFolder) {
      message.warning('没有可打包的内容');
      return;
    }

    setZipping(true);
    try {
      const tokenStr = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/zip`, {
        headers: { Authorization: `Bearer ${tokenStr}` },
        params: { folder: targetFolder },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${targetFolder}.zip`);
      document.body.appendChild(link);
      link.click();
      message.success('已开始下载压缩包');
    } catch (error) {
      if (error.response?.status !== 401) {
        message.error('创建压缩文件失败');
      }
    } finally {
      setZipping(false);
    }
  };

  const configTab = (
    <Row gutter={[24, 24]}>
      <Col xs={24} xl={16}>
        <Card title={<Title level={4} style={{ margin: 0 }}>Wallhaven 下载配置</Title>} variant="borderless">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            onValuesChange={onValuesChange}
            initialValues={{
              apiKey: '',
              wpNumber: 30,
              startPage: 1,
              maxPage: 99,
              type: 'standard',
              categories: ['general', 'anime', 'people'],
              filter: ['sfw'],
              resolution: '',
              atleast: '1920x1080',
              aspectRatio: '16x9,16x10,21x9',
              mode: 'favorites',
              order: 'desc',
              query: 'nature',
              user: 'AksumkA',
              collection: 'Default',
              topRange: '1M',
              minFavorites: 0,
              minFileSize: 600,
              maxFileSize: 10240,
              thumbs: '24',
              subfolder: false,
              color: '',
              aiArtFilter: '1',
              proxy: ''
            }}
          >
            <div style={{ background: token.colorFillAlter, padding: '16px', borderRadius: token.borderRadiusLG, marginBottom: '24px', border: `1px solid ${token.colorBorder}` }}>
              <Title level={5} style={{ marginTop: 0 }}><Space><InfoCircleOutlined /> 核心网络配置</Space></Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="网络代理 (支持 HTTP/SOCKS5)" name="proxy" tooltip="例如 http://127.0.0.1:7890。留空则使用服务器默认配置。">
                    <Input placeholder="http://127.0.0.1:7890" prefix={<EyeOutlined />} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="API 密钥 (用于 NSFW 内容)" name="apiKey" tooltip="可从 wallhaven.cc/settings/account 获取">
                    <Input.Password placeholder="输入您的 API Key" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Title level={5}>1. 基础下载配置</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="每页数量" name="thumbs">
                  <Select>
                    <Option value="24">24 (默认)</Option>
                    <Option value="32">32 (需 API Key)</Option>
                    <Option value="64">64 (需 API Key)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="AI 生成内容" name="aiArtFilter">
                  <Select>
                    <Option value="0">显示 AI 内容</Option>
                    <Option value="1">隐藏 AI 内容</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="子文件夹" name="subfolder" valuePropName="checked">
                  <Switch checkedChildren="开" unCheckedChildren="关" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="下载数量" name="wpNumber">
                  <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="起始页码" name="startPage">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最大页码" name="maxPage">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="最小收藏数" name="minFavorites">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5}>2. 内容过滤器</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="下载类型" name="type">
                  <Select>
                    <Option value="standard">常规 (最新/排行榜/随机)</Option>
                    <Option value="search">关键词搜索 (Search)</Option>
                    <Option value="tag">标签搜索 (Tag ID)</Option>
                    <Option value="collections">收藏集 (Collections)</Option>
                    <Option value="useruploads">用户上传 (User Uploads)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={16}>
                <Form.Item label="分类" name="categories">
                  <Checkbox.Group options={[
                    { label: '常规', value: 'general' },
                    { label: '动漫', value: 'anime' },
                    { label: '人物', value: 'people' }
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="内容纯度" name="filter">
                  <Checkbox.Group options={[
                    { label: '安全 (SFW)', value: 'sfw' },
                    { label: '可疑 (Sketchy)', value: 'sketchy' },
                    { label: '成人 (NSFW)', value: 'nsfw' }
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="颜色过滤 (Hex)" name="color">
                  <Input placeholder="例如: ff0000 (红色)" prefix="#" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5}>3. 尺寸与限制</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="指定分辨率" name="resolution">
                  <Input placeholder="1920x1080" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最小分辨率" name="atleast">
                  <Input placeholder="1920x1080" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="宽高比" name="aspectRatio">
                  <Input placeholder="16x9, 16x10" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="最小文件大小 (KB)" name="minFileSize">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="最大文件大小 (KB)" name="maxFileSize">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Divider />
            <Title level={5}>4. 排序与高级搜索</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="排序模式" name="mode">
                  <Select style={{ width: '100%' }}>
                    <Option value="date_added">添加时间</Option>
                    <Option value="relevance">相关度</Option>
                    <Option value="random">随机</Option>
                    <Option value="views">浏览量</Option>
                    <Option value="favorites">收藏数</Option>
                    <Option value="toplist">排行榜</Option>
                    <Option value="toplist-beta">排行榜 (Beta)</Option>
                    <Option value="hot">热门 (Hot)</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="排行范围" name="topRange">
                  <Select style={{ width: '100%' }}>
                    <Option value="1d">1 天</Option>
                    <Option value="3d">3 天</Option>
                    <Option value="1w">1 周</Option>
                    <Option value="1M">1 个月</Option>
                    <Option value="3M">3 个月</Option>
                    <Option value="6M">6 个月</Option>
                    <Option value="1y">1 年</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="排序顺序" name="order">
                  <Select style={{ width: '100%' }}>
                    <Option value="desc">降序</Option>
                    <Option value="asc">升序</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item label="搜索关键词" name="query">
                  <Input placeholder="关键词或 id:TAG_ID" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="用户名" name="user">
                  <Input placeholder="用于下载收藏集或用户上传" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="收藏集名称" name="collection">
                  <Input placeholder="默认为 Default" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginTop: 24 }}>
              <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={loading || status?.isDownloading} block size="large">
                {status?.isDownloading ? '正在下载...' : '开始下载到服务器'}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>

      <Col xs={24} xl={8}>
        <div style={{ position: 'sticky', top: 88 }}>
          <Card title={<Title level={4} style={{ margin: 0 }}>任务状态与导出</Title>} variant="borderless">
            {status ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  <Text strong>当前状态:</Text>
                  <div style={{ 
                    marginTop: 8, 
                    padding: '12px', 
                    background: token.colorFillAlter, 
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorBorderSecondary}`
                  }}>
                    <Text style={{ color: token.colorText }}>{status.message}</Text>
                  </div>
                </div>
                
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text strong>进度:</Text>
                    <Text>{status.current} / {status.total}</Text>
                  </div>
                  <Progress 
                    percent={Math.round((status.current / status.total) * 100) || 0} 
                    status={status.isDownloading ? 'active' : 'normal'}
                    strokeWidth={12}
                  />
                </div>

                <Divider />
                
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button 
                    type="primary" 
                    ghost
                    icon={<FileZipOutlined />} 
                    onClick={() => handleZipDownload()} 
                    disabled={status.isDownloading || !status.lastDownloadPath}
                    loading={zipping}
                    block
                    size="large"
                  >
                    打包并下载到本地
                  </Button>
                  <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', display: 'block' }}>
                    * 下载完成后，点击上方按钮将图片打包为 ZIP 下载到您的电脑。
                  </Text>
                </Space>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">正在获取服务器状态...</Text>
              </div>
            )}
          </Card>

          <Card style={{ marginTop: 24 }}>
            <Title level={5}>使用提示</Title>
            <ul style={{ paddingLeft: 20, color: token.colorTextSecondary }}>
              <li>NSFW 内容需要提供有效的 API Key。</li>
              <li>网络代理支持 HTTP/HTTPS 和 SOCKS5。</li>
              <li>可以同时设置多个分辨率，用逗号分隔。</li>
              <li>下载的文件将暂存在服务器上，完成后可统一打包。</li>
            </ul>
          </Card>
        </div>
      </Col>
    </Row>
  );

  const previewTab = (
    <Card variant="borderless">
      <Row gutter={24}>
        <Col span={6} style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, minHeight: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}><FolderOpenOutlined /> 下载历史</Title>
            <Upload 
              accept="image/*" 
              showUploadList={false} 
              beforeUpload={handleCustomUpload}
            >
              <Button size="small" icon={<UploadOutlined />} loading={uploadLoading}>上传</Button>
            </Upload>
          </div>
          <List
            dataSource={folders}
            renderItem={item => (
              <List.Item 
                style={{ 
                  cursor: 'pointer', 
                  background: selectedFolder === item.path ? token.colorFillSecondary : 'transparent',
                  padding: '8px 12px',
                  borderRadius: token.borderRadiusSM,
                  marginBottom: '4px'
                }}
                onClick={() => fetchImages(item.path)}
                actions={[
                  <Popconfirm
                    title="确定删除此文件夹吗？"
                    onConfirm={(e) => {
                      e.stopPropagation();
                      deleteFolder(item.path);
                    }}
                    onCancel={(e) => e.stopPropagation()}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  title={<Text strong>{item.name}</Text>}
                  description={<Text type="secondary" style={{ fontSize: '12px' }}>{item.count} 张图片 · {new Date(item.time).toLocaleDateString()}</Text>}
                />
              </List.Item>
            )}
          />
        </Col>
        <Col span={18}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Title level={5} style={{ margin: 0 }}>
              {selectedFolder ? `文件夹: ${selectedFolder}` : '请选择文件夹'}
            </Title>
            {selectedFolder && (
              <Button type="primary" ghost icon={<FileZipOutlined />} onClick={() => handleZipDownload(selectedFolder)}>
                打包此文件夹
              </Button>
            )}
          </div>
          
          {selectedFolder ? (
            <Image.PreviewGroup>
              <Row gutter={[16, 16]}>
                {images.map((img, index) => (
                  <Col key={index} xs={12} sm={8} md={6} lg={4}>
                    <Card
                      hoverable
                      cover={
                        <Image
                          alt={img.name}
                          src={`${API_BASE_URL}${img.url}`}
                          placeholder={true}
                          style={{ height: '120px', objectFit: 'cover' }}
                        />
                      }
                      bodyStyle={{ padding: '8px', textAlign: 'center' }}
                    >
                      <Text ellipsis style={{ fontSize: '11px', width: '100%' }}>{img.name}</Text>
                    </Card>
                  </Col>
                ))}
                {images.length === 0 && <Col span={24}><Empty description="暂无图片" /></Col>}
              </Row>
            </Image.PreviewGroup>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Empty description="请从左侧选择一个文件夹查看图片" />
            </div>
          )}
        </Col>
      </Row>
    </Card>
  );

  return (
    <Tabs 
      activeKey={activeTab} 
      onChange={setActiveTab}
      items={[
        {
          key: 'config',
          label: '下载配置',
          children: configTab,
        },
        {
          key: 'preview',
          label: '已下载预览',
          children: previewTab,
        }
      ]}
    />
  );
};

export default Config;
