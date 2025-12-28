// CRM API integration module
// Отправляет данные о переписках в CRM backend

const CRM_API = {
  baseUrl: 'http://localhost:3000',

  async logConversation(data) {
    try {
      const settings = await chrome.storage.sync.get({ crmApiUrl: this.baseUrl });
      const url = settings.crmApiUrl || this.baseUrl;
      console.log('[CRM API] Отправка в CRM:', url, data);

      const response = await fetch(`${url}/api/events/log-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CRM API] Ошибка:', response.status, errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      console.log('[CRM API] Успешно:', result);
      return { success: true, ...result };
    } catch (error) {
      console.error('[CRM API] Ошибка сети:', error);
      await this.bufferEvent(data);
      return { success: false, error: error.message, buffered: true };
    }
  },

  async bufferEvent(data) {
    try {
      const buffer = await chrome.storage.local.get({ crmEventBuffer: [] });
      buffer.crmEventBuffer.push({ ...data, timestamp: new Date().toISOString() });
      if (buffer.crmEventBuffer.length > 100) {
        buffer.crmEventBuffer = buffer.crmEventBuffer.slice(-100);
      }
      await chrome.storage.local.set({ crmEventBuffer: buffer.crmEventBuffer });
    } catch (e) {
      console.error('[CRM API] Ошибка буферизации:', e);
    }
  },

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('telegram.org') || url.includes('web.telegram.org')) return 'telegram';
    if (url.includes('tiktok.com')) return 'tiktok';
    return null;
  },

  extractInstagramProfile() {
    try {
      console.log('[CRM API] Извлекаем профиль Instagram собеседника...');
      
      const skipPaths = ['direct', 'explore', 'reels', 'stories', 'accounts', 'p', 'reel', 'inbox', 'api'];
      
      // Способ 1 (ЛУЧШИЙ): Ищем ссылку с aria-label "Open the profile page of USERNAME"
      const profileLink = document.querySelector('a[aria-label^="Open the profile page of"]');
      if (profileLink) {
        const ariaLabel = profileLink.getAttribute('aria-label');
        const match = ariaLabel.match(/Open the profile page of ([a-zA-Z0-9._]+)/);
        if (match?.[1]) {
          console.log('[CRM API] Найден username через aria-label:', match[1]);
          return { username: match[1], profileUrl: `https://www.instagram.com/${match[1]}/`, platform: 'instagram' };
        }
        
        // Fallback: извлекаем из href этой же ссылки
        const href = profileLink.getAttribute('href');
        if (href) {
          const pathPart = href.replace(/^\//, '').split('/')[0];
          if (pathPart && !skipPaths.includes(pathPart) && /^[a-zA-Z0-9._]{1,30}$/.test(pathPart)) {
            console.log('[CRM API] Найден username через href профильной ссылки:', pathPart);
            return { username: pathPart, profileUrl: `https://www.instagram.com/${pathPart}/`, platform: 'instagram' };
          }
        }
      }
      
      // Способ 2: Ищем заголовок чата (header с именем собеседника)
      const chatHeader = document.querySelector('div[role="main"] header') || 
                         document.querySelector('section header') ||
                         document.querySelector('[data-scope="messages_inbox_thread_header"]');
      
      if (chatHeader) {
        console.log('[CRM API] Найден header чата');
        const headerLinks = chatHeader.querySelectorAll('a[href^="/"]');
        for (const link of headerLinks) {
          const href = link.getAttribute('href');
          if (!href) continue;
          const pathPart = href.replace(/^\//, '').split('/')[0];
          if (pathPart && !skipPaths.includes(pathPart) && /^[a-zA-Z0-9._]{1,30}$/.test(pathPart)) {
            console.log('[CRM API] Найден username в header чата:', pathPart);
            return { username: pathPart, profileUrl: `https://www.instagram.com/${pathPart}/`, platform: 'instagram' };
          }
        }
        
        // Ищем по тексту в header
        const headerText = chatHeader.querySelector('span[dir="auto"], div[dir="auto"]');
        if (headerText) {
          const text = headerText.textContent?.trim();
          if (text && /^[a-zA-Z0-9._]{1,30}$/.test(text)) {
            console.log('[CRM API] Найден username в тексте header:', text);
            return { username: text, profileUrl: `https://www.instagram.com/${text}/`, platform: 'instagram' };
          }
        }
      }
      
      // Способ 3: Ищем первую ссылку на профиль в области чата (не в sidebar)
      const mainArea = document.querySelector('div[role="main"]');
      if (mainArea) {
        const links = mainArea.querySelectorAll('a[href^="/"][role="link"]');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href || href.includes('/direct/')) continue;
          const pathPart = href.replace(/^\//, '').split('/')[0];
          if (pathPart && !skipPaths.includes(pathPart) && /^[a-zA-Z0-9._]{1,30}$/.test(pathPart)) {
            console.log('[CRM API] Найден username через role=link:', pathPart);
            return { username: pathPart, profileUrl: `https://www.instagram.com/${pathPart}/`, platform: 'instagram' };
          }
        }
      }

      // Способ 4: Из аватарки собеседника
      const avatars = document.querySelectorAll('img[alt*="profile"], img[alt*="профил"]');
      for (const img of avatars) {
        const alt = img.getAttribute('alt');
        if (alt) {
          const match = alt.match(/^([a-zA-Z0-9._]+)'s profile/i);
          if (match?.[1]) {
            console.log('[CRM API] Найден username через аватар:', match[1]);
            return { username: match[1], profileUrl: `https://www.instagram.com/${match[1]}/`, platform: 'instagram' };
          }
        }
      }

      console.log('[CRM API] Не удалось извлечь профиль Instagram собеседника');
      return null;
    } catch (e) {
      console.error('[CRM API] Ошибка извлечения Instagram:', e);
      return null;
    }
  },

  extractTelegramProfile() {
    try {
      // Telegram Web K
      const chatTitle = document.querySelector('.chat-info .peer-title');
      if (chatTitle?.textContent) {
        return { username: chatTitle.textContent.trim(), profileUrl: null, platform: 'telegram' };
      }
      // Telegram Web A
      const chatHeader = document.querySelector('.ChatInfo .title');
      if (chatHeader?.textContent) {
        return { username: chatHeader.textContent.trim(), profileUrl: null, platform: 'telegram' };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  extractTikTokProfile() {
    try {
      const authorLink = document.querySelector('a[href^="/@"]');
      const match = authorLink?.getAttribute('href')?.match(/^\/@([^\/\?]+)/);
      if (match?.[1]) {
        return { username: match[1], profileUrl: `https://www.tiktok.com/@${match[1]}`, platform: 'tiktok' };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  extractCurrentProfile() {
    const platform = this.detectPlatform();
    if (!platform) return null;
    
    switch (platform) {
      case 'instagram': return this.extractInstagramProfile();
      case 'telegram': return this.extractTelegramProfile();
      case 'tiktok': return this.extractTikTokProfile();
      default: return null;
    }
  }
};

if (typeof window !== 'undefined') {
  window.CRM_API = CRM_API;
}
