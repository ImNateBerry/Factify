document.addEventListener('DOMContentLoaded', () => {
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  const detailTextElement = document.getElementById('detail-text');
  const reasoningContent = document.getElementById('reasoning-content');
  const citationsList = document.getElementById('citations-list');
  const citationsContainer = document.getElementById('citations-container');
  const detailLikeButton = document.getElementById('detail-like-button');
  const detailDislikeButton = document.getElementById('detail-dislike-button');
  const detailLikesCount = document.getElementById('detail-likes-count');
  const detailDislikesCount = document.getElementById('detail-dislikes-count');
  const detailTimestamp = document.getElementById('detail-timestamp');
  const backToCommunityButton = document.getElementById('back-to-community');
  
  // Load the fact check detail from storage
  loadingIndicator.style.display = 'block';
  chrome.storage.local.get('detailFactCheck', (data) => {
    loadingIndicator.style.display = 'none';
    
    if (!data.detailFactCheck) {
      errorMessage.textContent = 'No fact check data found.';
      errorContainer.style.display = 'block';
      return;
    }
    
    const factCheck = data.detailFactCheck;
    displayDetail(factCheck);
  });
  
  // Function to display details
  function displayDetail(factCheck) {
    // Display the text
    detailTextElement.textContent = factCheck.text;
    
    // Update the percentages instead of charts
    document.getElementById('truth-percentage').textContent = `${factCheck.truth_score}%`;
    document.getElementById('bias-percentage').textContent = `${factCheck.bias_score}%`;
    
    // Display reasoning
    reasoningContent.innerHTML = formatReasoning(factCheck.reasoning);
    
    // Display citations if available
    if (factCheck.citations && factCheck.citations.length > 0) {
      citationsList.innerHTML = '';
      factCheck.citations.forEach((citation, index) => {
        const li = document.createElement('li');
        li.setAttribute('value', index + 1);
        const a = document.createElement('a');
        a.href = citation;
        a.textContent = citation;
        a.target = '_blank';
        li.appendChild(a);
        citationsList.appendChild(li);
      });
      citationsContainer.style.display = 'block';
    } else {
      citationsContainer.style.display = 'none';
    }
    
    // Update community votes
    detailLikesCount.textContent = factCheck.likes || 0;
    detailDislikesCount.textContent = factCheck.dislikes || 0;
    
    // Mark the user's vote if they've already voted
    if (factCheck.userVote === 'like') {
      detailLikeButton.classList.add('active');
    } else if (factCheck.userVote === 'dislike') {
      detailDislikeButton.classList.add('active');
    }
    
    // Format and display timestamp
    const timestamp = new Date(factCheck.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    detailTimestamp.textContent = `Posted on ${timestamp}`;
    
    // Add event listeners for like/dislike buttons
    detailLikeButton.addEventListener('click', () => {
      voteFactCheck(factCheck.id, 'like');
    });
    
    detailDislikeButton.addEventListener('click', () => {
      voteFactCheck(factCheck.id, 'dislike');
    });
  }
  
  // Function to update the chart with score - no longer needed for detail page but kept for compatibility
  function updateChart(chartId, score) {
    // This function is no longer used for the detail page
    // But we keep it for compatibility with other pages
    const chart = document.getElementById(chartId);
    if (chart) {
      const circlePath = chart.querySelector('.circle');
      if (circlePath) {
        circlePath.setAttribute('stroke-dasharray', `${score}, 100`);
      }
    }
  }
  
  // Format reasoning content with markdown-like syntax and clickable citations
  function formatReasoning(content, citations = []) {
    if (!content) return '';
    
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
  
  // Function to handle voting
  function voteFactCheck(factCheckId, voteType) {
    chrome.runtime.sendMessage({
      action: 'voteFactCheck',
      factCheckId: factCheckId,
      voteType: voteType
    }, (response) => {
      if (response.success) {
        // Refresh the detail page with updated data
        chrome.runtime.sendMessage({
          action: 'getFactCheckDetail',
          factCheckId: factCheckId
        }, (detailResponse) => {
          if (detailResponse.factCheck) {
            chrome.storage.local.set({ 
              detailFactCheck: detailResponse.factCheck 
            }, () => {
              // Reset the active state on buttons
              detailLikeButton.classList.remove('active');
              detailDislikeButton.classList.remove('active');
              
              // Update the UI with new data
              detailLikesCount.textContent = detailResponse.factCheck.likes || 0;
              detailDislikesCount.textContent = detailResponse.factCheck.dislikes || 0;
              
              // Mark the user's vote
              if (detailResponse.factCheck.userVote === 'like') {
                detailLikeButton.classList.add('active');
              } else if (detailResponse.factCheck.userVote === 'dislike') {
                detailDislikeButton.classList.add('active');
              }
            });
          }
        });
      } else if (response.error) {
        errorMessage.textContent = `Error: ${response.error}`;
        errorContainer.style.display = 'block';
      }
    });
  }
  
  // Back to community button handler
  backToCommunityButton.addEventListener('click', () => {
    window.location.href = 'community.html';
  });
}); 