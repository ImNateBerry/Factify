document.addEventListener('DOMContentLoaded', () => {
  const factChecksContainer = document.getElementById('fact-checks-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const noResults = document.getElementById('no-results');
  const backToHomeButton = document.getElementById('back-to-home');
  const tabButtons = document.querySelectorAll('.tab-button');
  
  let currentTab = 'top-rated';
  
  // Function to handle tab switching
  function switchTab(tab) {
    currentTab = tab;
    tabButtons.forEach(button => {
      if (button.dataset.tab === tab) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    loadFactChecks();
  }
  
  // Add event listeners to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });
  
  // Function to load fact checks from Supabase
  async function loadFactChecks() {
    factChecksContainer.innerHTML = '';
    loadingIndicator.style.display = 'block';
    noResults.style.display = 'none';
    errorContainer.style.display = 'none';
    
    try {
      // Different ordering based on the current tab - using Supabase compatible syntax
      const orderBy = currentTab === 'top-rated' 
        ? 'likes.desc.nullslast,dislikes.asc.nullslast' 
        : 'created_at.desc.nullslast';
      
      // Make a request to a background script that will handle the Supabase query
      chrome.runtime.sendMessage({
        action: 'fetchFactChecks',
        orderBy: orderBy
      }, (response) => {
        loadingIndicator.style.display = 'none';
        
        if (response.error) {
          errorMessage.textContent = `Error loading fact checks: ${response.error}`;
          errorContainer.style.display = 'block';
          return;
        }
        
        const factChecks = response.factChecks || [];
        
        if (factChecks.length === 0) {
          noResults.style.display = 'block';
          return;
        }
        
        // Render fact checks
        factChecks.forEach(factCheck => {
          const factCheckElement = createFactCheckElement(factCheck);
          factChecksContainer.appendChild(factCheckElement);
        });
      });
    } catch (error) {
      loadingIndicator.style.display = 'none';
      errorMessage.textContent = `Error: ${error.message}`;
      errorContainer.style.display = 'block';
    }
  }
  
  // Function to create a fact check card element
  function createFactCheckElement(factCheck) {
    const card = document.createElement('div');
    card.className = 'fact-check-card';
    card.dataset.id = factCheck.id;
    
    // Trim text for preview
    const previewText = factCheck.text.length > 200 
      ? factCheck.text.substring(0, 200) + '...' 
      : factCheck.text;
    
    // Format the timestamp
    const timestamp = new Date(factCheck.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    card.innerHTML = `
      <div class="fact-check-content">
        <p class="fact-check-text">${previewText}</p>
      </div>
      <div class="fact-check-meta">
        <div class="fact-check-scores">
          <div class="mini-score">
            <span class="score-dot truth-dot"></span>
            <span class="score-value">Truth: ${factCheck.truth_score}%</span>
            <span class="score-dot bias-dot"></span>
            <span class="score-value">Bias: ${factCheck.bias_score}%</span>
          </div>
        </div>
        <div class="vote-controls">
          <button class="vote-button like-button ${factCheck.userVote === 'like' ? 'active' : ''}">👍</button>
          <span class="vote-count">${factCheck.likes || 0}</span>
          <button class="vote-button dislike-button ${factCheck.userVote === 'dislike' ? 'active' : ''}">👎</button>
          <span class="vote-count">${factCheck.dislikes || 0}</span>
        </div>
      </div>
      <button class="read-more-button">Read Full Analysis</button>
      <div class="timestamp">Posted on ${timestamp}</div>
    `;
    
    // Add event listeners for like/dislike buttons
    const likeButton = card.querySelector('.like-button');
    const dislikeButton = card.querySelector('.dislike-button');
    const readMoreButton = card.querySelector('.read-more-button');
    
    likeButton.addEventListener('click', () => {
      voteFactCheck(factCheck.id, 'like');
    });
    
    dislikeButton.addEventListener('click', () => {
      voteFactCheck(factCheck.id, 'dislike');
    });
    
    readMoreButton.addEventListener('click', () => {
      showFactCheckDetail(factCheck.id);
    });
    
    return card;
  }
  
  // Function to handle voting
  function voteFactCheck(factCheckId, voteType) {
    chrome.runtime.sendMessage({
      action: 'voteFactCheck',
      factCheckId: factCheckId,
      voteType: voteType
    }, (response) => {
      if (response.success) {
        // Reload fact checks to reflect the updated vote counts
        loadFactChecks();
      } else if (response.error) {
        errorMessage.textContent = `Error: ${response.error}`;
        errorContainer.style.display = 'block';
      }
    });
  }
  
  // Function to show fact check detail
  function showFactCheckDetail(factCheckId) {
    chrome.runtime.sendMessage({
      action: 'getFactCheckDetail',
      factCheckId: factCheckId
    }, (response) => {
      if (response.factCheck) {
        // Open a new tab or modal with the full fact check details
        chrome.storage.local.set({ 
          detailFactCheck: response.factCheck 
        }, () => {
          // Open the detail page in a new tab
          chrome.tabs.create({ url: 'fact-check-detail.html' });
        });
      } else if (response.error) {
        errorMessage.textContent = `Error: ${response.error}`;
        errorContainer.style.display = 'block';
      }
    });
  }
  
  // Back to home button handler
  backToHomeButton.addEventListener('click', () => {
    // Navigate back to the main extension panel
    window.location.href = 'sidepanel.html';
  });
  
  // Initial load
  loadFactChecks();
}); 