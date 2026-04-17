// ai-command-ui.js
// UI Components for AI Command Interface
// Add these to content.js

// ===== COMMAND INPUT COMPONENT =====
// Replace the existing searchInput with this enhanced version

function createCommandInput() {
  const container = document.createElement("div");
  container.className = "ts-command-container";
  
  const icon = document.createElement("span");
  icon.className = "ts-command-icon";
  icon.textContent = "🤖";
  container.appendChild(icon);
  
  const input = document.createElement("input");
  input.className = "ts-command-input";
  input.placeholder = "Ask AI anything... (Ctrl+Shift+K)";
  input.spellcheck = false;
  input.autocomplete = "off";
  container.appendChild(input);
  
  // Command history
  let commandHistory = [];
  let historyIndex = -1;
  
  // Load history from storage
  chrome.storage.local.get({ commandHistory: [] }, (items) => {
    commandHistory = items.commandHistory || [];
  });
  
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const command = input.value.trim();
      if (command) {
        executeAICommand(command);
        
        // Save to history
        commandHistory.unshift(command);
        if (commandHistory.length > 50) commandHistory.pop();
        chrome.storage.local.set({ commandHistory });
        historyIndex = -1;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input.value = commandHistory[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = commandHistory[historyIndex];
      } else {
        historyIndex = -1;
        input.value = "";
      }
    } else if (e.key === "Escape") {
      input.value = "";
      input.blur();
    }
  });
  
  // Auto-expand on focus
  input.addEventListener("focus", () => {
    container.classList.add("active");
  });
  
  input.addEventListener("blur", () => {
    if (!input.value) {
      container.classList.remove("active");
    }
  });
  
  return { container, input };
}

// ===== COMMAND EXECUTION =====
async function executeAICommand(command) {
  const { input } = commandInputComponents;
  
  if (aiCommandInProgressInUI) {
    console.log('[AI UI] Command already in progress, ignoring');
    return;
  }
  
  aiCommandInProgressInUI = true;

  // Show loading state
  input.value = "";
  input.placeholder = "⏳ Processing...";
  input.disabled = true;
  
  try {
    const response = await new Promise((resolve, reject) => {
      safeSendMessage({ 
        type: "AI_COMMAND", 
        command 
      }, (resp) => {
        if (!resp) {
          reject(new Error("No response from background script"));
        } else {
          resolve(resp);
        }
      });
    });
    
    console.log('[AI Command] Response:', response);
    
    if (response.awaitingConfirmation) {
      // Confirmation will be handled by CONFIRM_TOOL_CALL message
      return;
    }
    
    if (response.success) {
      showToast(response.message, "success");
      
      // Show analysis results if present
      if (response.analysis) {
        showAnalysisModal(response.analysis);
      }
    } else {
      showToast(response.message || "Command failed", "error");
    }
  } catch (error) {
    console.error('[AI Command] Error:', error);
    showToast("Error: " + error.message, "error");
  } finally {
    aiCommandInProgressInUI = false;
    input.disabled = false;
    input.placeholder = "Ask AI anything...";
    input.focus();
  }
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `ts-toast ts-toast-${type}`;
  
  const icon = document.createElement("span");
  icon.className = "ts-toast-icon";
  icon.textContent = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  toast.appendChild(icon);
  
  const text = document.createElement("span");
  text.className = "ts-toast-text";
  text.textContent = message;
  toast.appendChild(text);
  
  shadow.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });
  
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ===== CONFIRMATION MODAL =====
function showConfirmationModal(data) {
  const modal = document.createElement("div");
  modal.className = "ts-confirm-modal";
  
  const overlay = document.createElement("div");
  overlay.className = "ts-modal-overlay";
  modal.appendChild(overlay);
  
  const content = document.createElement("div");
  content.className = "ts-modal-content";
  
  const title = document.createElement("h3");
  title.textContent = data.message;
  content.appendChild(title);
  
  const details = document.createElement("p");
  details.className = "ts-modal-details";
  details.textContent = data.details;
  content.appendChild(details);
  
  const buttons = document.createElement("div");
  buttons.className = "ts-modal-buttons";
  
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ts-btn ts-btn-cancel";
  cancelBtn.textContent = "Cancel";
  buttons.appendChild(cancelBtn);
  
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "ts-btn ts-btn-confirm";
  confirmBtn.textContent = "Confirm";
  buttons.appendChild(confirmBtn);
  
  content.appendChild(buttons);
  modal.appendChild(content);
  shadow.appendChild(modal);
  
  requestAnimationFrame(() => {
    modal.classList.add("visible");
  });
  
  return new Promise((resolve) => {
    confirmBtn.onclick = () => {
      modal.classList.remove("visible");
      setTimeout(() => modal.remove(), 300);
      resolve(true);
    };
    
    cancelBtn.onclick = () => {
      modal.classList.remove("visible");
      setTimeout(() => modal.remove(), 300);
      resolve(false);
    };
    
    overlay.onclick = () => {
      modal.classList.remove("visible");
      setTimeout(() => modal.remove(), 300);
      resolve(false);
    };
  });
}

// ===== ANALYSIS RESULTS MODAL =====
function showAnalysisModal(analysis) {
  const modal = document.createElement("div");
  modal.className = "ts-analysis-modal";
  
  const overlay = document.createElement("div");
  overlay.className = "ts-modal-overlay";
  modal.appendChild(overlay);
  
  const content = document.createElement("div");
  content.className = "ts-modal-content ts-modal-analysis";
  
  const title = document.createElement("h3");
  title.textContent = "📊 Tab Analysis";
  content.appendChild(title);
  
  const pre = document.createElement("pre");
  pre.className = "ts-analysis-results";
  pre.textContent = JSON.stringify(analysis, null, 2);
  content.appendChild(pre);
  
  const closeBtn = document.createElement("button");
  closeBtn.className = "ts-btn ts-btn-primary";
  closeBtn.textContent = "Close";
  closeBtn.onclick = () => {
    modal.classList.remove("visible");
    setTimeout(() => modal.remove(), 300);
  };
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  shadow.appendChild(modal);
  
  requestAnimationFrame(() => {
    modal.classList.add("visible");
  });
  
  overlay.onclick = closeBtn.onclick;
}

// ===== COMMAND SUGGESTIONS =====
const COMMAND_EXAMPLES = [
  "Close all YouTube tabs",
  "Group all GitHub tabs",
  "Bookmark all docs to 'Resources'",
  "Mute all tabs",
  "Pin all Google Docs",
  "Snooze Reddit tabs for 2 hours",
  "Sort tabs by domain",
  "Find duplicate tabs",
  "Show tab summary",
  "Close inactive tabs"
];

function showCommandSuggestions() {
  const suggestions = document.createElement("div");
  suggestions.className = "ts-command-suggestions";
  
  const title = document.createElement("div");
  title.className = "ts-suggestions-title";
  title.textContent = "💡 Try these commands:";
  suggestions.appendChild(title);
  
  COMMAND_EXAMPLES.forEach(example => {
    const item = document.createElement("div");
    item.className = "ts-suggestion-item";
    item.textContent = example;
    item.onclick = () => {
      commandInputComponents.input.value = example;
      commandInputComponents.input.focus();
      suggestions.remove();
    };
    suggestions.appendChild(item);
  });
  
  shadow.appendChild(suggestions);
  
  setTimeout(() => suggestions.classList.add("visible"), 10);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    suggestions.classList.remove("visible");
    setTimeout(() => suggestions.remove(), 300);
  }, 10000);
}

// ===== MESSAGE LISTENERS =====
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CONFIRM_TOOL_CALL") {
    (async () => {
      const confirmed = await showConfirmationModal(msg);
      
      if (confirmed) {
        // Execute the confirmed action
        safeSendMessage({
          type: "EXECUTE_CONFIRMED_TOOL_CALL",
          functionCall: msg.functionCall
        }, (response) => {
          if (response.success) {
            showToast(response.message, "success");
          } else {
            showToast(response.message, "error");
          }
        });
      } else {
        showToast("Action cancelled", "info");
      }
    })();
  }
});

// ===== GLOBAL KEYBOARD SHORTCUT =====
window.addEventListener("keydown", (e) => {
  // Ctrl+Shift+K to activate command input
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    
    // Show the bar if hidden
    if (trigger.classList.contains("hidden")) {
      showBar();
    }
    
    commandInputComponents.input.focus();
    commandInputComponents.container.classList.add("active");
  }
}, true);

// ===== INITIALIZATION =====
// Call this in the main content.js initialization
let commandInputComponents = null;
let aiCommandInProgressInUI = false;

function initializeCommandInterface() {
  commandInputComponents = createCommandInput();
  
  // Replace or insert the command input in the trigger element
  // Insert after the center button, before the search container
  trigger.insertBefore(commandInputComponents.container, searchContainer);
  
  // Show suggestions on first load (once)
  chrome.storage.local.get({ commandSuggestionsShown: false }, (items) => {
    if (!items.commandSuggestionsShown) {
      setTimeout(() => {
        showCommandSuggestions();
        chrome.storage.local.set({ commandSuggestionsShown: true });
      }, 2000);
    }
  });
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    initializeCommandInterface,
    executeAICommand,
    showToast,
    showConfirmationModal
  };
}
