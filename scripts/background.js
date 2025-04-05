chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed and ready.');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error('Failed to set panel behavior:', error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    chrome.storage.local.set({ 
      selectedText: message.text,
      shouldAnalyze: !!message.shouldAnalyze // Store the flag indicating whether to analyze
    }, () => {
      console.log('Selected text saved:', message.text);
      console.log('Should analyze:', !!message.shouldAnalyze);
      chrome.runtime.sendMessage({ 
        action: 'updateSidePanel', 
        text: message.text,
        shouldAnalyze: !!message.shouldAnalyze
      });
    });
    chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
      chrome.sidePanel.open({ windowId: currentWindow.id })
        .then(() => {
          console.log('Side panel opened successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Failed to open side panel:', error);
          sendResponse({ success: false, error: error.message });
        });
    });
    // Indicate that the response will be sent asynchronously
    return true;
  } else if (message.action === 'saveFactCheck') {
    // Save fact check to Supabase
    saveFactCheckToSupabase(message.factCheck)
      .then(result => {
        console.log('Fact check saved successfully:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Error saving fact check:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  } else if (message.action === 'fetchFactChecks') {
    // Fetch fact checks from Supabase
    fetchFactChecksFromSupabase(message.orderBy)
      .then(factChecks => {
        console.log('Fetched fact checks:', factChecks);
        sendResponse({ factChecks });
      })
      .catch(error => {
        console.error('Error fetching fact checks:', error);
        sendResponse({ error: error.message });
      });
    return true;
  } else if (message.action === 'getFactCheckDetail') {
    // Get single fact check detail
    getFactCheckDetailFromSupabase(message.factCheckId)
      .then(factCheck => {
        console.log('Fetched fact check detail:', factCheck);
        sendResponse({ factCheck });
      })
      .catch(error => {
        console.error('Error fetching fact check detail:', error);
        sendResponse({ error: error.message });
      });
    return true;
  } else if (message.action === 'voteFactCheck') {
    // Vote for a fact check
    voteForFactCheck(message.factCheckId, message.voteType)
      .then(result => {
        console.log('Vote recorded successfully:', result);
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Error recording vote:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Supabase configuration
const SUPABASE_URL = 'https://gfxdgerkqcihupdsgdzo.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeGRnZXJrcWNpaHVwZHNnZHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4ODM0MzEsImV4cCI6MjA1OTQ1OTQzMX0.zOfgzx3eTYaLNaNY2L7w2aRjmYoOhm2ISFk1dh15sxs';

// Function to get Supabase key from storage
async function getSupabaseKey() {
  if (supabaseKey) return supabaseKey;
  
  return new Promise((resolve) => {
    chrome.storage.local.get('supabaseKey', (data) => {
      if (data.supabaseKey) {
        supabaseKey = data.supabaseKey;
        resolve(supabaseKey);
      } else {
        // Use a default anonymous key for public access
        // In a real extension, you might want to secure this differently
        supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9';
        chrome.storage.local.set({ supabaseKey });
        resolve(supabaseKey);
      }
    });
  });
}

// Function to save fact check to Supabase
async function saveFactCheckToSupabase(factCheck) {
  const key = await getSupabaseKey();
  
  // Create the fact check in Supabase
  const response = await fetch(`${SUPABASE_URL}/rest/v1/fact_checks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      text: factCheck.text,
      truth_score: factCheck.truth_score,
      bias_score: factCheck.bias_score,
      reasoning: factCheck.reasoning,
      likes: 0,
      dislikes: 0
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to save fact check: ${errorText}`);
  }
  
  const savedFactCheck = await response.json();
  
  // If there are citations, save them too
  if (factCheck.citations && factCheck.citations.length > 0) {
    for (const url of factCheck.citations) {
      await fetch(`${SUPABASE_URL}/rest/v1/citations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          fact_check_id: savedFactCheck[0].id,
          url: url
        })
      });
    }
  }
  
  return savedFactCheck[0];
}

// Function to fetch fact checks from Supabase
async function fetchFactChecksFromSupabase(orderBy = 'created_at.desc.nullslast') {
  const key = await getSupabaseKey();
  
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/fact_checks?select=*&order=${encodeURIComponent(orderBy)}&limit=50`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch fact checks: ${errorText}`);
  }
  
  const factChecks = await response.json();
  
  // Get user votes for these fact checks
  const userVotes = await getUserVotes(factChecks.map(fc => fc.id));
  
  // Attach user votes to fact checks
  for (const factCheck of factChecks) {
    const vote = userVotes.find(v => v.fact_check_id === factCheck.id);
    if (vote) {
      factCheck.userVote = vote.vote_type;
    }
  }
  
  return factChecks;
}

// Function to get a single fact check detail
async function getFactCheckDetailFromSupabase(factCheckId) {
  const key = await getSupabaseKey();
  
  // Get the fact check
  const factCheckResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/fact_checks?id=eq.${factCheckId}&limit=1`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  if (!factCheckResponse.ok) {
    const errorText = await factCheckResponse.text();
    throw new Error(`Failed to fetch fact check: ${errorText}`);
  }
  
  const factChecks = await factCheckResponse.json();
  
  if (factChecks.length === 0) {
    throw new Error('Fact check not found');
  }
  
  const factCheck = factChecks[0];
  
  // Get citations for this fact check
  const citationsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/citations?fact_check_id=eq.${factCheckId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  if (citationsResponse.ok) {
    const citations = await citationsResponse.json();
    factCheck.citations = citations.map(c => c.url);
  }
  
  // Get user vote for this fact check
  const userVotes = await getUserVotes([factCheckId]);
  if (userVotes.length > 0) {
    factCheck.userVote = userVotes[0].vote_type;
  }
  
  return factCheck;
}

// Function to vote for a fact check
async function voteForFactCheck(factCheckId, voteType) {
  const key = await getSupabaseKey();
  
  // Generate a unique user ID if not exists
  let userId = await getUserId();
  
  // Check if the user already voted for this fact check
  const existingVoteResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/user_votes?user_id=eq.${userId}&fact_check_id=eq.${factCheckId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  const existingVotes = await existingVoteResponse.json();
  let oldVoteType = null;
  
  if (existingVotes.length > 0) {
    oldVoteType = existingVotes[0].vote_type;
    
    // If voting the same way, remove the vote
    if (oldVoteType === voteType) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/user_votes?user_id=eq.${userId}&fact_check_id=eq.${factCheckId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`
          }
        }
      );
      
      // Update the fact check counts
      await updateFactCheckVoteCounts(factCheckId, oldVoteType, 'remove');
      return { removed: true };
    } else {
      // Update the vote
      await fetch(
        `${SUPABASE_URL}/rest/v1/user_votes?user_id=eq.${userId}&fact_check_id=eq.${factCheckId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            vote_type: voteType
          })
        }
      );
      
      // Update the fact check counts (remove old vote and add new one)
      await updateFactCheckVoteCounts(factCheckId, oldVoteType, 'remove');
      await updateFactCheckVoteCounts(factCheckId, voteType, 'add');
      return { updated: true, voteType };
    }
  } else {
    // Create a new vote
    await fetch(
      `${SUPABASE_URL}/rest/v1/user_votes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          user_id: userId,
          fact_check_id: factCheckId,
          vote_type: voteType
        })
      }
    );
    
    // Update the fact check counts
    await updateFactCheckVoteCounts(factCheckId, voteType, 'add');
    return { created: true, voteType };
  }
}

// Function to update fact check vote counts
async function updateFactCheckVoteCounts(factCheckId, voteType, action) {
  const key = await getSupabaseKey();
  
  // Get current counts
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/fact_checks?id=eq.${factCheckId}&select=likes,dislikes`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  const factChecks = await response.json();

  console.log(factChecks);
  
  if (factChecks.length === 0) {
    throw new Error('Fact check not found');
  }
  
  const factCheck = factChecks[0];
  let likes = factCheck.likes || 0;
  let dislikes = factCheck.dislikes || 0;
  
  // Update counts based on action
  if (voteType === 'like') {
    likes = action === 'add' ? likes + 1 : Math.max(0, likes - 1);
  } else if (voteType === 'dislike') {
    dislikes = action === 'add' ? dislikes + 1 : Math.max(0, dislikes - 1);
  }
  
  // Update the fact check
  await fetch(
    `${SUPABASE_URL}/rest/v1/fact_checks?id=eq.${factCheckId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        likes,
        dislikes
      })
    }
  );

  console.log('Successfully updated vote counts');
}

// Function to get user votes
async function getUserVotes(factCheckIds) {
  if (factCheckIds.length === 0) return [];
  
  const key = await getSupabaseKey();
  const userId = await getUserId();
  
  // Create a query that filters for the fact check IDs
  const idsFilter = factCheckIds.map(id => `fact_check_id.eq.${id}`).join(',');
  
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/user_votes?user_id=eq.${userId}&or=(${idsFilter})`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    }
  );
  
  if (!response.ok) return [];
  return await response.json();
}

// Function to get or create user ID
async function getUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('userId', (data) => {
      if (data.userId) {
        resolve(data.userId);
      } else {
        const newUserId = self.crypto.randomUUID();
        chrome.storage.local.set({ userId: newUserId });
        resolve(newUserId);
      }
    });
  });
}