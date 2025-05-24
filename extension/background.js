// 存储已注入的标签页
const injectedTabs = new Set();

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
    // 注入content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    }).then(() => {
      injectedTabs.add(tabId);
      console.log('Content script injected into tab:', tabId);
    }).catch(error => {
      console.error('Error injecting content script:', error);
    });
  }
});

// 监听标签页关闭
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// 监听插件图标点击
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 检查sidePanel API是否可用
    if (chrome.sidePanel) {
      // 打开侧边栏
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('Side panel opened successfully');
    } else {
      console.warn('Side panel API not available, using popup instead');
      // 使用传统popup方式
      await openPopup(tab);
    }
  } catch (error) {
    console.error('Error opening panel:', error);
    // 如果侧边栏打开失败，尝试使用传统popup方式
    try {
      await openPopup(tab);
    } catch (popupError) {
      console.error('Error opening popup:', popupError);
    }
  }
});

// 使用传统popup方式打开
async function openPopup(tab) {
  try {
    const popup = await chrome.windows.create({
      url: chrome.runtime.getURL('popup/popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
    console.log('Popup opened successfully:', popup);
    return popup;
  } catch (error) {
    console.error('Error creating popup window:', error);
    throw error;
  }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) {
    console.error('Invalid message received:', request);
    return;
  }

  try {
    switch (request.action) {
      case 'getVideoCount':
      case 'completeVideos':
      case 'setPlaybackRate':
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, request, response => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to content script:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response);
            }
          });
          return true; // 保持消息通道开放
        }
        break;
      default:
        console.warn('Unknown action:', request.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// 监听页面导航事件
if (chrome.webNavigation) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) { // 只处理主框架的导航
      injectedTabs.delete(details.tabId);
    }
  });
} else {
  console.warn('webNavigation API not available');
} 
