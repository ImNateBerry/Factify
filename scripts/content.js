let sidePanelButton = null; // Initialize to null

// Function to create the button if it doesn't exist
function ensureSidePanelButton() {
    if (sidePanelButton) return; // Already created

    console.log('Creating side panel button');
    sidePanelButton = document.createElement('button');
    // Remove text content and direct styling that will be handled by CSS
    // sidePanelButton.textContent = 'Fact Check';
    sidePanelButton.style.position = 'absolute';
    sidePanelButton.style.zIndex = '10000';
    // sidePanelButton.style.backgroundColor = '#007bff';
    // sidePanelButton.style.color = '#fff';
    // sidePanelButton.style.border = 'none';
    // sidePanelButton.style.padding = '5px 10px';
    // sidePanelButton.style.borderRadius = '5px';
    sidePanelButton.style.cursor = 'pointer';
    sidePanelButton.style.display = 'none'; // Start hidden

    // Add CSS class for styling
    sidePanelButton.classList.add('fact-checker-button');

    // Set background image using the extension's icon URL
    try {
        const iconUrl = chrome.runtime.getURL('images/icon128.png');
        sidePanelButton.style.backgroundImage = `url('${iconUrl}')`;
    } catch (error) {
        console.error("Error getting icon URL:", error);
        // Fallback or alternative styling can be added here if needed
    }

    document.body.appendChild(sidePanelButton);

    // Add the click event listener
    sidePanelButton.addEventListener('click', () => {
        console.log('Side panel button clicked');
        try {
            // Get the currently selected text at the time of the click
            const currentSelectedText = window.getSelection().toString().trim();
            if (currentSelectedText) {
                 chrome.runtime.sendMessage({ 
                    action: 'openSidePanel', 
                    text: currentSelectedText,
                    shouldAnalyze: true // Add flag to indicate analysis is needed
                 }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Log the specific error message
                        console.error('Error sending message to background:', chrome.runtime.lastError.message);
                    } else {
                        console.log('Message sent to background:', response);
                    }
                });
            } else {
                console.log('No text selected at the time of click.');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
        sidePanelButton.style.display = 'none'; // Hide after click
    });
}

// Function to update button visibility and position based on selection
function updateButtonState() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && selection.rangeCount > 0) {
        ensureSidePanelButton(); // Make sure button exists

        try {
            const range = selection.getRangeAt(0);
            // Basic check if range is within the document body
            if (document.body.contains(range.commonAncestorContainer)) {
                 const rect = range.getBoundingClientRect();
                 // Prevent positioning if rect is invalid (e.g., width/height 0)
                 if (rect.width > 0 || rect.height > 0) {
                     sidePanelButton.style.top = `${window.scrollY + rect.bottom + 5}px`;
                     sidePanelButton.style.left = `${window.scrollX + rect.left}px`;
                     sidePanelButton.style.display = 'block';
                     console.log('Showing button for selection:', selectedText);
                 } else {
                     // Hide if rect is invalid
                     if (sidePanelButton) sidePanelButton.style.display = 'none';
                     console.log('Hiding button: Invalid selection rect.');
                 }
            } else {
                // Hide if selection is not within the body
                if (sidePanelButton) sidePanelButton.style.display = 'none';
                console.log('Hiding button: Selection not in body.');
            }
        } catch (error) {
            console.error('Error getting selection bounds:', error);
            if (sidePanelButton) sidePanelButton.style.display = 'none'; // Hide on error
        }
    } else {
        // No text selected, hide the button
        if (sidePanelButton) {
            sidePanelButton.style.display = 'none';
            console.log('Hiding button: No text selected.');
        }
    }
}

// Debounce function to limit rapid firing of updateButtonState
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Listen for selection changes, debounced to avoid excessive updates
document.addEventListener('selectionchange', debounce(updateButtonState, 100));

// Also listen for mouseup as a fallback for some edge cases (e.g., clicking away)
// Use a shorter debounce or no debounce for mouseup if needed for responsiveness
document.addEventListener('mouseup', debounce(updateButtonState, 50));
