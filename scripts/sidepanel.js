document.addEventListener('DOMContentLoaded', () => {
  const apiKeyForm = document.getElementById('api-key-form');
  const factCheckContainer = document.getElementById('fact-check-container');
  const apiKeyContainer = document.getElementById('api-key-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const reasoningContent = document.getElementById('reasoning-content');
  const citationsList = document.getElementById('citations-list');
  const scanWebpageButton = document.getElementById('scan-webpage-button');

  // Function to check if API key exists
  function checkApiKey() {
    chrome.storage.local.get(['perplexityApiKey', 'shouldAnalyze'], (data) => {
      if (data.perplexityApiKey) {
        apiKeyContainer.style.display = 'none';
        
        // Only analyze if the shouldAnalyze flag is true
        if (data.shouldAnalyze) {
          getSelectedTextAndAnalyze(data.perplexityApiKey);
        } else {
          // Just show the existing results or text without analyzing
          factCheckContainer.style.display = 'block';
        }
      } else {
        apiKeyContainer.style.display = 'block';
        factCheckContainer.style.display = 'none';
      }
    });
  }
  
  // Handle API key submission
  if (apiKeyForm) {
    apiKeyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const apiKey = document.getElementById('api-key-input').value.trim();
      if (apiKey) {
        chrome.storage.local.set({ perplexityApiKey: apiKey }, () => {
          apiKeyContainer.style.display = 'none';
          chrome.storage.local.get('shouldAnalyze', (data) => {
            if (data.shouldAnalyze) {
              getSelectedTextAndAnalyze(apiKey);
            } else {
              factCheckContainer.style.display = 'block';
            }
          });
        });
      }
    });
  }
  
  // Get the selected text and analyze with Perplexity API
  function getSelectedTextAndAnalyze(apiKey) {
    chrome.storage.local.get(['selectedText', 'shouldAnalyze', 'analysisResults'], (data) => {
      const selectedText = data.selectedText || 'No text selected.';
      document.getElementById('selected-text').textContent = selectedText;

      // Check if analysis results already exist for the selected text
      if (data.analysisResults && data.analysisResults[selectedText]) {
        displayResults(data.analysisResults[selectedText]);
        factCheckContainer.style.display = 'block';
        loadingIndicator.style.display = 'none';
        return;
      }

      if (selectedText && selectedText !== 'No text selected.' && data.shouldAnalyze) {
        loadingIndicator.style.display = 'block';
        factCheckContainer.style.display = 'none';

        // Reset the shouldAnalyze flag to prevent re-analyzing on panel reopen
        chrome.storage.local.set({ shouldAnalyze: false }, () => {
          analyzeWithPerplexity(selectedText, apiKey);
        });
      }
    });
  }
  
  // Listen for updates when panel is already open
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateSidePanel') {
      document.getElementById('selected-text').textContent = message.text || 'No text selected.';
      
      // If shouldAnalyze is true and we have text, run analysis
      if (message.shouldAnalyze && message.text && message.text !== 'No text selected.') {
        chrome.storage.local.get('perplexityApiKey', (data) => {
          if (data.perplexityApiKey) {
            loadingIndicator.style.display = 'block';
            factCheckContainer.style.display = 'none';
            analyzeWithPerplexity(message.text, data.perplexityApiKey);
          }
        });
      }
    }
  });
  
  // Call Perplexity API
  function analyzeWithPerplexity(text, apiKey) {
    const prompt = `Analyze the following text for factual accuracy and bias. Provide a detailed analysis with truth score (0-100) and bias score (0-100, where 0 is neutral and 100 is heavily biased). Include reasoning and any relevant sources:\n\n${text}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {role: "system", content: "Be precise and concise in your analysis of factual accuracy and bias."},
          {role: "user", content: prompt}
        ],
        max_tokens: 500
      })
    };
    
    console.log('Sending request to Perplexity API with body:', options.body);
    
    fetch('https://api.perplexity.ai/chat/completions', options)
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            console.error('API Error Response:', text);
            throw new Error(`API request failed: ${response.status} - ${text}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Received API response:', data);
        loadingIndicator.style.display = 'none';
        factCheckContainer.style.display = 'block';

        // Save the analysis results in chrome.storage.local
        chrome.storage.local.get('analysisResults', (storageData) => {
          const analysisResults = storageData.analysisResults || {};
          analysisResults[text] = data;
          chrome.storage.local.set({ analysisResults }, () => {
            console.log('Analysis results saved.');
          });
        });

        displayResults(data);
      })
      .catch(error => {
        console.error('Error calling Perplexity API:', error);
        loadingIndicator.style.display = 'none';
        let errorMessage = error.message;
        document.getElementById('error-message').innerHTML = `Error connecting to Perplexity API. Please check your API key and try again.<br><small>${errorMessage}</small>`;
        document.getElementById('error-container').style.display = 'block';
      });
  }
  
  // Extract scores from API response
  function extractScores(content) {
    const truthScoreMatch = content.match(/truth\s*score.*?(\d+)/i);
    const biasScoreMatch = content.match(/bias\s*score.*?(\d+)/i);
    
    return {
      truthScore: truthScoreMatch ? parseInt(truthScoreMatch[1]) : 50,
      biasScore: biasScoreMatch ? parseInt(biasScoreMatch[1]) : 50
    };
  }
  
  // Display results in the UI
  function displayResults(data) {
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      document.getElementById('error-message').textContent = 'Invalid response from API';
      document.getElementById('error-container').style.display = 'block';
      return;
    }
    
    const content = data.choices[0].message.content;
    const { truthScore, biasScore } = extractScores(content);
    
    // Update the circular charts
    updateChart('truth-chart', truthScore);
    updateChart('bias-chart', biasScore);
    
    // Update text percentage values
    document.querySelector('.circular-chart.orange text').textContent = `${truthScore}%`;
    document.querySelector('.circular-chart.green text').textContent = `${biasScore}%`;
    
    // Display reasoning
    reasoningContent.innerHTML = formatReasoning(content);
    
    // Display citations
    if (data.citations && data.citations.length > 0) {
      citationsList.innerHTML = '';
      data.citations.forEach(citation => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = citation;
        a.textContent = citation;
        a.target = '_blank';
        li.appendChild(a);
        citationsList.appendChild(li);
      });
      document.getElementById('citations-container').style.display = 'block';
    } else {
      document.getElementById('citations-container').style.display = 'none';
    }
  }
  
  // Update chart with score
  function updateChart(chartId, score) {
    const chart = document.getElementById(chartId);
    if (chart) {
      const circlePath = chart.querySelector('.circle');
      circlePath.setAttribute('stroke-dasharray', `${score}, 100`);
    }
  }
  
  // Format reasoning content with markdown-like syntax
  function formatReasoning(content) {
    // Convert markdown headers to HTML
    let formatted = content.replace(/## (.*)/g, '<h3>$1</h3>');
    formatted = formatted.replace(/### (.*)/g, '<h4>$1</h4>');
    
    // Convert markdown paragraphs to HTML paragraphs
    formatted = formatted.split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join('');
    
    // Convert markdown lists
    formatted = formatted.replace(/\n\d+\.\s+(.*)/g, '<li>$1</li>');
    
    // Bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return formatted;
  }
  
  // Function to scan all text on the webpage
  function scanWebpage(apiKey) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => document.body.innerText, // Extract all text from the webpage
          },
          (results) => {
            if (results && results[0] && results[0].result) {
              const webpageText = results[0].result.trim();
              if (webpageText) {
                document.getElementById('selected-text').textContent = 'Analyzing webpage content...';
                loadingIndicator.style.display = 'block';
                factCheckContainer.style.display = 'none';
                analyzeWithPerplexity(webpageText, apiKey);
              } else {
                alert('No text found on the webpage.');
              }
            }
          }
        );
      }
    });
  }

  // Add event listener to the scan webpage button
  if (scanWebpageButton) {
    scanWebpageButton.addEventListener('click', () => {
      chrome.storage.local.get('perplexityApiKey', (data) => {
        if (data.perplexityApiKey) {
          scanWebpage(data.perplexityApiKey);
        } else {
          alert('Please enter your API key first.');
        }
      });
    });
  }

  // Initialize
  checkApiKey();
});
