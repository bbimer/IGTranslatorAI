// Слушаем сообщения от background script
chrome.runtime.onMessage.addListener((request) => {
  console.log('[Translator] Получено сообщение:', request);
  
  if (request.action === "translate") {
    translateSelectedMessages(request.text).catch(error => {
      console.error('[Translator] Error:', error);
      showErrorPopup('Error: ' + error.message);
    });
  }
});

// Слушаем изменения темы в настройках
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.theme) {
    const newTheme = changes.theme.newValue;
    console.log('[Translator] Тема изменена на:', newTheme);
    
    // Обновляем тему в открытой консоли
    const overlay = document.getElementById('typing-emulator-overlay');
    if (overlay) {
      overlay.setAttribute('data-theme', newTheme);
      
      // Обновляем иконку переключателя темы
      const themeIconBtn = overlay.querySelector('.theme-icon-btn');
      if (themeIconBtn) {
        const newIcon = newTheme === 'light' ? 'moon.png' : 'sun.png';
        themeIconBtn.src = chrome.runtime.getURL('assets/' + newIcon);
      }
    }
  }
});

// Слушаем нажатие клавиш Alt+4 для перевода выделенного
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === '4') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+4');
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      console.log('[Translator] Выделенный текст:', selectedText);
      translateSelectedMessages(selectedText).catch(error => {
        console.error('[Translator] Error:', error);
        showErrorPopup('Error: ' + error.message);
      });
    } else {
      console.log('[Translator] No text selected');
      showErrorPopup('Select text to translate');
    }
  }
  
  // Alt+3 для эмуляции печати
  if (event.altKey && event.key === '3') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+3');
    showTypingEmulatorOverlay();
  }
  
  // Alt+2 для эмуляции печати из буфера обмена
  if (event.altKey && event.key === '2') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+2');
    handleClipboardTyping();
  }
  
  // Alt+1 для автоответа
  if (event.altKey && event.key === '1') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+1');
    handleAutoReply();
  }
  
  // Alt+F1 для автоответа с Reply
  if (event.altKey && event.key === 'F1') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+F1');
    handleAutoReplyWithReply();
  }
  
  // Alt+F2 для печати из буфера с Reply
  if (event.altKey && event.key === 'F2') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+F2');
    handleClipboardTypingWithReply();
  }
  
  // Alt+F3 для перевода и печати с Reply
  if (event.altKey && event.key === 'F3') {
    event.preventDefault();
    console.log('[Translator] Нажата комбинация Alt+F3');
    handleTranslateAndTypeWithReply();
  }
  
  // Клавиша S для остановки печати
  if (event.key === 's' || event.key === 'S') {
    if (isCurrentlyTyping) {
      event.preventDefault();
      typingCancelled = true;
      console.log('[Typing Emulator] Печать остановлена по нажатию клавиши S');
      showErrorPopup('Typing stopped');
    }
  }
});

// Функция перевода выделенного текста (может быть несколько сообщений)
async function translateSelectedMessages(selectedText) {
  console.log('[Translator] Начинаем перевод текста:', selectedText);
  
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    console.log('[Translator] No selection');
    showErrorPopup('No text selected');
    return;
  }
  
  // Сначала удаляем ВСЕ существующие переводы на странице
  console.log('[Translator] Удаляем все старые переводы на странице');
  document.querySelectorAll('.inline-translation').forEach(t => {
    console.log('[Translator] Удаляем перевод:', t);
    t.remove();
  });
  
  // Получаем все элементы в выделении
  const range = selection.getRangeAt(0);
  
  // Ищем все текстовые элементы в выделении
  const messages = extractMessagesFromSelection(range);
  console.log('[Translator] Найдено сообщений:', messages.length);
  
  if (messages.length === 0) {
    // Если не нашли отдельные сообщения, переводим весь текст как одно
    console.log('[Translator] Переводим как одно сообщение');
    await translateSingleText(selectedText, range);
    return;
  }
  
  // Переводим каждое сообщение
  console.log('[Translator] Переводим каждое сообщение отдельно');
  for (const msg of messages) {
    await translateAndShowInline(msg.element, msg.text);
  }
}

// Извлекаем отдельные сообщения из выделения
function extractMessagesFromSelection(range) {
  const messages = [];
  const addedElements = new Set(); // Чтобы не добавлять дубликаты
  
  // Ищем элементы, которые могут быть сообщениями (только самые верхние уровни)
  const possibleSelectors = [
    'div[role="row"]',
    'div[role="gridcell"]'
  ];
  
  const container = range.commonAncestorContainer.nodeType === 3 
    ? range.commonAncestorContainer.parentElement 
    : range.commonAncestorContainer;
  
  console.log('[Translator] Контейнер:', container);
  
  // Пробуем найти сообщения по селекторам
  for (const selector of possibleSelectors) {
    const elements = container.querySelectorAll(selector);
    console.log(`[Translator] Селектор "${selector}": найдено ${elements.length} элементов`);
    
    for (const el of elements) {
      // Пропускаем если уже добавили этот элемент или его родителя
      if (addedElements.has(el)) {
        continue;
      }
      
      // Пропускаем вложенные элементы (если родитель уже в списке)
      let hasParentInList = false;
      for (const added of addedElements) {
        if (added.contains(el)) {
          hasParentInList = true;
          break;
        }
      }
      if (hasParentInList) {
        continue;
      }
      
      if (range.intersectsNode(el)) {
        // Пропускаем элементы с датами
        if (isDateElement(el)) {
          console.log('[Translator] Пропускаем дату');
          continue;
        }
        
        const text = cleanMessageText(el);
        if (text && text.length > 3) {
          console.log('[Translator] Добавлено сообщение:', text.substring(0, 50));
          messages.push({ element: el, text });
          addedElements.add(el);
        }
      }
    }
    if (messages.length > 0) break;
  }
  
  return messages;
}

// Проверяем, является ли элемент датой
function isDateElement(element) {
  // Проверяем data-scope="date_break"
  if (element.getAttribute('data-scope') === 'date_break') {
    return true;
  }
  
  // Проверяем наличие элемента с date_break внутри
  if (element.querySelector('[data-scope="date_break"]')) {
    return true;
  }
  
  // Проверяем aria-hidden="true" с датами
  if (element.getAttribute('aria-hidden') === 'true') {
    const text = element.textContent.toLowerCase();
    if (text.includes('set') || text.includes('сен') || text.includes('січ') || /\d{1,2}:\d{2}/.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Очищаем текст сообщения от дат, имен и прочего мусора
function cleanMessageText(element) {
  console.log('[Translator] Очистка текста из элемента:', element);
  
  // Клонируем элемент чтобы не изменять оригинал
  const clone = element.cloneNode(true);
  
  // Удаляем все элементы с переводами
  clone.querySelectorAll('.inline-translation').forEach(el => el.remove());
  
  // Ищем элемент с текстом сообщения (div с dir="auto" и классом html-div)
  let messageTextElement = clone.querySelector('div[dir="auto"][class*="html-div"]');
  
  // Если не нашли, пробуем другие варианты
  if (!messageTextElement) {
    const textSelectors = [
      'div[dir="auto"]',
      '[class*="text"]',
      '[class*="body"]',
      '[class*="content"]',
      'span[dir="auto"]'
    ];
    
    for (const selector of textSelectors) {
      const found = clone.querySelector(selector);
      if (found && found.textContent.trim().length > 0) {
        const text = found.textContent.trim();
        // Проверяем что это не дата и не время
        const isDate = /^\d{1,2}:\d{2}/.test(text) || /^\d{1,2}\s+(?:янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)/.test(text);
        
        if (!isDate && text.length > 3) {
          messageTextElement = found;
          console.log('[Translator] Найден текст по селектору:', selector);
          break;
        }
      }
    }
  }
  
  // Если не нашли специальный элемент, берем весь текст
  let text = messageTextElement ? messageTextElement.textContent : clone.textContent;
  text = text.trim();
  
  console.log('[Translator] Исходный текст:', text);
  
  // Удаляем паттерны дат
  text = text.replace(/\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}\s+г\./gi, '');
  text = text.replace(/\d{1,2}\s+(?:сентября|січня|января|февраля|марта|апреля|мая|июня|июля|августа|октября|ноября|декабря)\s+\d{4}\s+г\.,?\s+\d{1,2}:\d{2}/gi, '');
  text = text.replace(/\d{1,2}\s+(?:янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)[а-я]*\s+\d{4},?\s+\d{1,2}:\d{2}/gi, '');
  text = text.replace(/\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4},?\s+\d{1,2}:\d{2}/gi, '');
  
  // Удаляем время
  text = text.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');
  
  // Удаляем "Вы отправили", "Вы ответили", "Ви надіслали"
  text = text.replace(/\b(?:вы|ви)\s+(?:отправили|ответили|переслали|надіслали|відповіли)\b/gi, '');
  
  // Удаляем множественные пробелы
  text = text.replace(/\s+/g, ' ').trim();
  
  console.log('[Translator] Очищенный текст:', text);
  
  return text;
}

// Проверяем, является ли сообщение исходящим (от пользователя)
function isOutgoingMessage(element) {
  // Проверяем наличие аватарки с alt (имя пользователя)
  const avatar = element.querySelector('img[alt]');
  if (avatar && avatar.alt && avatar.alt.trim().length > 0) {
    // Есть аватарка с именем - это входящее сообщение
    console.log('[Translator] Найдена аватарка:', avatar.alt, '- входящее сообщение');
    return false;
  }
  
  // Нет аватарки - это исходящее сообщение
  console.log('[Translator] Аватарка не найдена - исходящее сообщение');
  
  const text = element.textContent.toLowerCase();
  const classList = element.className.toLowerCase();
  
  // Дополнительно проверяем текст на наличие маркеров исходящих сообщений
  const outgoingMarkers = [
    'вы отправили',
    'вы ответили', 
    'ви надіслали',
    'ви відповіли',
    'you sent',
    'you replied'
  ];
  
  for (const marker of outgoingMarkers) {
    if (text.includes(marker)) {
      return true;
    }
  }
  
  // Проверяем классы
  const outgoingClasses = ['outgoing', 'sent', 'own', 'self', 'me'];
  for (const cls of outgoingClasses) {
    if (classList.includes(cls)) {
      return true;
    }
  }
  
  // Если не нашли аватарку и нет других маркеров - считаем исходящим
  return !avatar;
}

// Перевод одного текста (когда не нашли отдельные сообщения)
async function translateSingleText(text, range) {
  console.log('[Translator] translateSingleText - не нашли отдельные сообщения');
  
  // Пробуем найти элемент сообщения в выделении
  const container = range.commonAncestorContainer.nodeType === 3 
    ? range.commonAncestorContainer.parentElement 
    : range.commonAncestorContainer;
  
  console.log('[Translator] Контейнер для одного сообщения:', container);
  
  // Ищем ближайший родительский элемент row или gridcell
  let messageElement = container.closest('div[role="row"], div[role="gridcell"]');
  
  if (messageElement && !isDateElement(messageElement)) {
    console.log('[Translator] Нашли элемент сообщения:', messageElement);
    
    // Проверяем что это действительно сообщение с текстом
    const messageText = cleanMessageText(messageElement);
    if (messageText && messageText.length > 3) {
      await translateAndShowInline(messageElement, messageText);
      return;
    }
  }
  
  // Если не нашли - показываем popup
  console.log('[Translator] Не нашли подходящий элемент, показываем popup');
  try {
    const translatedText = await fetchTranslation(text);
    showTranslationPopup(translatedText, range);
  } catch (error) {
    console.error('[Translator] Error in translateSingleText:', error);
    showErrorPopup('Translation error: ' + error.message);
  }
}

// Перевод и показ прямо под сообщением
async function translateAndShowInline(element, text) {
  console.log('[Translator] translateAndShowInline для:', text.substring(0, 50));
  
  // Удаляем все существующие переводы в этом элементе
  const existingTranslations = element.querySelectorAll('.inline-translation');
  if (existingTranslations.length > 0) {
    console.log('[Translator] Удаляем', existingTranslations.length, 'существующих переводов');
    existingTranslations.forEach(t => t.remove());
  }
  
  // Проверяем, исходящее ли это сообщение
  const isOutgoing = isOutgoingMessage(element);
  console.log('[Translator] Исходящее сообщение:', isOutgoing);
  
  // Создаем элемент для перевода
  const translationDiv = document.createElement('div');
  translationDiv.className = isOutgoing ? 'inline-translation outgoing' : 'inline-translation';
  translationDiv.innerHTML = '<div class="translation-loading">Перевод...</div>';
  
  // Вставляем после элемента
  element.style.position = 'relative';
  element.appendChild(translationDiv);
  console.log('[Translator] Показан индикатор загрузки');
  
  try {
    const translatedText = await fetchTranslation(text);
    console.log('[Translator] Получен перевод:', translatedText.substring(0, 50));
    
    translationDiv.innerHTML = `
      <div class="translation-content">
        <button class="translation-close" title="Закрыть">×</button>
        <div class="translation-text">${escapeHtml(translatedText)}</div>
      </div>
    `;
    
    translationDiv.querySelector('.translation-close').addEventListener('click', (e) => {
      e.stopPropagation();
      translationDiv.remove();
    });
  } catch (error) {
    console.error('[Translator] Ошибка перевода:', error);
    translationDiv.innerHTML = `<div class="translation-error">Ошибка: ${escapeHtml(error.message)}</div>`;
  }
}

// Запрос перевода через OpenRouter API
async function fetchTranslation(text) {
  console.log('[Translator] Запрос перевода для:', text.substring(0, 50));
  
  // Получаем настройки
  const settings = await chrome.storage.sync.get({
    sourceLanguage: 'auto',
    targetLanguage: 'ru',
    translationModel: 'x-ai/grok-4.1-fast:free'
  });
  
  const languageNames = {
    'auto': 'auto-detect',
    'en': 'English',
    'ru': 'Russian',
    'uk': 'Ukrainian',
    'tr': 'Turkish',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean'
  };
  
  const targetLang = languageNames[settings.targetLanguage] || 'Russian';
  const sourceLang = settings.sourceLanguage === 'auto' 
    ? 'Detect the source language automatically and translate' 
    : `Translate from ${languageNames[settings.sourceLanguage]}`;
  
  console.log('[Translator] Перевод на:', targetLang);
  
  const apiKey = CONFIG.API_KEY;
  const url = CONFIG.API_URL;
  
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('API Key not configured. Please add your OpenRouter API key in config.js');
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Translator Extension'
    },
    body: JSON.stringify({
      model: settings.translationModel,
      messages: [
        {
          role: 'system',
          content: PROMPTS.translation.simple(sourceLang, targetLang)
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Translator] Ошибка API:', errorText);
    console.error('[Translator] Status:', response.status);
    console.error('[Translator] Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.status === 401) {
      const errorMsg = errorText.includes('User not found') 
        ? 'OpenRouter API Key is invalid. Please:\n1. Go to https://openrouter.ai/keys\n2. Create a new API key\n3. Update config.js with your key\n4. Make sure you have credits'
        : 'API Key invalid or expired. Please check your OpenRouter API key in config.js';
      throw new Error(errorMsg);
    }
    
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[Translator] Ответ API:', data);
  
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content.trim();
  }
  
  throw new Error('Failed to get translation');
}

// Показываем popup с переводом (для случая когда не нашли отдельные сообщения)
function showTranslationPopup(translatedText, range) {
  console.log('[Translator] Показываем popup с переводом');
  removeExistingPopup();
  
  const popup = document.createElement('div');
  popup.id = 'translation-popup';
  popup.className = 'translation-popup';
  
  popup.innerHTML = `
    <div class="popup-header">
      <button class="close-btn">&times;</button>
    </div>
    <div class="popup-content">
      <div class="translated-text">
        <p>${escapeHtml(translatedText)}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  positionPopupNearSelection(popup, range);
  
  popup.querySelector('.close-btn').addEventListener('click', removeExistingPopup);
  
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 100);
}

// Позиционируем popup рядом с выделением
function positionPopupNearSelection(popup, range) {
  const rect = range.getBoundingClientRect();
  
  let top = rect.bottom + window.scrollY + 10;
  let left = rect.left + window.scrollX;
  
  const popupRect = popup.getBoundingClientRect();
  if (left + popupRect.width > window.innerWidth) {
    left = window.innerWidth - popupRect.width - 20;
  }
  if (top + popupRect.height > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - popupRect.height - 10;
  }
  
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

// Показываем popup с ошибкой
async function showErrorPopup(message) {
  console.error('[Translator] Показываем ошибку:', message);
  removeExistingPopup();
  
  // Получаем тему из настроек
  const settings = await chrome.storage.sync.get({ theme: 'dark' });
  const theme = settings.theme;
  
  const popup = document.createElement('div');
  popup.id = 'translation-popup';
  popup.className = 'translation-popup error';
  popup.setAttribute('data-theme', theme);
  popup.innerHTML = `
    <div class="popup-single-line">
      <span class="popup-message">⚠️ ${escapeHtml(message)}</span>
      <button class="close-btn">&times;</button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    positionPopupNearSelection(popup, selection.getRangeAt(0));
  } else {
    // Если нет выделения, показываем в центре экрана
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
  }
  
  popup.querySelector('.close-btn').addEventListener('click', removeExistingPopup);
  
  // Автоматически закрываем через 5 секунд
  setTimeout(removeExistingPopup, 5000);
}

// Удаляем существующий popup
function removeExistingPopup() {
  const existing = document.getElementById('translation-popup');
  if (existing) {
    existing.remove();
    document.removeEventListener('click', handleOutsideClick);
  }
}

// Обработчик клика вне popup
function handleOutsideClick(event) {
  const popup = document.getElementById('translation-popup');
  if (popup && !popup.contains(event.target)) {
    removeExistingPopup();
  }
}

// Экранирование HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Показываем оверлей для эмуляции печати
async function showTypingEmulatorOverlay() {
  // Удаляем существующий оверлей если есть
  const existing = document.getElementById('typing-emulator-overlay');
  if (existing) {
    existing.remove();
    return;
  }
  
  // Получаем тему из настроек
  const settings = await chrome.storage.sync.get({ theme: 'dark' });
  const theme = settings.theme;
  
  const overlay = document.createElement('div');
  overlay.id = 'typing-emulator-overlay';
  overlay.className = 'typing-emulator-overlay';
  overlay.setAttribute('data-theme', theme);
  
  // Загружаем историю переводов
  const historyData = await chrome.storage.local.get({ translationHistory: [] });
  const history = historyData.translationHistory.slice(0, 10);
  
  console.log('[History] Загружено элементов истории:', history.length);
  console.log('[History] История:', history);
  
  // Сохраняем в window для доступа из обработчиков
  window._translationHistory = history;
  
  const historyHTML = history.length > 0 ? history.map((item, index) => `
    <div class="history-item" data-index="${index}">
      <div class="history-original">${escapeHtml(item.original)}</div>
      <div class="history-arrow">
        <img src="${chrome.runtime.getURL('assets/arrow.png')}" alt="→" class="arrow-icon" />
      </div>
      <div class="history-translated">${escapeHtml(item.translated)}</div>
    </div>
  `).join('') : '<div class="history-empty">No translation history yet</div>';
  
  const themeIcon = theme === 'light' ? 'moon.png' : 'sun.png';
  
  overlay.innerHTML = `
    <div class="typing-emulator-container">
      <div class="input-wrapper">
        <textarea 
          id="typing-input" 
          placeholder="Type message..."
          rows="1"
        ></textarea>
        <button id="theme-toggle" class="theme-toggle-btn" title="Toggle theme">
          <img src="${chrome.runtime.getURL('assets/' + themeIcon)}" alt="Theme" class="theme-icon-btn" />
        </button>
        <button id="history-toggle" class="history-toggle" title="Toggle history">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </button>
      </div>
      <div class="translation-history" style="display: none;">
        ${historyHTML}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Обработчик кнопки переключения темы
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIconBtn = themeToggleBtn.querySelector('.theme-icon-btn');
  
  themeToggleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const currentTheme = overlay.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Обновляем тему оверлея
    overlay.setAttribute('data-theme', newTheme);
    
    // Меняем иконку
    const newIcon = newTheme === 'light' ? 'moon.png' : 'sun.png';
    themeIconBtn.src = chrome.runtime.getURL('assets/' + newIcon);
    
    // Сохраняем в настройки
    await chrome.storage.sync.set({ theme: newTheme });
  });
  
  // Получаем элементы
  const typingInput = document.getElementById('typing-input');
  const historyToggle = document.getElementById('history-toggle');
  const historyPanel = overlay.querySelector('.translation-history');
  
  // Обработчик кнопки истории
  historyToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = historyPanel.style.display !== 'none';
    historyPanel.style.display = isVisible ? 'none' : 'flex';
    historyToggle.classList.toggle('active', !isVisible);
  });
  
  // Обработчик клика по элементам истории - добавляем после небольшой задержки
  setTimeout(() => {
    const historyItems = document.querySelectorAll('.history-item');
    console.log('[History] Найдено элементов:', historyItems.length);
    
    historyItems.forEach((item, idx) => {
      item.addEventListener('click', function(e) {
        console.log('[History] КЛИК!', this);
        const index = parseInt(this.dataset.index);
        const input = document.getElementById('typing-input');
        if (input && window._translationHistory && window._translationHistory[index]) {
          input.value = window._translationHistory[index].original;
          input.focus();
          input.dispatchEvent(new Event('input'));
          console.log('[History] Текст вставлен:', window._translationHistory[index].original);
        }
      });
    });
  }, 100);
  
  // Автоматическое изменение высоты textarea
  const minHeight = 36;
  const maxHeight = 150;
  
  function autoResize() {
    // Сбрасываем высоту для точного расчета
    typingInput.style.height = minHeight + 'px';
    typingInput.style.overflowY = 'hidden';
    
    // Получаем реальную высоту контента
    const scrollHeight = typingInput.scrollHeight;
    
    // Расширяем только если scrollHeight значительно больше минимума
    // Порог 54px = minHeight (36) + примерно одна строка (18)
    if (scrollHeight > 54) {
      const newHeight = Math.min(scrollHeight, maxHeight);
      typingInput.style.height = newHeight + 'px';
      
      // Включаем прокрутку если достигли максимума
      if (scrollHeight >= maxHeight) {
        typingInput.style.overflowY = 'auto';
      }
    }
  }
  
  typingInput.addEventListener('input', autoResize);
  
  // Фокус на input
  setTimeout(() => {
    typingInput.focus();
  }, 100);
  
  // Закрытие по Escape или клику вне
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  // Enter для показа preview
  const typingInputField = document.getElementById('typing-input');
  
  typingInputField.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = e.target.value.trim();
      if (text) {
        await showTranslationPreview(text, overlay);
      }
    }
  });
}

// Показываем корректировку грамматики
async function showGrammarCorrection(originalText, mainOverlay, inputField) {
  try {
    // Получаем настройки
    const settings = await chrome.storage.sync.get({
      typingModel: 'x-ai/grok-4.1-fast:free'
    });
    
    // Показываем индикатор загрузки
    const previewContainer = mainOverlay.querySelector('.typing-emulator-container');
    const correctionDiv = document.createElement('div');
    correctionDiv.className = 'translation-preview loading';
    correctionDiv.innerHTML = `
      <div class="preview-loading">Checking grammar...</div>
      <div class="preview-model">Model: ${escapeHtml(settings.typingModel)}</div>
    `;
    previewContainer.appendChild(correctionDiv);
    
    // Запрашиваем корректировку
    const apiKey = CONFIG.API_KEY;
    const url = CONFIG.API_URL;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Translator Extension'
      },
      body: JSON.stringify({
        model: settings.typingModel,
        messages: [
          {
            role: 'system',
            content: PROMPTS.grammarCheck.initial
          },
          {
            role: 'user',
            content: originalText
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content?.trim() || originalText;
    
    // Функция для обновления UI с результатом
    const updateCorrectionUI = (text) => {
      correctionDiv.className = 'translation-preview';
      correctionDiv.innerHTML = `
        <div class="preview-header-row">
          <span class="preview-label">Grammar Check</span>
          <div class="preview-header-right">
            <span class="preview-model">${escapeHtml(settings.typingModel)}</span>
            <button class="preview-close-btn-correction" title="Close">×</button>
          </div>
        </div>
        <div class="correction-comparison">
          <div class="correction-corrected">
            <div class="correction-label">Corrected:</div>
            <div class="correction-text">${escapeHtml(text)}</div>
          </div>
        </div>
        <div class="preview-actions">
          <button class="regenerate-btn" title="Regenerate (Q)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
            Regenerate
          </button>
          <span class="preview-hint">Press <kbd>Y</kbd> to apply, <kbd>Q</kbd> to regenerate, or <kbd>N</kbd> / <kbd>Esc</kbd> to cancel</span>
        </div>
      `;
      
      // Обработчик кнопки закрытия
      const closeBtn = correctionDiv.querySelector('.preview-close-btn-correction');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.removeEventListener('keydown', correctionKeyHandler);
        correctionDiv.remove();
      });
      
      // Обработчик кнопки регенерации
      const regenerateBtn = correctionDiv.querySelector('.regenerate-btn');
      regenerateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await regenerateCorrection();
      });
    };
    
    // Функция для регенерации корректировки
    const regenerateCorrection = async () => {
      try {
        // Показываем индикатор загрузки
        correctionDiv.className = 'translation-preview loading';
        correctionDiv.innerHTML = `
          <div class="preview-loading">Regenerating...</div>
          <div class="preview-model">Model: ${escapeHtml(settings.typingModel)}</div>
        `;
        
        // Запрашиваем новую версию - альтернативную формулировку
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Translator Extension'
          },
          body: JSON.stringify({
            model: settings.typingModel,
            messages: [
              {
                role: 'system',
                content: PROMPTS.grammarCheck.regenerate
              },
              {
                role: 'user',
                content: originalText
              }
            ],
            temperature: 0.8, // Выше для большей вариативности формулировок
            max_tokens: 500
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const newCorrectedText = data.choices?.[0]?.message?.content?.trim() || originalText;
        
        // Обновляем UI с новым результатом
        updateCorrectionUI(newCorrectedText);
        
      } catch (error) {
        console.error('[Grammar Check] Ошибка регенерации:', error);
        correctionDiv.className = 'translation-preview';
        correctionDiv.innerHTML = `
          <div class="preview-header-row">
            <span class="preview-label">Error</span>
            <div class="preview-header-right">
              <button class="preview-close-btn-correction" title="Close">×</button>
            </div>
          </div>
          <div class="correction-comparison">
            <div class="correction-corrected">
              <div class="correction-text" style="color: #ff6b6b;">Regeneration error: ${escapeHtml(error.message)}</div>
            </div>
          </div>
        `;
        
        const closeBtn = correctionDiv.querySelector('.preview-close-btn-correction');
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.removeEventListener('keydown', correctionKeyHandler);
          correctionDiv.remove();
        });
      }
    };
    
    // Показываем результат
    updateCorrectionUI(correctedText);
    
    // Обработчик клавиш
    const correctionKeyHandler = (e) => {
      if (e.code === 'KeyY') {
        e.preventDefault();
        document.removeEventListener('keydown', correctionKeyHandler);
        
        // Получаем текущий текст из UI
        const currentText = correctionDiv.querySelector('.correction-text')?.textContent || correctedText;
        
        // Заменяем текст в поле ввода
        inputField.value = currentText;
        inputField.focus();
        
        // Удаляем preview
        correctionDiv.remove();
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        regenerateCorrection();
      } else if (e.code === 'KeyN' || e.key === 'Escape') {
        e.preventDefault();
        document.removeEventListener('keydown', correctionKeyHandler);
        correctionDiv.remove();
      }
    };
    
    document.addEventListener('keydown', correctionKeyHandler);
    
  } catch (error) {
    console.error('[Grammar Check] Ошибка:', error);
    showErrorPopup('Grammar check error: ' + error.message);
  }
}

// Показываем preview перевода

// Показываем preview перевода
async function showTranslationPreview(originalText, mainOverlay) {
  try {
    // Получаем настройки для отображения модели
    const settings = await chrome.storage.sync.get({
      typingModel: 'x-ai/grok-4.1-fast:free',
      typingSpeed: 60
    });
    
    // Показываем индикатор загрузки
    const previewContainer = mainOverlay.querySelector('.typing-emulator-container');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'translation-preview loading';
    loadingDiv.innerHTML = `
      <div class="preview-loading">Translating...</div>
      <div class="preview-model">Model: ${escapeHtml(settings.typingModel)}</div>
    `;
    previewContainer.appendChild(loadingDiv);
    
    // Переводим текст
    const translatedText = await translateRuToEn(originalText);
    
    // Заменяем индикатор на preview
    loadingDiv.className = 'translation-preview';
    loadingDiv.innerHTML = `
      <div class="preview-header-row">
        <span class="preview-label">Preview</span>
        <div class="preview-header-right">
          <span class="preview-model">${escapeHtml(settings.typingModel)}</span>
          <button class="preview-close-btn" title="Close preview">×</button>
        </div>
      </div>
      <div class="preview-text" id="preview-text-content">${escapeHtml(translatedText)}</div>
      <div class="preview-actions">
        <span class="preview-hint">Press <kbd>Y</kbd> to send, <kbd>T</kbd> to translate back, <kbd>R</kbd> to check grammar, or <kbd>N</kbd> / <kbd>Esc</kbd> to cancel</span>
      </div>
    `;
    
    // Обработчик кнопки закрытия
    const closeBtn = loadingDiv.querySelector('.preview-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.removeEventListener('keydown', previewKeyHandler);
      loadingDiv.remove();
    });
    
    // Обработчик клавиш для preview
    const previewKeyHandler = async (e) => {
      // Используем e.code для работы с любой раскладкой
      if (e.code === 'KeyY') {
        e.preventDefault();
        document.removeEventListener('keydown', previewKeyHandler);
        
        // Закрываем оверлей
        mainOverlay.remove();
        
        // Находим поле ввода Instagram
        const inputField = findInstagramInputField();
        if (!inputField) {
          showErrorPopup('Instagram input field not found');
          return;
        }
        
        // Сохраняем в историю
        const historyData = await chrome.storage.local.get({ translationHistory: [] });
        let history = historyData.translationHistory;
        
        const newEntry = {
          original: originalText,
          translated: translatedText,
          timestamp: Date.now()
        };
        
        const existingIndex = history.findIndex(item => item.original === originalText);
        if (existingIndex !== -1) {
          history.splice(existingIndex, 1);
        }
        
        history.unshift(newEntry);
        
        if (history.length > 10) {
          history = history.slice(0, 10);
        }
        
        await chrome.storage.local.set({ translationHistory: history });
        
        // Печатаем переведенный текст
        await emulateTyping(inputField, translatedText, settings.typingSpeed);
        
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        
        // Проверяем, не добавлен ли уже обратный перевод
        if (loadingDiv.querySelector('.back-translation')) {
          return;
        }
        
        // Добавляем поле для обратного перевода
        const backTransDiv = document.createElement('div');
        backTransDiv.className = 'back-translation';
        backTransDiv.innerHTML = '<div class="preview-loading-inline">Translating back...</div>';
        
        // Вставляем перед preview-actions
        const actionsDiv = loadingDiv.querySelector('.preview-actions');
        loadingDiv.insertBefore(backTransDiv, actionsDiv);
        
        try {
          // Переводим с английского на русский
          const backTranslated = await fetchTranslation(translatedText);
          backTransDiv.innerHTML = `
            <div class="back-translation-label">Back translation (RU):</div>
            <div class="back-translation-text">${escapeHtml(backTranslated)}</div>
          `;
        } catch (error) {
          backTransDiv.innerHTML = '<div class="back-translation-error">Translation error</div>';
          console.error('[Back translation] Ошибка:', error);
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        
        // Закрываем preview и открываем grammar check
        document.removeEventListener('keydown', previewKeyHandler);
        loadingDiv.remove();
        
        // Получаем текст из поля ввода
        const inputField = mainOverlay.querySelector('#typing-input');
        const text = inputField.value.trim();
        if (text) {
          await showGrammarCorrection(text, mainOverlay, inputField);
        }
      } else if (e.code === 'KeyN' || e.key === 'Escape') {
        e.preventDefault();
        document.removeEventListener('keydown', previewKeyHandler);
        loadingDiv.remove();
      }
    };
    
    document.addEventListener('keydown', previewKeyHandler);
    
  } catch (error) {
    console.error('[Preview] Ошибка:', error);
    showErrorPopup('Translation error: ' + error.message);
  }
}

// Показываем статус
function showTypingStatus(message, type = 'info') {
  const status = document.getElementById('typing-status');
  if (!status) return;
  
  status.textContent = message;
  status.className = `typing-status ${type}`;
  status.style.display = 'block';
}

// Переводим и печатаем
async function translateAndType(text, wpm) {
  const overlay = document.getElementById('typing-emulator-overlay');
  
  // Сразу скрываем оверлей
  overlay.style.animation = 'fadeOut 0.2s ease-out';
  setTimeout(() => {
    overlay?.remove();
  }, 200);
  
  try {
    console.log('[Typing Emulator] Начинаем перевод:', text);
    
    // Переводим с русского на английский
    const translatedText = await translateRuToEn(text);
    console.log('[Typing Emulator] Переведено:', translatedText);
    
    // Сохраняем в историю
    const historyData = await chrome.storage.local.get({ translationHistory: [] });
    let history = historyData.translationHistory;
    
    const newEntry = {
      original: text,
      translated: translatedText,
      timestamp: Date.now()
    };
    
    // Проверяем на дубликаты (по оригинальному тексту)
    const existingIndex = history.findIndex(item => item.original === text);
    if (existingIndex !== -1) {
      // Удаляем старую запись
      history.splice(existingIndex, 1);
    }
    
    // Добавляем новую запись в начало
    history.unshift(newEntry);
    
    // Ограничиваем до 10 записей
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    await chrome.storage.local.set({ translationHistory: history });
    
    // Находим поле ввода Instagram
    const inputField = findInstagramInputField();
    if (!inputField) {
      throw new Error('Instagram input field not found');
    }
    
    // Передаем WPM напрямую (функция сама рассчитает вариации)
    await emulateTyping(inputField, translatedText, wpm);
    
    console.log('[Typing Emulator] Готово!');
    
  } catch (error) {
    console.error('[Typing Emulator] Ошибка:', error);
    showErrorPopup('Typing error: ' + error.message);
  }
}

// Перевод с русского на английский в стиле Instagram девушки
async function translateRuToEn(text) {
  // Получаем модель из настроек
  const settings = await chrome.storage.sync.get({
    typingModel: 'x-ai/grok-4.1-fast:free',
    promptStyle: 'simple'
  });
  
  const apiKey = CONFIG.API_KEY;
  const url = CONFIG.API_URL;
  
  // Выбираем промпт в зависимости от настроек
  let systemPrompt;
  switch (settings.promptStyle) {
    case 'basic':
      systemPrompt = PROMPTS.translationTyping.basic;
      break;
    case 'advanced':
      systemPrompt = PROMPTS.translationTyping.advanced;
      break;
    case 'simple':
    default:
      systemPrompt = PROMPTS.translationTyping.simple;
      break;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Translator Extension'
    },
    body: JSON.stringify({
      model: settings.typingModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    let translated = data.choices[0].message.content.trim();
    
    // Нормализуем тире
    translated = translated.replace(/—|–|―/g, '-');
    translated = translated.replace(/--+/g, '-');
    
    // Нормализуем пробелы вокруг тире
    translated = translated.replace(/(\w)-(\w)/g, (match, before, after) => {
      return Math.random() < 0.5 ? `${before} - ${after}` : `${before}- ${after}`;
    });
    
    return translated;
  }
  
  throw new Error('Failed to get translation');
}

// Находим поле ввода Instagram
function findInstagramInputField() {
  // Используем XPath для точного поиска
  const xpath = '//*[@id="mount_0_0_3w"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/section/div/div/div/div[1]/div[2]/div/div[1]/div/div[2]/div[2]/div/div/div/div/div[2]/div/div[1]';
  
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  const field = result.singleNodeValue;
  
  if (field && field.isContentEditable) {
    console.log('[Typing Emulator] Найдено поле ввода через XPath');
    return field;
  }
  
  // Запасной вариант - ищем по атрибутам
  const fallback = document.querySelector('div[contenteditable="true"][role="textbox"]');
  if (fallback) {
    console.log('[Typing Emulator] Найдено поле ввода через селектор');
    return fallback;
  }
  
  console.error('[Typing Emulator] Поле ввода не найдено');
  return null;
}

// Глобальная переменная для отмены печати
let typingCancelled = false;
let isCurrentlyTyping = false;

// Эмулируем печать с реалистичными паузами
async function emulateTyping(element, text, baseSpeed) {
  console.log('[Typing Emulator] Начинаем реалистичную печать');
  
  isCurrentlyTyping = true;
  typingCancelled = false;
  
  // Загружаем настройку задержки знаков препинания
  const settings = await chrome.storage.sync.get({ punctuationDelay: 150 });
  const punctuationMultiplier = settings.punctuationDelay / 150; // 150ms - базовое значение
  console.log('[Typing Emulator] Множитель задержки знаков:', punctuationMultiplier);
  
  element.focus();
  
  // Пауза после перевода (350-650ms)
  const postTranslateDelay = 350 + Math.random() * 300;
  await new Promise(resolve => setTimeout(resolve, postTranslateDelay));
  
  if (typingCancelled) {
    console.log('[Typing Emulator] Печать отменена');
    isCurrentlyTyping = false;
    return;
  }
  
  element.innerHTML = '';
  
  // Пауза на размышление (50% шанс, 700-1600ms)
  if (Math.random() < 0.5) {
    const thinkingPause = 700 + Math.random() * 900;
    console.log('[Typing Emulator] Думаем:', thinkingPause, 'ms');
    await new Promise(resolve => setTimeout(resolve, thinkingPause));
  }
  
  if (typingCancelled) {
    console.log('[Typing Emulator] Печать отменена');
    isCurrentlyTyping = false;
    return;
  }
  
  // Печатаем посимвольно
  for (let i = 0; i < text.length; i++) {
    if (typingCancelled) {
      console.log('[Typing Emulator] Печать отменена на символе', i);
      isCurrentlyTyping = false;
      return;
    }
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // Пауза ПЕРЕД текущим знаком препинания (размышление)
    let prePunctuationPause = 0;
    
    if (char === '.') {
      // Перед точкой думаем 200-500ms (базовое) * множитель
      prePunctuationPause = (200 + Math.random() * 300) * punctuationMultiplier;
      console.log('[Typing Emulator] Размышление перед точкой:', prePunctuationPause.toFixed(0), 'ms');
    } else if (char === ',') {
      // Перед запятой думаем 100-250ms * множитель
      prePunctuationPause = (100 + Math.random() * 150) * punctuationMultiplier;
    } else if (char === '?' || char === '!') {
      // Перед вопросом/восклицанием думаем 200-400ms * множитель
      prePunctuationPause = (200 + Math.random() * 200) * punctuationMultiplier;
    } else if (char === ':' || char === ';') {
      // Перед двоеточием/точкой с запятой думаем 150-300ms * множитель
      prePunctuationPause = (150 + Math.random() * 150) * punctuationMultiplier;
    } else if (char === '-' && prevChar === ' ') {
      // Перед тире думаем 100-200ms * множитель
      prePunctuationPause = (100 + Math.random() * 100) * punctuationMultiplier;
    }
    
    if (prePunctuationPause > 0) {
      await new Promise(resolve => setTimeout(resolve, prePunctuationPause));
    }
    
    element.focus();
    document.execCommand('insertText', false, char);
    
    // Определяем задержку ПОСЛЕ символа
    let delay;
    
    if (char === ' ') {
      delay = 90 + Math.random() * 90; // 90-180ms
    } else if (char === ',') {
      delay = (100 + Math.random() * 100) * punctuationMultiplier; // 100-200ms * множитель
    } else if (char === '.') {
      delay = (150 + Math.random() * 150) * punctuationMultiplier; // 150-300ms * множитель
    } else if (char === '?' || char === '!') {
      delay = (150 + Math.random() * 150) * punctuationMultiplier; // 150-300ms * множитель
    } else if (char === ':' || char === ';') {
      delay = (100 + Math.random() * 100) * punctuationMultiplier; // 100-200ms * множитель
    } else if (char === '-') {
      delay = (80 + Math.random() * 80) * punctuationMultiplier; // 80-160ms * множитель
    } else {
      // Обычный символ с вариацией скорости
      // Базовая скорость ± 33% (например, 60 WPM → 40-60 WPM)
      const speedVariation = 0.33;
      const minSpeed = baseSpeed * (1 - speedVariation);
      const maxSpeed = baseSpeed;
      const currentSpeed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const msPerChar = 60000 / (currentSpeed * 5);
      
      // Добавляем jitter/spike
      if (Math.random() < 0.2) {
        delay = msPerChar + 40 + Math.random() * 50; // spike
      } else {
        delay = msPerChar + Math.random() * 35; // jitter
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  if (typingCancelled) {
    console.log('[Typing Emulator] Печать отменена перед завершением');
    isCurrentlyTyping = false;
    return;
  }
  
  console.log('[Typing Emulator] Текст введен');
  
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText'
  }));
  
  // Пауза перед отправкой (500-1200ms)
  const preSendPause = 500 + Math.random() * 700;
  console.log('[Typing Emulator] Пауза перед отправкой:', preSendPause, 'ms');
  await new Promise(resolve => setTimeout(resolve, preSendPause));
  
  if (typingCancelled) {
    console.log('[Typing Emulator] Печать отменена перед отправкой');
    isCurrentlyTyping = false;
    return;
  }
  
  console.log('[Typing Emulator] Отправляем через Enter');
  
  // Создаем и отправляем событие Enter
  const enterDown = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  
  const enterPress = new KeyboardEvent('keypress', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  
  const enterUp = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
    composed: true
  });
  
  element.dispatchEvent(enterDown);
  await new Promise(resolve => setTimeout(resolve, 50));
  element.dispatchEvent(enterPress);
  await new Promise(resolve => setTimeout(resolve, 50));
  element.dispatchEvent(enterUp);
  
  console.log('[Typing Emulator] Enter отправлен');
  isCurrentlyTyping = false;
}

// Обработчик автоответа (Alt+1)
async function handleAutoReply() {
  // Если уже печатаем - отменяем
  if (isCurrentlyTyping) {
    console.log('[Auto Reply] Typing cancelled');
    typingCancelled = true;
    showErrorPopup('Typing cancelled');
    return;
  }
  
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      showErrorPopup('Select text to reply');
      return;
    }
    
    console.log('[Auto Reply] Selected text:', selectedText.substring(0, 50));
    
    // Показываем индикатор загрузки
    const loadingPopup = document.createElement('div');
    loadingPopup.id = 'auto-reply-loading';
    loadingPopup.className = 'translation-popup';
    loadingPopup.innerHTML = `
      <div class="popup-single-line">
        <span class="popup-message">🤖 Generating a response...</span>
      </div>
    `;
    document.body.appendChild(loadingPopup);
    
    if (selection.rangeCount > 0) {
      positionPopupNearSelection(loadingPopup, selection.getRangeAt(0));
    }
    
    // Генерируем ответ
    const reply = await generateAutoReply(selectedText);
    
    // Удаляем индикатор загрузки
    loadingPopup.remove();
    
    console.log('[Auto Reply] Сгенерирован ответ:', reply.substring(0, 50));
    
    // Находим поле ввода Instagram
    const inputField = findInstagramInputField();
    if (!inputField) {
      throw new Error('Instagram input field not found');
    }
    
    // Получаем скорость из настроек
    const settings = await chrome.storage.sync.get({ typingSpeed: 60 });
    
    // Печатаем ответ
    await emulateTyping(inputField, reply, settings.typingSpeed);
    
    console.log('[Auto Reply] Готово!');
    
  } catch (error) {
    console.error('[Auto Reply] Error:', error);
    const loading = document.getElementById('auto-reply-loading');
    if (loading) loading.remove();
    showErrorPopup('Error: ' + error.message);
  }
}

// Генерируем автоответ через AI
async function generateAutoReply(messageText) {
  const settings = await chrome.storage.sync.get({
    typingModel: 'x-ai/grok-4.1-fast:free'
  });
  
  const apiKey = CONFIG.API_KEY;
  const url = CONFIG.API_URL;
  
  const systemPrompt = PROMPTS.autoReply;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Translator Extension'
    },
    body: JSON.stringify({
      model: settings.typingModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Reply to this message: "${messageText}"`
        }
      ],
      temperature: 0.8,
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    let reply = data.choices[0].message.content.trim();
    
    // Нормализуем тире
    reply = reply.replace(/—|–|―/g, '-');
    reply = reply.replace(/--+/g, '-');
    
    // Нормализуем пробелы вокруг тире
    reply = reply.replace(/(\w)-(\w)/g, (match, before, after) => {
      return Math.random() < 0.5 ? `${before} - ${after}` : `${before}- ${after}`;
    });
    
    return reply;
  }
  
  throw new Error('Failed to generate reply');
}

// Обработчик печати из буфера обмена (Alt+2)
async function handleClipboardTyping() {
  // Если уже печатаем - отменяем
  if (isCurrentlyTyping) {
    console.log('[Clipboard Typing] Typing cancelled');
    typingCancelled = true;
    showErrorPopup('Typing cancelled');
    return;
  }
  
  try {
    // Создаем временный textarea для чтения буфера обмена
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    
    // Выполняем paste
    const result = document.execCommand('paste');
    const clipboardText = textarea.value;
    
    // Удаляем временный элемент
    document.body.removeChild(textarea);
    
    if (!result || !clipboardText || clipboardText.trim().length === 0) {
      showErrorPopup('Failed to read clipboard');
      return;
    }
    
    console.log('[Clipboard Typing] Clipboard text:', clipboardText.substring(0, 50));
    
    // Находим поле ввода Instagram
    const inputField = findInstagramInputField();
    if (!inputField) {
      throw new Error('Instagram input field not found');
    }
    
    // Получаем скорость из настроек
    const settings = await chrome.storage.sync.get({ typingSpeed: 60 });
    
    // Печатаем без перевода
    await emulateTyping(inputField, clipboardText, settings.typingSpeed);
    
    console.log('[Clipboard Typing] Готово!');
    
  } catch (error) {
    console.error('[Clipboard Typing] Error:', error);
    showErrorPopup('Error: ' + error.message);
  }
}

// Находим и нажимаем кнопку Reply
function clickReplyButton() {
  console.log('[Reply] Ищем кнопку Reply...');
  
  // Ищем SVG с aria-label="Reply to message from..."
  const svgs = document.querySelectorAll('svg[aria-label]');
  for (const svg of svgs) {
    const ariaLabel = svg.getAttribute('aria-label') || '';
    
    if (ariaLabel.toLowerCase().includes('reply to message')) {
      console.log('[Reply] Найден SVG с aria-label:', ariaLabel);
      
      // Ищем родительский div с role="button"
      let parent = svg.parentElement;
      while (parent && parent !== document.body) {
        if (parent.getAttribute('role') === 'button') {
          console.log('[Reply] Найдена кнопка Reply, нажимаем');
          parent.click();
          return true;
        }
        parent = parent.parentElement;
      }
      
      // Если не нашли role="button", кликаем на ближайший кликабельный элемент
      parent = svg.parentElement;
      while (parent && parent !== document.body) {
        const cursor = window.getComputedStyle(parent).cursor;
        if (cursor === 'pointer') {
          console.log('[Reply] Кликаем на родителя с cursor: pointer');
          parent.click();
          return true;
        }
        parent = parent.parentElement;
      }
    }
  }
  
  // Ищем по тексту "replace message"
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    const text = el.textContent?.toLowerCase() || '';
    const innerText = el.innerText?.toLowerCase() || '';
    
    if ((text.includes('replace message') || innerText.includes('replace message')) && 
        (el.getAttribute('role') === 'button' || window.getComputedStyle(el).cursor === 'pointer')) {
      console.log('[Reply] Найдена кнопка по тексту "replace message"');
      el.click();
      return true;
    }
  }
  
  // Пробуем новый XPath
  const xpath = '//*[@id="mount_0_0_Rp"]/div/div/div[2]/div/div/div[1]/section/div/div[2]/div/div[2]/div/div[2]/div[1]/div/div/div/div/div/div/div[3]/div/div[4]/div/div/div/div[2]/div[1]/div/div[3]/div[3]/div/div/div/div/div[2]/span/div';
  
  let replyButton = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  
  if (replyButton) {
    console.log('[Reply] Найдена кнопка Reply по XPath');
    replyButton.click();
    return true;
  }
  
  // Ищем по aria-label в div/button
  const buttons = document.querySelectorAll('div[role="button"], button');
  for (const btn of buttons) {
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (ariaLabel.includes('reply') || ariaLabel.includes('ответить')) {
      console.log('[Reply] Найдена кнопка Reply по aria-label на button');
      btn.click();
      return true;
    }
  }
  
  // Ищем по тексту внутри title
  const titles = document.querySelectorAll('title');
  for (const title of titles) {
    if (title.textContent?.toLowerCase().includes('reply to message')) {
      console.log('[Reply] Найден title с Reply');
      let parent = title.parentElement;
      while (parent && parent !== document.body) {
        if (parent.getAttribute('role') === 'button' || 
            window.getComputedStyle(parent).cursor === 'pointer') {
          console.log('[Reply] Кликаем родителя title');
          parent.click();
          return true;
        }
        parent = parent.parentElement;
      }
    }
  }
  
  console.error('[Reply] Кнопка Reply не найдена');
  return false;
}

// Alt+F1: Автоответ с Reply
async function handleAutoReplyWithReply() {
  if (isCurrentlyTyping) {
    console.log('[Auto Reply with Reply] Typing cancelled');
    typingCancelled = true;
    showErrorPopup('Typing cancelled');
    return;
  }
  
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      showErrorPopup('Select text to reply');
      return;
    }
    
    // Нажимаем Reply
    if (!clickReplyButton()) {
      showErrorPopup('Reply button not found');
      return;
    }
    
    // Ждем появления поля ввода
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('[Auto Reply with Reply] Выделенный текст:', selectedText.substring(0, 50));
    
    const loadingPopup = document.createElement('div');
    loadingPopup.id = 'auto-reply-loading';
    loadingPopup.className = 'translation-popup';
    loadingPopup.innerHTML = `
      <div class="popup-single-line">
        <span class="popup-message">🤖 Generating a response...</span>
      </div>
    `;
    document.body.appendChild(loadingPopup);
    
    if (selection.rangeCount > 0) {
      positionPopupNearSelection(loadingPopup, selection.getRangeAt(0));
    }
    
    const reply = await generateAutoReply(selectedText);
    loadingPopup.remove();
    
    const inputField = findInstagramInputField();
    if (!inputField) {
      throw new Error('Instagram input field not found');
    }
    
    const settings = await chrome.storage.sync.get({ typingSpeed: 60 });
    await emulateTyping(inputField, reply, settings.typingSpeed);
    
    console.log('[Auto Reply with Reply] Готово!');
    
  } catch (error) {
    console.error('[Auto Reply with Reply] Error:', error);
    const loading = document.getElementById('auto-reply-loading');
    if (loading) loading.remove();
    showErrorPopup('Error: ' + error.message);
  }
}

// Alt+F2: Печать из буфера с Reply
async function handleClipboardTypingWithReply() {
  if (isCurrentlyTyping) {
    console.log('[Clipboard with Reply] Typing cancelled');
    typingCancelled = true;
    showErrorPopup('Typing cancelled');
    return;
  }
  
  try {
    // Нажимаем Reply
    if (!clickReplyButton()) {
      showErrorPopup('Reply button not found');
      return;
    }
    
    // Ждем появления поля ввода
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    
    const result = document.execCommand('paste');
    const clipboardText = textarea.value;
    document.body.removeChild(textarea);
    
    if (!result || !clipboardText || clipboardText.trim().length === 0) {
      showErrorPopup('Failed to read clipboard');
      return;
    }
    
    console.log('[Clipboard with Reply] Clipboard text:', clipboardText.substring(0, 50));
    
    const inputField = findInstagramInputField();
    if (!inputField) {
      throw new Error('Instagram input field not found');
    }
    
    const settings = await chrome.storage.sync.get({ typingSpeed: 60 });
    await emulateTyping(inputField, clipboardText, settings.typingSpeed);
    
    console.log('[Clipboard with Reply] Готово!');
    
  } catch (error) {
    console.error('[Clipboard with Reply] Error:', error);
    showErrorPopup('Error: ' + error.message);
  }
}

// Alt+F3: Открыть консоль для ввода и ответить через Reply
function handleTranslateAndTypeWithReply() {
  // Удаляем существующий оверлей если есть
  const existing = document.getElementById('typing-emulator-overlay');
  if (existing) {
    existing.remove();
    return;
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'typing-emulator-overlay';
  overlay.className = 'typing-emulator-overlay';
  overlay.innerHTML = `
    <div class="typing-emulator-container">
      <input 
        type="text"
        id="typing-input" 
        placeholder="Type message for reply..."
      />
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Фокус на input
  setTimeout(() => {
    document.getElementById('typing-input').focus();
  }, 100);
  
  // Закрытие по Escape или клику вне
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  // Enter для отправки через Reply
  document.getElementById('typing-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = e.target.value.trim();
      if (text) {
        // Сразу скрываем оверлей
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => {
          overlay?.remove();
        }, 200);
        
        try {
          // Нажимаем Reply
          if (!clickReplyButton()) {
            showErrorPopup('Reply button not found');
            return;
          }
          
          // Ждем появления поля ввода
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log('[Reply Emulator] Начинаем перевод:', text);
          
          // Переводим текст
          const translatedText = await translateRuToEn(text);
          console.log('[Reply Emulator] Переведено:', translatedText);
          
          // Находим поле ввода Instagram
          const inputField = findInstagramInputField();
          if (!inputField) {
            throw new Error('Instagram input field not found');
          }
          
          // Получаем скорость из настроек
          const settings = await chrome.storage.sync.get({ typingSpeed: 60 });
          await emulateTyping(inputField, translatedText, settings.typingSpeed);
          
          console.log('[Reply Emulator] Готово!');
          
        } catch (error) {
          console.error('[Reply Emulator] Error:', error);
          showErrorPopup('Error: ' + error.message);
        }
      }
    }
  });
}

// Находим кнопку отправки
function findSendButton() {
  // Ищем кнопку Send рядом с полем ввода
  const buttons = document.querySelectorAll('div[role="button"]');
  
  for (const btn of buttons) {
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    const text = btn.textContent.toLowerCase();
    
    // Проверяем на "send", "invia", "отправить" и т.д.
    if (ariaLabel.includes('send') || ariaLabel.includes('invia') || 
        text.includes('send') || text.includes('invia')) {
      console.log('[Typing Emulator] Найдена кнопка Send');
      return btn;
    }
    
    // Проверяем наличие SVG иконки отправки
    const svg = btn.querySelector('svg');
    if (svg) {
      const svgLabel = svg.getAttribute('aria-label')?.toLowerCase() || '';
      if (svgLabel.includes('send') || svgLabel.includes('invia')) {
        console.log('[Typing Emulator] Найдена кнопка Send через SVG');
        return btn;
      }
    }
  }
  
  console.log('[Typing Emulator] Кнопка Send не найдена');
  return null;
}
