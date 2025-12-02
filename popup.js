// Загружаем сохраненные настройки
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get({
    sourceLanguage: 'auto',
    targetLanguage: 'ru',
    translationModel: 'x-ai/grok-4.1-fast:free',
    typingModel: 'x-ai/grok-4.1-fast:free',
    typingSpeed: 60,
    promptStyle: 'simple',
    theme: 'dark',
    punctuationDelay: 150
  });
  
  document.getElementById('sourceLanguage').value = settings.sourceLanguage;
  document.getElementById('targetLanguage').value = settings.targetLanguage;
  document.getElementById('translationModel').value = settings.translationModel;
  document.getElementById('typingModel').value = settings.typingModel;
  document.getElementById('typingSpeed').value = settings.typingSpeed;
  document.getElementById('promptStyle').value = settings.promptStyle;
  document.getElementById('punctuationDelay').value = settings.punctuationDelay;
  document.getElementById('punctuationDelayValue').textContent = settings.punctuationDelay;
  
  // Применяем тему
  applyTheme(settings.theme);
  
  // Обработчик изменения ползунка
  const punctuationDelaySlider = document.getElementById('punctuationDelay');
  const punctuationDelayValue = document.getElementById('punctuationDelayValue');
  
  punctuationDelaySlider.addEventListener('input', (e) => {
    punctuationDelayValue.textContent = e.target.value;
  });
});

// Функция применения темы
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  const themeIcon = document.querySelector('.theme-icon');
  if (theme === 'light') {
    themeIcon.src = 'assets/moon.png';
    themeIcon.alt = 'Dark theme';
  } else {
    themeIcon.src = 'assets/sun.png';
    themeIcon.alt = 'Light theme';
  }
}

// Переключатель темы
document.getElementById('themeToggle').addEventListener('click', async () => {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Добавляем класс для анимации
  const toggleBtn = document.getElementById('themeToggle');
  toggleBtn.classList.add('switching');
  
  // Применяем тему с небольшой задержкой для плавности
  setTimeout(() => {
    applyTheme(newTheme);
    toggleBtn.classList.remove('switching');
  }, 100);
  
  await chrome.storage.sync.set({ theme: newTheme });
});

// Сохраняем настройки
document.getElementById('saveButton').addEventListener('click', async () => {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  const settings = {
    sourceLanguage: document.getElementById('sourceLanguage').value,
    targetLanguage: document.getElementById('targetLanguage').value,
    translationModel: document.getElementById('translationModel').value,
    typingModel: document.getElementById('typingModel').value,
    typingSpeed: parseInt(document.getElementById('typingSpeed').value),
    promptStyle: document.getElementById('promptStyle').value,
    punctuationDelay: parseInt(document.getElementById('punctuationDelay').value),
    theme: currentTheme
  };
  
  await chrome.storage.sync.set(settings);
  
  // Показываем сообщение об успехе
  const message = document.createElement('div');
  message.className = 'success-message';
  message.textContent = 'Settings saved!';
  document.body.appendChild(message);
  
  setTimeout(() => {
    message.remove();
  }, 2000);
});
