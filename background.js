console.log('[Translator Background] Service worker запущен');

// Создаем контекстное меню при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Translator Background] Расширение установлено, создаем меню');
  
  try {
    chrome.contextMenus.create({
      id: "translateText",
      title: "Перевести на русский",
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Translator Background] Ошибка создания меню:', chrome.runtime.lastError.message);
      } else {
        console.log('[Translator Background] Меню создано успешно');
      }
    });
  } catch (error) {
    console.error('[Translator Background] Исключение при создании меню:', error);
  }
});

// Создаем меню при запуске service worker (на случай если onInstalled не сработал)
chrome.contextMenus.removeAll(() => {
  console.log('[Translator Background] Старые меню удалены, создаем новое');
  chrome.contextMenus.create({
    id: "translateText",
    title: "Перевести на русский",
    contexts: ["selection"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Translator Background] Ошибка создания меню при запуске:', chrome.runtime.lastError.message);
    } else {
      console.log('[Translator Background] Меню создано при запуске');
    }
  });
});

// Обработчик клика по контекстному меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('[Translator Background] Клик по меню:', info);
  
  if (info.menuItemId === "translateText" && info.selectionText) {
    console.log('[Translator Background] Отправляем сообщение в tab:', tab.id);
    console.log('[Translator Background] Выделенный текст:', info.selectionText);
    
    chrome.tabs.sendMessage(tab.id, {
      action: "translate",
      text: info.selectionText
    }, () => {
      // Игнорируем ошибку "message port closed" - это нормально
      if (chrome.runtime.lastError) {
        // Не логируем, это ожидаемое поведение
      }
    });
  }
});
