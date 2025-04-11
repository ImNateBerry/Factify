document.addEventListener('DOMContentLoaded', () => {
  const apiKeyForm = document.getElementById('api-key-form');
  const factCheckContainer = document.getElementById('fact-check-container');
  const apiKeyContainer = document.getElementById('api-key-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const reasoningContent = document.getElementById('reasoning-content');
  const citationsList = document.getElementById('citations-list');
  const scanWebpageButton = document.getElementById('scan-webpage-button');
  const communityHallButton = document.getElementById('community-hall-button');
  const saveToCommunityButton = document.getElementById('save-to-community');
  const buttonContainer = document.getElementById('button-container');
  const selectionTip = document.getElementById('selection-tip');

  // Current analysis results and selected text
  let currentAnalysisResults = null;
  let currentSelectedText = '';

  // Ensure the fact check container is hidden initially
  factCheckContainer.style.display = 'none';

  // Function to check if API key exists
  function checkApiKey() {
    chrome.storage.local.get(['perplexityApiKey', 'shouldAnalyze', 'selectedText', 'analysisResults'], (data) => {
      if (data.perplexityApiKey) {
        apiKeyContainer.style.display = 'none';
        buttonContainer.style.display = 'flex';
        selectionTip.style.display = 'block';
        factCheckContainer.style.display = 'none'; // Ensure results are hidden initially
        saveToCommunityButton.style.display = 'none';

        // Only analyze if the shouldAnalyze flag is true
        if (data.shouldAnalyze) {
          // Analysis will start, but keep buttons/tip visible
          getSelectedTextAndAnalyze(data.perplexityApiKey);
        } else {
          // If not analyzing, check if results exist for the current text
          const selectedText = data.selectedText || '';
          if (selectedText && data.analysisResults && data.analysisResults[selectedText]) {
            // Found existing results, show them
            currentSelectedText = selectedText;
            currentAnalysisResults = data.analysisResults[selectedText];
            displayResults(data.analysisResults[selectedText]);
            factCheckContainer.style.display = 'block'; // Show container with existing results
            saveToCommunityButton.style.display = 'block';
            // Keep buttons/tip visible
          }
          // Else: No analysis needed, no existing results -> buttons and tip remain visible
        }
      } else {
        apiKeyContainer.style.display = 'block';
        factCheckContainer.style.display = 'none'; // Keep container hidden
        saveToCommunityButton.style.display = 'none';
        buttonContainer.style.display = 'none'; // Hide buttons
        selectionTip.style.display = 'none'; // Hide tip
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
          // Show buttons and tip after key submission
          buttonContainer.style.display = 'flex';
          selectionTip.style.display = 'block';
          factCheckContainer.style.display = 'none'; // Ensure results hidden
          saveToCommunityButton.style.display = 'none';

          // After submitting key, check if analysis should run or if existing results should be shown
          chrome.storage.local.get(['shouldAnalyze', 'selectedText', 'analysisResults'], (data) => {
            if (data.shouldAnalyze) {
              // Analysis will start, keep buttons/tip visible
              getSelectedTextAndAnalyze(apiKey);
            } else {
              // Check for existing results similar to checkApiKey
              const selectedText = data.selectedText || '';
              if (selectedText && data.analysisResults && data.analysisResults[selectedText]) {
                 // Found existing results, show them
                currentSelectedText = selectedText;
                currentAnalysisResults = data.analysisResults[selectedText];
                displayResults(data.analysisResults[selectedText]);
                factCheckContainer.style.display = 'block';
                saveToCommunityButton.style.display = 'block';
                // Keep buttons/tip visible
              }
              // Else: No analysis needed, no existing results -> buttons and tip remain visible
            }
          });
        });
      }
    });
  }
  
  // Get the selected text and analyze with Perplexity API
  function getSelectedTextAndAnalyze(apiKey) {
    chrome.storage.local.get(['selectedText', 'shouldAnalyze', 'analysisResults'], (data) => {
      const selectedText = data.selectedText || '';
      currentSelectedText = selectedText;

      // Check if analysis results already exist for the selected text
      if (data.analysisResults && data.analysisResults[selectedText]) {
        currentAnalysisResults = data.analysisResults[selectedText];
        displayResults(data.analysisResults[selectedText]);
        factCheckContainer.style.display = 'block';
        loadingIndicator.style.display = 'none';
        saveToCommunityButton.style.display = 'block';
        // Keep buttons/tip visible (they should be already)
        return;
      }

      if (selectedText && selectedText !== '' && data.shouldAnalyze) {
        loadingIndicator.style.display = 'block';
        factCheckContainer.style.display = 'none';
        saveToCommunityButton.style.display = 'none';
        // Keep buttons/tip visible

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
      // If shouldAnalyze is true and we have text, run analysis
      if (message.shouldAnalyze && message.text && message.text !== '') {
        currentSelectedText = message.text;
        chrome.storage.local.get('perplexityApiKey', (data) => {
          if (data.perplexityApiKey) {
            loadingIndicator.style.display = 'block';
            factCheckContainer.style.display = 'none';
            saveToCommunityButton.style.display = 'none';
            // Keep buttons/tip visible
            analyzeWithPerplexity(message.text, data.perplexityApiKey);
          } else {
            // If no API key, ensure fact check container is hidden
            apiKeyContainer.style.display = 'block';
            factCheckContainer.style.display = 'none';
            saveToCommunityButton.style.display = 'none';
            loadingIndicator.style.display = 'none';
            buttonContainer.style.display = 'none'; // Hide buttons if no key
            selectionTip.style.display = 'none'; // Hide tip if no key
          }
        });
      } else if (message.text === '') {
        // If no text is selected, hide analysis results and show buttons/tip if API key exists
        factCheckContainer.style.display = 'none'; 
        saveToCommunityButton.style.display = 'none';
        loadingIndicator.style.display = 'none';
        document.getElementById('error-container').style.display = 'none'; // Also hide errors
        // Check if API key exists to decide whether to show buttons/tip or API key form
        chrome.storage.local.get('perplexityApiKey', (data) => {
            if (data.perplexityApiKey) {
                buttonContainer.style.display = 'flex';
                selectionTip.style.display = 'block';
                apiKeyContainer.style.display = 'none';
            } else {
                buttonContainer.style.display = 'none';
                selectionTip.style.display = 'none';
                apiKeyContainer.style.display = 'block';
            }
        });
      }
    }
  });
  
  // Call Perplexity API
  function analyzeWithPerplexity(text, apiKey, keyToSaveAs = null) {
    const prompt = `Fact check the following:

${text}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "sonar-reasoning-pro",
        messages: [
          {
            role: "system", 
            content: `You are a fact-checking search API. When responding to any query, you must:

                      - Quickly reason about the statement or question and how it contrasts or supports the sources you find.

                      - Gather all the information you can from reputable sources about the statement or question.

                      - Evaluate the statement or question for factual correctness.

                      - Provide a numeric truthfulness score from 0 to 100 (where 0 is completely false and 100 is entirely accurate).
                                
                      - Provide a numeric bias score of the assumed bias of the used citations from 0 to 100 ( 0 which is no bias at all to 100 completely bias).
                                
                      - Explain your reasoning in a concise text summary on why it the claims are the way they are providing incline citations around brackets.
                                
                      - Your output must be valid JSON with the following structure (and no additional keys or text):
                                
                        {
                        "truthfulness_score": 0.0,
                        "bias_score": 0.0,
                        "reasoning": "Your concise reasoning here.",
                        }
                      `
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        // temperature: 0.1,
        // top_p: 0.9,
        // frequency_penalty: 0.7,
        // presence_penalty: 0.0
      })
    };
    
    console.log('Sending request to Perplexity API with body:', options.body);
    
    fetch('https://api.perplexity.ai/chat/completions', options)
      .then(async (response) => {
        if (!response.ok) {
          return response.text().then(text => {
            console.error('API Error Response:', text);
            throw new Error(`API request failed: ${response.status} - ${text}`);
          });
        }
        const data = await response.json();
        console.log('Received API response:', data);
        loadingIndicator.style.display = 'none';
        factCheckContainer.style.display = 'block';
        saveToCommunityButton.style.display = 'block';
        // Keep buttons/tip visible
        currentAnalysisResults = data;

        // Determine the key to use for saving
        const saveKey = keyToSaveAs || text;
        currentSelectedText = saveKey; // Update currentSelectedText, especially for webpage scans

        // Structure the result object to be saved and displayed
        // Ensure it includes the necessary fields that displayResults expects
        const resultToSave = {
            ...data, // Spread the raw API response (includes choices, citations etc.)
            savedToCommunity: false // Default save status for new analyses
        };
        
        // Update the global variable with the structured result
        currentAnalysisResults = resultToSave;

        try {
          // Get current results from storage
          const storageData = await new Promise(resolve => chrome.storage.local.get('analysisResults', resolve));
          const analysisResults = storageData.analysisResults || {};
          analysisResults[saveKey] = resultToSave; // Add/update the result using saveKey

          // Wait for the save operation to complete before proceeding
          await new Promise(resolve => chrome.storage.local.set({ analysisResults }, resolve));
          console.log('Analysis results saved under key:', saveKey);

          // Now display the results using the structured object we just saved
          displayResults(resultToSave); // Pass the structured object

        } catch (error) {
            console.error('Error saving analysis results to storage:', error);
            // Handle storage error appropriately
             loadingIndicator.style.display = 'none'; // Ensure loading is hidden
             document.getElementById('error-message').innerHTML = `Error saving analysis results. Please try again.<br><small>${error.message}</small>`;
             document.getElementById('error-container').style.display = 'block';
             factCheckContainer.style.display = 'none';
             saveToCommunityButton.style.display = 'none';
        }
      })
      .catch(error => {
        console.error('Error calling Perplexity API:', error);
        loadingIndicator.style.display = 'none';
        factCheckContainer.style.display = 'none'; // Ensure container is hidden on error
        saveToCommunityButton.style.display = 'none';
        // Keep buttons/tip visible even on error if key exists
        let errorMessage = error.message;
        document.getElementById('error-message').innerHTML = `Error connecting to Perplexity API. Please check your API key and try again.<br><small>${errorMessage}</small>`;
        document.getElementById('error-container').style.display = 'block';
      });
  }
  
  // Extract scores from API response
  function extractJSON(content) {
    try {
      // Extract JSON from content (between ```json and ```)
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      
      if (jsonMatch && jsonMatch[1]) {
        const jsonStr = jsonMatch[1];
        const parsedData = JSON.parse(jsonStr);
        
        return {
          truthScore: Math.round(parsedData.truthfulness_score),
          biasScore: Math.round(parsedData.bias_score),
          reasoning: parsedData.reasoning
        };
      }
      
      // Try to find JSON in curly braces if code block extraction failed
      const curlyBracesMatch = content.match(/\{[\s\S]*?\}/);
      if (curlyBracesMatch && curlyBracesMatch[0]) {
        try {
          const parsedData = JSON.parse(curlyBracesMatch[0]);
          if (parsedData.truthfulness_score !== undefined && parsedData.bias_score !== undefined) {
            return {
              truthScore: Math.round(parsedData.truthfulness_score),
              biasScore: Math.round(parsedData.bias_score),
              reasoning: parsedData.reasoning || content
            };
          }
        } catch (e) {
          console.error('Error parsing JSON from curly braces:', e);
        }
      }
      
      // Fallback to regex if JSON parsing fails
      const truthScoreMatch = content.match(/truth\s*score.*?(\d+)/i);
      const biasScoreMatch = content.match(/bias\s*score.*?(\d+)/i);
      
      return {
        truthScore: truthScoreMatch ? parseInt(truthScoreMatch[1]) : 50,
        biasScore: biasScoreMatch ? parseInt(biasScoreMatch[1]) : 50,
        reasoning: content
      };
    } catch (error) {
      console.error('Error parsing JSON from content:', error);
      // Fallback to regex
      const truthScoreMatch = content.match(/truth\s*score.*?(\d+)/i);
      const biasScoreMatch = content.match(/bias\s*score.*?(\d+)/i);
      
      return {
        truthScore: truthScoreMatch ? parseInt(truthScoreMatch[1]) : 50,
        biasScore: biasScoreMatch ? parseInt(biasScoreMatch[1]) : 50,
        reasoning: content
      };
    }
  }
  
  // Display results in the UI
  function displayResults(fullResultData) {
    // Validate the passed data structure
    if (!fullResultData || !fullResultData.choices || !fullResultData.choices[0] || !fullResultData.choices[0].message) {
      console.error("Invalid or incomplete result data passed to displayResults:", fullResultData);
      document.getElementById('error-message').textContent = 'Invalid response data received from API.';
      document.getElementById('error-container').style.display = 'block';
      factCheckContainer.style.display = 'none'; // Hide container on invalid data
      saveToCommunityButton.style.display = 'none';
      return;
    }

    // Ensure UI elements are correctly shown/hidden
    document.getElementById('error-container').style.display = 'none'; // Hide error if showing results
    factCheckContainer.style.display = 'block'; // Show results container
    saveToCommunityButton.style.display = 'block'; // Show save button

    const content = fullResultData.choices[0].message.content;
    const { truthScore, biasScore, reasoning } = extractJSON(content);

    // Update the circular charts
    updateChart('truth-chart', truthScore);
    updateChart('bias-chart', biasScore);

    // Update text percentage values
    document.querySelector('.circular-chart.orange text').textContent = `${truthScore}%`;
    document.querySelector('.circular-chart.green text').textContent = `${biasScore}%`;

    // Get citations directly from the passed data
    const citations = fullResultData.citations && fullResultData.citations.length > 0 ? fullResultData.citations : [];

    // Display reasoning with clickable citations
    reasoningContent.innerHTML = formatReasoning(reasoning, citations);

    // Display citations as numbered list
    if (citations.length > 0) {
      citationsList.innerHTML = '';
      citations.forEach((citation, index) => {
        const li = document.createElement('li');
        li.setAttribute('value', index + 1); // Set the list item number
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

    // Check saved status directly from the passed data
    if (fullResultData.savedToCommunity) {
      saveToCommunityButton.textContent = 'Saved to Community';
      saveToCommunityButton.classList.add('saved');
      saveToCommunityButton.disabled = true;
    } else {
      saveToCommunityButton.textContent = 'Post to Community Hall';
      saveToCommunityButton.classList.remove('saved');
      saveToCommunityButton.disabled = false;
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
  
  // Format reasoning content with markdown-like syntax and clickable citations
  function formatReasoning(content, citations = []) {
    // Convert markdown headers to HTML
    let formatted = content.replace(/## (.*)/g, '<h3>$1</h3>');
    formatted = formatted.replace(/### (.*)/g, '<h4>$1</h4>');
    
    // Convert markdown paragraphs to HTML paragraphs
    formatted = formatted.split('\n\n').map(paragraph => `<p>${paragraph}</p>`).join('');
    
    // Convert markdown lists
    formatted = formatted.replace(/\n\d+\.\s+(.*)/g, '<li>$1</li>');
    
    // Bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Make citation references clickable [n] -> link to citation n
    formatted = formatted.replace(/\[(\d+)\]/g, (match, number) => {
      const citationIndex = parseInt(number, 10) - 1;
      if (citations && citations[citationIndex]) {
        return `<a href="${citations[citationIndex]}" target="_blank" class="citation-link">[${number}]</a>`;
      }
      return match; // Keep original if no matching citation
    });
    
    return formatted;
  }
  
  // Function to scan all text on the webpage
  function scanWebpage(apiKey) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id && tabs[0].url) { // Ensure tab and URL exist
        const tabUrl = tabs[0].url;
        const placeholderText = `Checked ${new URL(tabUrl).hostname}`; // Use hostname for brevity

        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => document.body.innerText, // Extract all text from the webpage
          },
          (results) => {
            if (chrome.runtime.lastError) {
              // Handle potential errors like no permission
              console.error('Error executing script:', chrome.runtime.lastError);
              alert(`Error scanning webpage: ${chrome.runtime.lastError.message}`);
              loadingIndicator.style.display = 'none';
              factCheckContainer.style.display = 'none';
              saveToCommunityButton.style.display = 'none';
              return;
            }
            
            if (results && results[0] && results[0].result) {
              const webpageText = results[0].result.trim();
              if (webpageText) {
                loadingIndicator.style.display = 'block';
                factCheckContainer.style.display = 'none'; // Hide container
                saveToCommunityButton.style.display = 'none';
                // Keep buttons/tip visible
                currentSelectedText = placeholderText; // Use placeholder for display/saving key

                // Reset the shouldAnalyze flag and set selectedText to the placeholder
                // Associate the analysis results with the placeholder text
                chrome.storage.local.set({ shouldAnalyze: false, selectedText: placeholderText }, () => {
                   // Pass the full webpageText for analysis, and placeholderText as the key to save under
                   analyzeWithPerplexity(webpageText, apiKey, placeholderText); 
                });
              } else {
                alert('No text found on the webpage.');
                loadingIndicator.style.display = 'none'; // Hide loading if no text
              }
            } else {
                // Handle cases where results might be empty or unexpected
                alert('Could not retrieve text from the webpage.');
                loadingIndicator.style.display = 'none'; // Hide loading
                factCheckContainer.style.display = 'none';
                saveToCommunityButton.style.display = 'none';
                // Keep buttons/tip visible
            }
          }
        );
      } else {
        console.error("Could not get active tab information.");
        alert("Could not get active tab information to scan.");
      }
    });
  }

  // Function to save fact check to community (Supabase)
  function saveFactCheckToCommunity() {
    if (!currentAnalysisResults || !currentSelectedText) {
      alert('No analysis results to save.');
      return;
    }

    // Disable button immediately
    saveToCommunityButton.disabled = true;
    saveToCommunityButton.textContent = 'Saving...';
    saveToCommunityButton.classList.remove('saved'); // Ensure saved class isn't prematurely added

    const content = currentAnalysisResults.choices[0].message.content;
    const { truthScore, biasScore, reasoning } = extractJSON(content);

    // Get citations if available
    const citations = currentAnalysisResults.citations || [];

    // Send to background script to handle the Supabase operation
    chrome.runtime.sendMessage({
      action: 'saveFactCheck',
      factCheck: {
        text: currentSelectedText, // Use the text/placeholder that was used as the key
        truth_score: truthScore,
        bias_score: biasScore,
        reasoning: reasoning,
        citations: citations
      }
    }, (response) => {
      if (response.success) {
        saveToCommunityButton.textContent = 'Saved to Community';
        saveToCommunityButton.classList.add('saved');
        // Button remains disabled

        // Mark this fact check as saved in storage
        chrome.storage.local.get('analysisResults', (storageData) => {
          const analysisResults = storageData.analysisResults || {};
          if (analysisResults[currentSelectedText]) {
            analysisResults[currentSelectedText].savedToCommunity = true;
            chrome.storage.local.set({ analysisResults }, () => {
              console.log('Marked fact check as saved:', currentSelectedText);
            });
          }
        });

      } else {
        // Re-enable button on error
        saveToCommunityButton.disabled = false;
        saveToCommunityButton.textContent = 'Post to Community Hall'; // Reset text
        alert(`Error saving to community: ${response.error || 'Unknown error'}`);
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
  
  // Add event listener to the community hall button
  if (communityHallButton) {
    communityHallButton.addEventListener('click', () => {
      window.location.href = 'community.html';
    });
  }
  
  // Add event listener to the save to community button
  if (saveToCommunityButton) {
    saveToCommunityButton.addEventListener('click', saveFactCheckToCommunity);
    // Initially hide the save button (factCheckContainer hides it implicitly now, but good practice)
    saveToCommunityButton.style.display = 'none';
  }

  // Initialize
  checkApiKey();
});
