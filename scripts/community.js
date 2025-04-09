document.addEventListener('DOMContentLoaded', () => {
  const factChecksContainer = document.getElementById('fact-checks-container');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const noResults = document.getElementById('no-results');
  const backToHomeButton = document.getElementById('back-arrow');
  const tabButtons = document.querySelectorAll('.tab-button');
  const loadMoreButton = document.getElementById('load-more-button');
  
  let currentTab = 'top-rated';
  let currentOffset = 0;
  const loadLimit = 10;
  
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
    
    currentOffset = 0;
    factChecksContainer.innerHTML = '';
    loadMoreButton.style.display = 'none';
    loadFactChecks(false);
  }
  
  // Add event listeners to tab buttons
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });
  
  // Function to load fact checks from Supabase
  async function loadFactChecks(isLoadingMore = false) {
    if (!isLoadingMore) {
      loadingIndicator.style.display = 'block';
      factChecksContainer.innerHTML = '';
      currentOffset = 0;
      noResults.style.display = 'none';
    } else {
      loadMoreButton.textContent = 'Loading...';
      loadMoreButton.disabled = true;
    }

    errorContainer.style.display = 'none';
    loadMoreButton.style.display = 'none';

    try {
      const orderBy = currentTab === 'top-rated' 
        ? 'likes.desc.nullslast,dislikes.asc.nullslast' 
        : 'created_at.desc.nullslast';
      
      chrome.runtime.sendMessage({
        action: 'fetchFactChecks',
        orderBy: orderBy,
        limit: loadLimit,
        offset: currentOffset
      }, (response) => {
        if (!isLoadingMore) {
          loadingIndicator.style.display = 'none';
        } else {
          loadMoreButton.textContent = 'Load More';
          loadMoreButton.disabled = false;
        }
        
        if (response.error) {
          errorMessage.textContent = `Error loading fact checks: ${response.error}`;
          errorContainer.style.display = 'block';
          return;
        }
        
        const factChecks = response.factChecks || [];
        
        if (!isLoadingMore && factChecks.length === 0) {
          noResults.style.display = 'block';
          return;
        }
        
        if (isLoadingMore && factChecks.length === 0) {
          loadMoreButton.style.display = 'none';
          return;
        }
        
        factChecks.forEach(factCheck => {
          const factCheckElement = createFactCheckElement(factCheck);
          factChecksContainer.appendChild(factCheckElement);
        });
        
        currentOffset += factChecks.length;
        
        if (factChecks.length < loadLimit) {
          loadMoreButton.style.display = 'none';
        } else {
          loadMoreButton.style.display = 'block';
        }
      });
    } catch (error) {
      errorMessage.textContent = `Error: ${error.message}`;
      errorContainer.style.display = 'block';
      if (!isLoadingMore) {
        loadingIndicator.style.display = 'none';
      } else {
        loadMoreButton.textContent = 'Load More';
        loadMoreButton.disabled = false;
      }
      loadMoreButton.style.display = 'none';
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
  
  // Add event listener for the load more button
  loadMoreButton.addEventListener('click', () => {
    loadFactChecks(true);
  });
  
  // Initial load
  loadFactChecks(false);
}); 