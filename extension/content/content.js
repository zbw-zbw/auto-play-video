// 检查是否已经初始化
if (window.videoManagerInstance) {
  console.log('VideoManager already initialized');
} else {
  // 视频检测和管理
  class VideoManager {
    constructor() {
      this.videos = new Set();
      this.observer = null;
      this.videoListeners = new Map(); // 存储视频监听器
      this.lastUrl = location.href;
      this.init();
      this.setupUrlListener();
    }

    // 初始化
    init() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.videos.clear();
      this.findVideos();
      this.setupObserver();
      this.setupVideoSrcObserver();
      console.log('VideoManager initialized');
    }

    // 查找视频元素
    findVideos() {
      this.videos.clear();
      document.querySelectorAll('video').forEach(video => {
        this.videos.add(video);
        console.log('Found video element:', video);
      });
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          iframeDoc.querySelectorAll('video').forEach(video => {
            this.videos.add(video);
            console.log('Found video in iframe:', video);
          });
        } catch (e) {
          console.log('Cannot access iframe content:', e);
        }
      });
      console.log('Total videos found:', this.videos.size);
    }

    // 监听video src属性变化
    setupVideoSrcObserver() {
      this.videos.forEach(video => {
        if (video._srcObserver) return;
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
              console.log('Video src changed:', video.src);
              this.onVideoSrcChanged();
            }
          });
        });
        observer.observe(video, { attributes: true, attributeFilter: ['src'] });
        video._srcObserver = observer;
      });
    }

    // src变化时重新检测并自动完成
    onVideoSrcChanged() {
      setTimeout(() => {
        this.init();
        this.checkAutoComplete(true); // 标记为src变化触发
      }, 300); // 延迟，确保新视频加载
    }

    // 监听页面url变化
    setupUrlListener() {
      this._urlCheckInterval = setInterval(() => {
        if (location.href !== this.lastUrl) {
          this.lastUrl = location.href;
          console.log('URL changed:', this.lastUrl);
          this.init();
          this.checkAutoComplete();
        }
      }, 800);
      window.addEventListener('unload', () => {
        clearInterval(this._urlCheckInterval);
      });
    }

    // 设置视频事件监听
    setupVideoListeners(video) {
      this.removeVideoListeners(video);
      const loadedDataHandler = () => {
        console.log('Video loaded:', video);
        this.checkAutoComplete();
      };
      const canPlayHandler = () => {
        console.log('Video can play:', video);
        this.checkAutoComplete();
      };
      video.addEventListener('loadeddata', loadedDataHandler);
      video.addEventListener('canplay', canPlayHandler);
      this.videoListeners.set(video, {
        loadeddata: loadedDataHandler,
        canplay: canPlayHandler
      });
    }

    // 移除视频监听器
    removeVideoListeners(video) {
      const listeners = this.videoListeners.get(video);
      if (listeners) {
        video.removeEventListener('loadeddata', listeners.loadeddata);
        video.removeEventListener('canplay', listeners.canplay);
        this.videoListeners.delete(video);
      }
    }

    // 检查是否需要自动完成视频
    async checkAutoComplete(isSrcChanged = false) {
      try {
        const result = await chrome.storage.sync.get('settings');
        const settings = result.settings || { autoComplete: false };
        if (settings.autoComplete && this.videos.size > 0) {
          let needWait = false;
          this.videos.forEach(video => {
            // 如果是src变化触发，且未加载完成，注册一次性监听
            if (isSrcChanged && video.readyState < 3) {
              needWait = true;
              const onceHandler = () => {
                video.removeEventListener('canplay', onceHandler);
                video.removeEventListener('loadeddata', onceHandler);
                this.completeVideos();
              };
              video.addEventListener('canplay', onceHandler, { once: true });
              video.addEventListener('loadeddata', onceHandler, { once: true });
            }
          });
          if (!needWait) {
            this.completeVideos();
            this.videos.forEach(video => this.removeVideoListeners(video));
          }
        }
      } catch (error) {
        console.error('Error checking auto complete:', error);
      }
    }

    // 设置观察器
    setupObserver() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.observer = new MutationObserver(mutations => {
        let newVideosFound = false;
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'VIDEO') {
              this.videos.add(node);
              newVideosFound = true;
              console.log('New video element detected:', node);
            } else if (node.nodeName === 'IFRAME') {
              try {
                const iframeDoc = node.contentDocument || node.contentWindow.document;
                iframeDoc.querySelectorAll('video').forEach(video => {
                  this.videos.add(video);
                  newVideosFound = true;
                  console.log('New video in iframe detected:', video);
                });
              } catch (e) {
                console.log('Cannot access new iframe content:', e);
              }
            }
          });
        });
        if (newVideosFound) {
          console.log('New videos found, updating count...');
        }
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // 获取视频数量
    getVideoCount() {
      this.findVideos();
      return this.videos.size;
    }

    // 完成视频播放
    completeVideos() {
      console.log('Completing videos, count:', this.videos.size);
      this.videos.forEach(video => {
        try {
          if (video.duration) {
            video.currentTime = video.duration;
            console.log('Set video to end:', video);
          } else {
            this.setupVideoListeners(video);
          }
        } catch (e) {
          console.log('Error completing video:', e);
        }
      });
    }

    // 设置播放速度
    setPlaybackRate(rate) {
      console.log('Setting playback rate to:', rate);
      this.videos.forEach(video => {
        try {
          video.playbackRate = rate;
          console.log('Set video speed:', video);
        } catch (e) {
          console.log('Error setting playback rate:', e);
        }
      });
    }

    // 清理资源
    cleanup() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.videos.forEach(video => this.removeVideoListeners(video));
      this.videoListeners.clear();
      this.videos.clear();
      if (this._urlCheckInterval) {
        clearInterval(this._urlCheckInterval);
      }
      console.log('VideoManager cleaned up');
    }
  }

  // 创建单例实例
  window.videoManagerInstance = new VideoManager();

  // 监听来自popup的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    try {
      switch (request.action) {
        case 'ping':
          sendResponse({ success: true });
          break;
        case 'getVideoCount':
          const count = window.videoManagerInstance.getVideoCount();
          console.log('Sending video count:', count);
          sendResponse({ count: count });
          break;
        case 'completeVideos':
          window.videoManagerInstance.completeVideos();
          sendResponse({ success: true });
          break;
        case 'setPlaybackRate':
          window.videoManagerInstance.setPlaybackRate(request.rate);
          sendResponse({ success: true });
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  });

  // 监听页面卸载事件
  window.addEventListener('unload', () => {
    if (window.videoManagerInstance) {
      window.videoManagerInstance.cleanup();
      window.videoManagerInstance = null;
    }
  });
} 
