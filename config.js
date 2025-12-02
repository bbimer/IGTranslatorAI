// Configuration file for Language Breaker AI
// Replace the API key below with your own OpenRouter API key

const CONFIG = {
  // Your OpenRouter API key
  // Get your key at: https://openrouter.ai/keys
  API_KEY: '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',
  
  // API endpoint (do not change unless you know what you're doing)
  API_URL: 'https://openrouter.ai/api/v1/chat/completions'
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
