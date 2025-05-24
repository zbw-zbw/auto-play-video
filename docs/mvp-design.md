# 视频自动播放插件 MVP 版本设计

## 1. MVP 核心功能

### 1.1 基础功能
- 视频检测：仅支持原生 video 标签
- 进度控制：仅支持直接跳转到末尾
- 播放控制：仅支持播放/暂停
- 速度控制：仅支持 1x/2x/4x 三个预设速度

### 1.2 简化界面
```
+------------------------+
|     插件标题栏         |
+------------------------+
|     视频状态信息       |
+------------------------+
|     一键完成按钮       |
+------------------------+
|     速度选择按钮       |
+------------------------+
```

## 2. 技术实现

### 2.1 文件结构
```
extension/
  ├── manifest.json
  ├── popup/
  │   ├── popup.html
  │   ├── popup.css
  │   └── popup.js
  ├── content/
  │   └── content.js
  └── icons/
      ├── icon16.png
      ├── icon48.png
      └── icon128.png
```

### 2.2 核心代码实现

#### 2.2.1 manifest.json
```json
{
  "manifest_version": 3,
  "name": "视频自动播放助手",
  "version": "1.0",
  "description": "快速完成视频播放的浏览器插件",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"]
    }
  ]
}
```

#### 2.2.2 popup.html
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>视频自动播放助手</h1>
    </div>
    <div class="status">
      <span id="videoCount">检测到 0 个视频</span>
    </div>
    <div class="controls">
      <button id="completeBtn" class="primary-btn">一键完成</button>
      <div class="speed-controls">
        <button class="speed-btn" data-speed="1">1x</button>
        <button class="speed-btn" data-speed="2">2x</button>
        <button class="speed-btn" data-speed="4">4x</button>
      </div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

#### 2.2.3 popup.css
```css
.container {
  width: 300px;
  padding: 16px;
}

.header {
  background: #2196F3;
  color: white;
  padding: 12px;
  margin: -16px -16px 16px -16px;
}

.header h1 {
  margin: 0;
  font-size: 16px;
}

.status {
  margin: 16px 0;
  text-align: center;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.primary-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.speed-controls {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.speed-btn {
  padding: 4px 12px;
  border: 1px solid #2196F3;
  background: white;
  color: #2196F3;
  border-radius: 4px;
  cursor: pointer;
}

.speed-btn.active {
  background: #2196F3;
  color: white;
}
```

#### 2.2.4 content.js
```javascript
// 视频检测和管理
class VideoManager {
  constructor() {
    this.videos = new Set();
    this.observer = null;
  }

  // 初始化
  init() {
    this.findVideos();
    this.setupObserver();
  }

  // 查找视频元素
  findVideos() {
    document.querySelectorAll('video').forEach(video => {
      this.videos.add(video);
    });
  }

  // 设置观察器
  setupObserver() {
    this.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeName === 'VIDEO') {
            this.videos.add(node);
          }
        });
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 获取视频数量
  getVideoCount() {
    return this.videos.size;
  }

  // 完成视频播放
  completeVideos() {
    this.videos.forEach(video => {
      if (video.duration) {
        video.currentTime = video.duration;
      }
    });
  }

  // 设置播放速度
  setPlaybackRate(rate) {
    this.videos.forEach(video => {
      video.playbackRate = rate;
    });
  }
}

// 初始化视频管理器
const videoManager = new VideoManager();
videoManager.init();

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getVideoCount':
      sendResponse({ count: videoManager.getVideoCount() });
      break;
    case 'completeVideos':
      videoManager.completeVideos();
      sendResponse({ success: true });
      break;
    case 'setPlaybackRate':
      videoManager.setPlaybackRate(request.rate);
      sendResponse({ success: true });
      break;
  }
  return true;
});
```

#### 2.2.5 popup.js
```javascript
// 更新视频数量显示
function updateVideoCount() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'getVideoCount'}, function(response) {
      document.getElementById('videoCount').textContent = `检测到 ${response.count} 个视频`;
    });
  });
}

// 一键完成按钮点击事件
document.getElementById('completeBtn').addEventListener('click', function() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'completeVideos'});
  });
});

// 速度按钮点击事件
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const rate = parseFloat(this.dataset.speed);
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'setPlaybackRate',
        rate: rate
      });
    });
    
    // 更新按钮状态
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  updateVideoCount();
  // 默认选中1x速度
  document.querySelector('.speed-btn[data-speed="1"]').classList.add('active');
});
```

## 3. 实现步骤

1. 创建项目目录结构
2. 实现 manifest.json
3. 实现 popup 界面
4. 实现 content script
5. 测试基本功能
6. 打包发布

## 4. 测试计划

### 4.1 功能测试
- 视频检测功能
- 一键完成功能
- 速度调节功能
- 界面响应测试

### 4.2 兼容性测试
- Chrome 最新版本
- 常见视频网站测试

## 5. 后续优化方向

1. 支持更多视频播放器
2. 添加更多播放控制选项
3. 优化用户界面
4. 添加设置功能
5. 支持快捷键 
