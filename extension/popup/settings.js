// 默认设置
const defaultSettings = {
  defaultSpeed: 1,
  autoComplete: false,
  excludedSites: [],
  customSpeeds: []
};

// 保存设置到 Chrome 存储
function saveSettings(settings) {
  chrome.storage.sync.set({ settings }, () => {
    console.log('Settings saved:', settings);
  });
}

// 从 Chrome 存储加载设置
function loadSettings() {
  chrome.storage.sync.get('settings', (result) => {
    const settings = result.settings || defaultSettings;
    
    // 更新UI
    setActiveSpeedOption(settings.defaultSpeed);
    document.getElementById('autoComplete').checked = settings.autoComplete;
    document.getElementById('excludedSites').value = settings.excludedSites.join('\n');
    
    // 更新自定义速度选项
    updateCustomSpeedOptions(settings.customSpeeds);
  });
}

// 设置活动速度选项
function setActiveSpeedOption(speed) {
  document.querySelectorAll('.speed-option').forEach(option => {
    option.classList.remove('active');
    if (parseFloat(option.dataset.speed) === speed) {
      option.classList.add('active');
    }
  });
}

// 更新自定义速度选项
function updateCustomSpeedOptions(customSpeeds) {
  const speedOptions = document.querySelector('.speed-options');
  const existingCustomOptions = speedOptions.querySelectorAll('.speed-option[data-custom="true"]');
  existingCustomOptions.forEach(option => option.remove());

  customSpeeds.forEach(speed => {
    const option = document.createElement('div');
    option.className = 'speed-option';
    option.dataset.speed = speed;
    option.dataset.custom = 'true';
    option.textContent = `${speed}x`;
    speedOptions.appendChild(option);
  });
}

// 速度选项点击事件
document.querySelectorAll('.speed-option').forEach(option => {
  option.addEventListener('click', () => {
    const speed = parseFloat(option.dataset.speed);
    setActiveSpeedOption(speed);
  });
});

// 添加自定义速度
document.getElementById('addCustomSpeed').addEventListener('click', () => {
  const customSpeedInput = document.getElementById('customSpeed');
  const speed = parseFloat(customSpeedInput.value);
  
  if (speed >= 0.1 && speed <= 16) {
    chrome.storage.sync.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      if (!settings.customSpeeds.includes(speed)) {
        settings.customSpeeds.push(speed);
        settings.customSpeeds.sort((a, b) => a - b);
        updateCustomSpeedOptions(settings.customSpeeds);
        customSpeedInput.value = '';
      }
    });
  } else {
    alert('请输入0.1到16之间的速度值');
  }
});

// 保存按钮点击事件
document.getElementById('saveSettings').addEventListener('click', () => {
  const activeSpeedOption = document.querySelector('.speed-option.active');
  const speed = parseFloat(activeSpeedOption.dataset.speed);
  
  chrome.storage.sync.get('settings', (result) => {
    const settings = result.settings || defaultSettings;
    const newSettings = {
      defaultSpeed: speed,
      autoComplete: document.getElementById('autoComplete').checked,
      excludedSites: document.getElementById('excludedSites').value
        .split('\n')
        .map(site => site.trim())
        .filter(site => site),
      customSpeeds: settings.customSpeeds || []
    };
    
    saveSettings(newSettings);
    alert('设置已保存');
  });
});

// 重置按钮点击事件
document.getElementById('resetSettings').addEventListener('click', () => {
  if (confirm('确定要重置所有设置吗？')) {
    saveSettings(defaultSettings);
    loadSettings();
    alert('设置已重置');
  }
});

// 页面加载时加载设置
document.addEventListener('DOMContentLoaded', loadSettings); 
