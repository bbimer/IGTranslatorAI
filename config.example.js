// Configuration file for Language Breaker AI
// Copy this file to config.js and replace the API key with your own

const CONFIG = {
  // Your OpenRouter API key
  // Get your key at: https://openrouter.ai/keys
  API_KEY: 'YOUR_OPENROUTER_API_KEY_HERE',
  
  // API endpoint (do not change unless you know what you're doing)
  API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
