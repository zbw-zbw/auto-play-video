// 获取当前有效网页tab
function getCurrentWebTab(callback) {
  chrome.tabs.query({lastFocusedWindow: true}, function(tabs) {
    // 优先找当前激活的可用网页tab
    let webTab = tabs.find(tab =>
      tab.active &&
      tab.url &&
      /^https?:/.test(tab.url)
    );
    // 如果没有激活的网页tab，则找第一个可用网页tab
    if (!webTab) {
      webTab = tabs.find(tab =>
        tab.url &&
        /^https?:/.test(tab.url)
      );
    }
    callback(webTab || null);
  });
}

// 初始化视频计数显示
function initPopup() {
  ensureContentScriptInjected().then(() => {
    updateVideoCount();
    loadSettings();
    initTheme();
  });

  document.getElementById('completeButton').addEventListener('click', function() {
    getCurrentWebTab(tab => {
      if (!tab) {
        showError('请切换到含有视频的网页再操作');
        return;
      }
      chrome.tabs.sendMessage(tab.id, {action: 'completeVideos'}, function(response) {
        if (chrome.runtime.lastError) {
          showError('一键完成视频失败，请刷新页面后重试');
          return;
        }
        if (response && response.success) {
          // 可选：成功提示
        }
      });
    });
  });

  document.getElementById('autoCompleteToggle').addEventListener('change', function() {
    saveSettings();
  });

  document.querySelectorAll('.speed-option').forEach(button => {
    button.addEventListener('click', function() {
      const rate = parseFloat(this.dataset.speed);
      setPlaybackRate(rate);
    });
  });

  document.getElementById('setCustomSpeed').addEventListener('click', function() {
    const customSpeedInput = document.getElementById('customSpeed');
    const rate = parseFloat(customSpeedInput.value);
    if (isNaN(rate) || rate < 0.1 || rate > 16) {
      alert('请输入0.1到16之间的速度值');
      return;
    }
    setPlaybackRate(rate);
  });

  document.getElementById('saveSettings').addEventListener('click', function() {
    saveSettings();
  });
}

document.addEventListener('DOMContentLoaded', initPopup);

// 监听标签页切换和页面刷新
chrome.tabs.onActivated.addListener(() => {
  updateVideoCount();
  autoCompleteIfNeeded();
});
chrome.tabs.onUpdated.addListener(() => {
  updateVideoCount();
  autoCompleteIfNeeded();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateVideoCount();
    autoCompleteIfNeeded();
  }
});

// 确保content script已注入
function ensureContentScriptInjected() {
  return new Promise((resolve, reject) => {
    getCurrentWebTab(tab => {
      if (!tab) {
        showError('请切换到含有视频的网页再操作');
        reject(new Error('No valid web tab found'));
        return;
      }
      chrome.tabs.sendMessage(tab.id, {action: 'ping'}, function(response) {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: {tabId: tab.id},
            files: ['content/content.js']
          }).then(() => {
            resolve();
          }).catch(error => {
            showError('内容脚本注入失败，请刷新页面后重试');
            reject(error);
          });
        } else {
          resolve();
        }
      });
    });
  });
}

// 更新视频计数
function updateVideoCount() {
  getCurrentWebTab(tab => {
    if (!tab) {
      showError('请切换到含有视频的网页再操作');
      return;
    }
    chrome.tabs.sendMessage(tab.id, {action: 'getVideoCount'}, function(response) {
      if (chrome.runtime.lastError) {
        showError('获取视频数量失败，请刷新页面后重试');
        return;
      }
      if (response && response.count !== undefined) {
        if (response.count === 0) {
          document.getElementById('videoCount').textContent = '当前页面无视频';
        } else {
          document.getElementById('videoCount').textContent = `当前页面发现 ${response.count} 个视频`;
        }
      }
    });
  });
}

// 自动完成逻辑
function autoCompleteIfNeeded() {
  chrome.storage.sync.get('settings', function(result) {
    const settings = result.settings || { autoComplete: false };
    if (!settings.autoComplete) return;
    getCurrentWebTab(tab => {
      if (!tab) return;
      try {
        const url = new URL(tab.url);
        const host = url.hostname;
        const excluded = (settings.excludedSites || '').split(/\n|,/).map(s => s.trim()).filter(Boolean);
        if (excluded.some(domain => host.endsWith(domain))) {
          return; // 命中排除网站
        }
      } catch (e) {}
      chrome.tabs.sendMessage(tab.id, {action: 'completeVideos'}, function(response) {
        if (chrome.runtime.lastError) {
          showError('自动完成视频失败，请刷新页面后重试');
          return;
        }
        if (response && response.success) {
          // 可选：成功提示
        }
      });
    });
  });
}

// 加载设置
function loadSettings() {
  chrome.storage.sync.get('settings', function(result) {
    if (chrome.runtime.lastError) {
      showError('加载设置失败，请稍后重试');
      return;
    }
    // 确保默认值为 false
    const settings = result.settings || { 
      defaultSpeed: 1, 
      autoComplete: false, 
      excludedSites: '' 
    };
    setActiveSpeedOption(settings.defaultSpeed);
    // 自动完成开关
    const autoCompleteToggle = document.getElementById('autoCompleteToggle');
    if (autoCompleteToggle) {
      autoCompleteToggle.checked = settings.autoComplete;
      // 添加事件监听器，当状态改变时保存设置
      autoCompleteToggle.addEventListener('change', function() {
        settings.autoComplete = this.checked;
        chrome.storage.sync.set({settings});
      });
    }
    // 默认速度
    const defaultSpeed = document.getElementById('defaultSpeed');
    if (defaultSpeed) defaultSpeed.value = settings.defaultSpeed;
    // 排除网站
    const excludedSites = document.getElementById('excludedSites');
    if (excludedSites) excludedSites.value = settings.excludedSites || '';
  });
}

// 保存设置
function saveSettings() {
  const autoComplete = document.getElementById('autoCompleteToggle').checked;
  const defaultSpeed = document.getElementById('defaultSpeed').value;
  const excludedSites = document.getElementById('excludedSites').value;
  const settings = {
    autoComplete,
    defaultSpeed: parseFloat(defaultSpeed),
    excludedSites
  };
  chrome.storage.sync.set({settings}, function() {
    if (chrome.runtime.lastError) {
      showError('保存设置失败，请稍后重试');
      return;
    }
    setActiveSpeedOption(settings.defaultSpeed);
    // 设置成功提示（只在settingsTip区域显示）
    const tip = document.getElementById('settingsTip');
    if (tip) {
      tip.textContent = '设置已保存';
      setTimeout(() => { tip.textContent = ''; }, 1200);
    }
  });
}

// 设置活动速度按钮
function setActiveSpeedOption(rate) {
  document.querySelectorAll('.speed-option').forEach(button => {
    if (parseFloat(button.dataset.speed) === parseFloat(rate)) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
  // 同步下拉框
  const defaultSpeed = document.getElementById('defaultSpeed');
  if (defaultSpeed) defaultSpeed.value = rate;
}

// 设置播放速度
function setPlaybackRate(rate) {
  getCurrentWebTab(tab => {
    if (!tab) {
      showError('请切换到含有视频的网页再操作');
      return;
    }
    chrome.tabs.sendMessage(tab.id, {action: 'setPlaybackRate', rate: rate}, function(response) {
      if (chrome.runtime.lastError) {
        showError('设置播放速度失败，请刷新页面后重试');
        return;
      }
      if (response && response.success) {
        setActiveSpeedOption(rate);
        // 保存设置
        chrome.storage.sync.get('settings', function(result) {
          if (chrome.runtime.lastError) {
            showError('获取设置失败，请稍后重试');
            return;
          }
          const settings = result.settings || {};
          settings.defaultSpeed = rate;
          chrome.storage.sync.set({settings: settings});
        });
      }
    });
  });
}

// 友好错误提示
function showError(msg) {
  const videoCount = document.getElementById('videoCount');
  if (videoCount) videoCount.textContent = msg;
  // 不再输出详细错误日志
}

// 主题相关函数
function initTheme() {
  // 从存储中获取主题设置
  chrome.storage.sync.get('theme', function(result) {
    const theme = result.theme || 'light';
    setTheme(theme);
  });

  // 添加主题切换按钮事件监听
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click', function() {
    chrome.storage.sync.get('theme', function(result) {
      const currentTheme = result.theme || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      chrome.storage.sync.set({theme: newTheme});
    });
  });
}

function setTheme(theme) {
  const body = document.body;
  const themeIcon = document.querySelector('.theme-icon');
  
  if (theme === 'dark') {
    body.classList.add('dark-theme');
    themeIcon.textContent = '☀️';
  } else {
    body.classList.remove('dark-theme');
    themeIcon.textContent = '🌙';
  }
} 
