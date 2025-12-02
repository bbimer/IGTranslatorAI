# Language Breaker AI

AI-powered translator and typing emulator for Instagram with realistic human-like behavior.

## 🌟 Features

### Translation
- **Smart Translation** - AI-powered translation with personality styles
- **Auto-detect Language** - Automatically detects source language
- **Multiple AI Models** - Choose from Grok, DeepSeek, Gemini, GPT-5.1
- **Context Menu** - Right-click to translate selected text

### Typing Emulator
- **Realistic Typing** - Human-like typing with natural pauses and variations
- **Translation History** - Click history items to reuse messages
- **Customizable Speed** - Adjust WPM (words per minute)
- **Punctuation Control** - Fine-tune delays for punctuation marks (50-500ms)
- **Stop Typing** - Press `S` key to stop typing instantly

### Personality Styles
- **No Style** - Direct translation without personality
- **Girl Lite** - Light personality touch
- **Girl in Character** - Full character immersion (recommended)
- **Warm & Empathetic** - Emotional, caring communication
- **Revealed Trader** - Open about trading and markets

### UI Features
- **Dark/Light Theme** - Toggle between themes
- **Translation Preview** - See translation before typing
- **Grammar Check** - AI-powered grammar correction
- **History Panel** - Access last 10 translations

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` | Auto Reply (select message first) |
| `Alt+2` | Type from Clipboard |
| `Alt+3` | Open Typing Emulator |
| `Alt+4` | Translate Selected Text |
| `Alt+F1` | Reply + Auto Reply |
| `Alt+F2` | Reply + Clipboard |
| `Alt+F3` | Reply + Typing Emulator |
| `S` | Stop Typing (while typing) |

## 🚀 Installation

### Chrome / Edge / Brave

1. Download or clone this repository
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the extension folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` file

## ⚙️ Configuration

### API Setup

1. Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai)
2. Open extension popup
3. The extension uses OpenRouter API for AI models

### Settings

- **Source Language** - Auto-detect or select specific language
- **Target Language** - Choose translation target (default: Russian)
- **Translation Model** - AI model for Alt+4 translations
- **Typing Model** - AI model for typing emulator
- **Typing Speed** - WPM speed (default: 60)
- **Prompt Style** - Personality style for translations
- **Punctuation Delay** - Delay multiplier for punctuation (50-500ms)

## 🎯 Usage Examples

### Basic Translation
1. Select text on any webpage
2. Press `Alt+4` or right-click → "Translate"
3. View translation in popup

### Typing Emulator
1. Press `Alt+3` to open typing console
2. Type your message in Russian
3. Press `Enter` to translate and type
4. AI will type the translation naturally in Instagram

### Auto Reply
1. Select the message you want to reply to
2. Press `Alt+1`
3. AI generates and types a natural reply

### Using History
1. Press `Alt+3` to open typing console
2. Click the clock icon to show history
3. Click any history item to insert text

## 🎨 Personality Styles

### Girl in Character (Recommended)
- Reserved, confident 21-23 y.o. girl
- Post-Soviet CIS mentality
- Background: marketing, ad buying, project management
- Natural Instagram communication style

### Warm & Empathetic
- Emotionally warm and caring
- Empathetic responses
- Respectful toward personal topics
- Soft, kind, slightly vulnerable tone

### Revealed Trader
- Open about trading and crypto
- Understands markets, charts, risk management
- Combines technical thinking with emotional intelligence
- Feminine but analytical

## 🛠️ Technical Details

### Files Structure
```
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Main content script
├── popup.html/js/css     # Settings popup
├── config.js             # API configuration
├── prompts.js            # AI prompts
├── styles.css            # Typing emulator styles
└── assets/               # Icons and images
```

### AI Models Supported
- Grok 4.1 Fast (Free)
- DeepSeek Chat v3.1 (Cheapest)
- Gemini 2.5 Flash (Recommended)
- GPT-5.1 (Human-like)
- Gemini 2.5 Pro (Quality)

### Typing Behavior
- Natural speed variations (±33%)
- Realistic pauses before punctuation
- Post-translation thinking pause (350-650ms)
- Random thinking pauses (50% chance, 700-1600ms)
- Character-specific delays with jitter and spikes

## 🔒 Privacy

- All translations are processed through OpenRouter API
- No data is stored on external servers
- Translation history is stored locally in browser
- API key is stored securely in browser sync storage

## 📝 License

This project is for personal use only.

## 🤝 Contributing

This is a private project. For questions or issues, contact the author.

## 📧 Support

For support and questions, please contact the developer.

---

**Made with ❤️ for Instagram communication**
