const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');
const multer = require('multer');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DOWNLOAD_BASE_DIR = process.env.DOWNLOAD_DIR || path.join(__dirname, 'downloads');
const DEFAULT_PROXY = process.env.DEFAULT_PROXY || '';
const FRONTEND_DIST_DIR = path.join(__dirname, '../frontend/dist');

// Ensure download directory exists
fs.ensureDirSync(DOWNLOAD_BASE_DIR);

// Serve frontend in production
if (fs.pathExistsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));
}

// Static serving for downloads
app.use('/downloads', express.static(DOWNLOAD_BASE_DIR));

let downloadStatus = {
  isDownloading: false,
  total: 0,
  current: 0,
  message: '',
  lastDownloadPath: null,
};

// Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未授权，请先登录' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: '登录已过期，请重新登录' });
    req.user = decoded;
    next();
  });
};

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(DOWNLOAD_BASE_DIR, 'my-uploads');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件！'));
    }
  }
});

// Upload Route
app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '未选择文件' });
  }
  res.json({ 
    message: '上传成功', 
    file: req.file.filename,
    url: `/downloads/my-uploads/${req.file.filename}`
  });
});

// Login Route
app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ message: '密码错误' });
});

// Proxy Helper
const getProxyAgent = (proxyUrl) => {
  if (!proxyUrl) return null;
  if (proxyUrl.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
};

// Download Logic
const downloadImage = async (url, filePath, apiKey, proxy) => {
  const headers = {};
  if (apiKey && apiKey !== 'x') {
    headers['X-API-Key'] = apiKey;
  }

  const agent = getProxyAgent(proxy);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers,
    httpsAgent: agent,
    httpAgent: agent,
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

app.post('/api/download', authenticate, async (req, res) => {
  if (downloadStatus.isDownloading) {
    return res.status(400).json({ message: '下载任务已在运行中' });
  }

  const config = req.body;
  const {
    apiKey,
    wpNumber = 30,
    startPage = 1,
    maxPage = 99,
    type = 'hits',
    categories = '111',
    filter = '100',
    resolution = '',
    atleast = '1920x1080',
    aspectRatio = '',
    mode = 'favorites',
    order = 'desc',
    query = '',
    color = '',
    user = '',
    collection = 'Default',
    topRange = '',
    minFavorites = 0,
    minFileSize = 0,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    thumbs = '24',
    subfolder = false,
    aiArtFilter = '1',
    proxy = DEFAULT_PROXY,
  } = config;

  downloadStatus = {
    isDownloading: true,
    total: wpNumber,
    current: 0,
    message: '正在初始化下载...',
    lastDownloadPath: null,
  };

  res.json({ message: '下载已启动' });

  const agent = getProxyAgent(proxy);

  try {
    let downloadDirName = `${Date.now()}`;
    if (subfolder && query) {
      downloadDirName = `${query.replace(/[^a-z0-9]/gi, '_')}_${downloadDirName}`;
    }
    const downloadDir = path.join(DOWNLOAD_BASE_DIR, downloadDirName);
    await fs.ensureDir(downloadDir);
    downloadStatus.lastDownloadPath = downloadDir;

    let successCount = 0;
    let page = startPage;

    // Collection ID lookup if type is collections and collection is a name
    let targetCollectionId = collection;
    if (type === 'collections' && user && isNaN(collection)) {
      try {
        downloadStatus.message = `正在查找收藏集 "${collection}" 的 ID...`;
        let collUrl = `https://wallhaven.cc/api/v1/collections/${user}`;
        if (apiKey && apiKey !== 'x') collUrl += `?apikey=${apiKey}`;
        const collRes = await axios.get(collUrl, { httpsAgent: agent, httpAgent: agent });
        const collections = collRes.data.data;
        const target = collections.find(c => c.label.toLowerCase() === collection.toLowerCase());
        if (target) {
          targetCollectionId = target.id;
        } else {
          throw new Error(`未找到名为 "${collection}" 的收藏集`);
        }
      } catch (err) {
        throw new Error(`获取收藏集信息失败: ${err.message}`);
      }
    }

    while (successCount < wpNumber && page <= maxPage) {
      let url = `https://wallhaven.cc/api/v1/search?page=${page}&categories=${categories}&purity=${filter}&sorting=${mode}&order=${order}`;
      
      if (apiKey && apiKey !== 'x') url += `&apikey=${apiKey}`;
      if (resolution) url += `&resolutions=${resolution}`;
      if (atleast && !resolution) url += `&atleast=${atleast}`;
      if (aspectRatio) url += `&ratios=${aspectRatio}`;
      if (color) url += `&colors=${color}`;
      if (mode === 'toplist' && topRange) url += `&topRange=${topRange}`;
      if (thumbs) url += `&per_page=${thumbs}`;
      if (aiArtFilter) url += `&ai_art_filter=${aiArtFilter}`;
      
      if (type === 'search' && query) url += `&q=${encodeURIComponent(query)}`;
      if (type === 'tag' && query) url += `&q=id:${encodeURIComponent(query)}`;
      if (type === 'collections' && user) {
        url = `https://wallhaven.cc/api/v1/collections/${user}/${targetCollectionId}?page=${page}`;
        if (apiKey && apiKey !== 'x') url += `&apikey=${apiKey}`;
      }
      if (type === 'useruploads' && user) {
        url += `&q=@${user}`;
      }

      downloadStatus.message = `正在获取第 ${page} 页数据...`;
      const response = await axios.get(url, { httpsAgent: agent, httpAgent: agent });
      const data = response.data.data;

      if (!data || data.length === 0) {
        downloadStatus.message = '未找到更多壁纸。';
        break;
      }

      for (const item of data) {
        if (successCount >= wpNumber) break;

        // Apply filters
        if (item.favorites < minFavorites) continue;
        
        const imgUrl = item.path;
        const fileName = path.basename(imgUrl);
        const filePath = path.join(downloadDir, fileName);

        try {
          downloadStatus.message = `正在下载 ${fileName}... (${successCount + 1}/${wpNumber})`;
          
          // Get file size first if needed
          const headers = {};
          if (apiKey && apiKey !== 'x') headers['X-API-Key'] = apiKey;
          
          const head = await axios.head(imgUrl, { headers, httpsAgent: agent, httpAgent: agent });
          const fileSize = parseInt(head.headers['content-length'] || '0');
          
          if (minFileSize > 0 && fileSize < (minFileSize * 1024)) continue;
          if (maxFileSize > 0 && fileSize > (maxFileSize * 1024)) continue;

          await downloadImage(imgUrl, filePath, apiKey, proxy);
          successCount++;
          downloadStatus.current = successCount;
        } catch (err) {
          console.error(`下载失败 ${imgUrl}:`, err.message);
        }
      }

      if (response.data.meta.last_page <= page) break;
      page++;
    }

    downloadStatus.isDownloading = false;
    downloadStatus.message = `下载完成。成功下载 ${successCount} 张壁纸。`;
  } catch (error) {
    console.error('下载出错:', error);
    downloadStatus.isDownloading = false;
    downloadStatus.message = `错误: ${error.message}`;
  }
});

app.get('/api/status', authenticate, (req, res) => {
  res.json(downloadStatus);
});

// Image Preview APIs
app.get('/api/images', authenticate, async (req, res) => {
  try {
    if (!await fs.pathExists(DOWNLOAD_BASE_DIR)) {
      await fs.ensureDir(DOWNLOAD_BASE_DIR);
    }
    const folders = await fs.readdir(DOWNLOAD_BASE_DIR);
    const folderData = await Promise.all(folders.map(async (folder) => {
      try {
        const folderPath = path.join(DOWNLOAD_BASE_DIR, folder);
        const stats = await fs.stat(folderPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(folderPath);
          const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
          return {
            name: folder,
            path: folder,
            count: images.length,
            time: stats.mtime
          };
        }
      } catch (statError) {
        console.error(`跳过读取项 ${folder}:`, statError.message);
      }
      return null;
    }));
    res.json(folderData.filter(f => f !== null).sort((a, b) => b.time - a.time));
  } catch (error) {
    console.error('获取文件夹列表失败:', error);
    res.status(500).json({ message: '获取文件夹列表失败', error: error.message });
  }
});

app.get('/api/images/:folder', authenticate, async (req, res) => {
  const { folder } = req.params;
  const folderPath = path.join(DOWNLOAD_BASE_DIR, folder);
  try {
    if (!await fs.pathExists(folderPath)) {
      return res.status(404).json({ message: '文件夹不存在' });
    }
    const files = await fs.readdir(folderPath);
    const images = files.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f)).map(f => ({
      name: f,
      url: `/downloads/${folder}/${f}`
    }));
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: '获取图片列表失败' });
  }
});

app.delete('/api/images/:folder', authenticate, async (req, res) => {
  const { folder } = req.params;
  const folderPath = path.join(DOWNLOAD_BASE_DIR, folder);
  try {
    await fs.remove(folderPath);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除失败' });
  }
});

app.get('/api/zip', authenticate, async (req, res) => {
  const { folder } = req.query;
  const targetPath = folder ? path.join(DOWNLOAD_BASE_DIR, folder) : downloadStatus.lastDownloadPath;

  if (!targetPath || !await fs.pathExists(targetPath)) {
    return res.status(404).json({ message: '找不到可打包的目录' });
  }

  try {
    const zip = new AdmZip();
    zip.addLocalFolder(targetPath);
    const zipBuffer = zip.toBuffer();

    const fileName = folder ? `wallpapers_${folder}.zip` : `wallpapers_${Date.now()}.zip`;
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(zipBuffer);
  } catch (error) {
    console.error('打包失败:', error);
    res.status(500).json({ message: '打包失败', error: error.message });
  }
});

// Random wallpaper preview (no authentication required)
app.get('/api/random-wallpaper', async (req, res) => {
  try {
    if (!await fs.pathExists(DOWNLOAD_BASE_DIR)) {
      return res.status(404).json({ message: '暂无已下载的壁纸' });
    }

    const folders = await fs.readdir(DOWNLOAD_BASE_DIR);
    const allImages = [];

    for (const folder of folders) {
      try {
        const folderPath = path.join(DOWNLOAD_BASE_DIR, folder);
        const stats = await fs.stat(folderPath);
        if (stats.isDirectory()) {
          const files = await fs.readdir(folderPath);
          const images = files
            .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
            .map(f => ({
              url: `/downloads/${folder}/${f}`,
              folder: folder,
              name: f
            }));
          allImages.push(...images);
        }
      } catch (err) {
        console.error(`读取文件夹失败 ${folder}:`, err);
      }
    }

    if (allImages.length === 0) {
      return res.status(404).json({ message: '暂无已下载的壁纸' });
    }

    const randomImage = allImages[Math.floor(Math.random() * allImages.length)];

    res.json({
      url: randomImage.url,
      total: allImages.length,
      folder: randomImage.folder,
      name: randomImage.name
    });
  } catch (error) {
    console.error('获取随机壁纸失败:', error);
    res.status(500).json({ message: '获取随机壁纸失败', error: error.message });
  }
});

// For frontend routing support in production (SPA)
if (fs.pathExistsSync(FRONTEND_DIST_DIR)) {
  app.get('*path', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/downloads')) {
      res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});