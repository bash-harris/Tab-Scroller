// options.js
const saveOptions = () => {
  const settings = {
    autoScroll: document.getElementById('autoScroll').checked,
    theme: document.getElementById('theme').value,
    displayMode: document.getElementById('displayMode').value,
    collapseDelay: parseInt(document.getElementById('collapseDelay').value, 10) || 1500,
    enableAi: document.getElementById('enableAi').checked,
    enableShield: document.getElementById('enableShield').checked,
    aiModel: document.getElementById('aiModel').value,
    aiFreeTierMode: document.getElementById('aiFreeTierMode').checked,
    aiInsightBatchSize: parseInt(document.getElementById('aiInsightBatchSize').value, 10) || 20,
    aiMaxCandidates: parseInt(document.getElementById('aiMaxCandidates').value, 10) || 60,
    aiMinGapMs: parseInt(document.getElementById('aiMinGapMs').value, 10) || 2000,
    enableAutoFallback: document.getElementById('enableAutoFallback').checked,
    fallbackNotifications: document.getElementById('fallbackNotifications').checked,
    fallbackTier: document.getElementById('fallbackTier').value,
    // ===== NEW: Ollama Settings =====
    useOllama: document.getElementById('useOllama').checked,
    ollamaUrl: document.getElementById('ollamaUrl').value,
    ollamaModel: document.getElementById('ollamaModel').value,
    ollamaTimeout: parseInt(document.getElementById('ollamaTimeout').value, 10) * 1000 || 30000, // Convert to ms
    fallbackToOllama: document.getElementById('fallbackToOllama').checked,
  };
  
  chrome.storage.sync.set(settings, () => {
    const apiKey = document.getElementById('geminiApiKey').value;
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      setTimeout(() => { status.textContent = ''; }, 750);
    });
  });
};

const restoreOptions = () => {
  chrome.storage.sync.get({
    autoScroll: true,
    theme: 'system',
    displayMode: 'auto_hide',
    collapseDelay: 1500,
    enableAi: false,
    enableShield: false,
    aiModel: 'gemini-3.1-flash-lite',
    aiFreeTierMode: true,
    aiInsightBatchSize: 20,
    aiMaxCandidates: 60,
    aiMinGapMs: 2000,
    enableAutoFallback: true,
    fallbackNotifications: true,
    fallbackTier: 'auto',
    // ===== NEW: Ollama Defaults =====
    useOllama: false,
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2:3b',
    ollamaTimeout: 30000,
    fallbackToOllama: true,
  }, (items) => {
    document.getElementById('autoScroll').checked = items.autoScroll;
    document.getElementById('theme').value = items.theme;
    document.getElementById('displayMode').value = items.displayMode;
    document.getElementById('collapseDelay').value = items.collapseDelay;
    document.getElementById('enableAi').checked = items.enableAi;
    document.getElementById('enableShield').checked = items.enableShield;
    document.getElementById('aiModel').value = items.aiModel;
    document.getElementById('aiFreeTierMode').checked = items.aiFreeTierMode;
    document.getElementById('aiInsightBatchSize').value = items.aiInsightBatchSize;
    document.getElementById('aiMaxCandidates').value = items.aiMaxCandidates;
    document.getElementById('aiMinGapMs').value = items.aiMinGapMs;
    document.getElementById('enableAutoFallback').checked = items.enableAutoFallback;
    document.getElementById('fallbackNotifications').checked = items.fallbackNotifications;
    document.getElementById('fallbackTier').value = items.fallbackTier;
    
    // ===== NEW: Restore Ollama Settings =====
    document.getElementById('useOllama').checked = items.useOllama || false;
    document.getElementById('ollamaUrl').value = items.ollamaUrl || 'http://localhost:11434';
    document.getElementById('ollamaModel').value = items.ollamaModel || 'llama3.2:3b';
    document.getElementById('ollamaTimeout').value = Math.round((items.ollamaTimeout || 30000) / 1000); // Convert back to seconds
    document.getElementById('fallbackToOllama').checked = items.fallbackToOllama !== false;

    if (items.useOllama) {
      document.getElementById('ollamaStatus').style.display = 'block';
      document.getElementById('testOllamaBtn')?.click();
    }
    
    loadFallbackStats();
    
    chrome.storage.local.get({ geminiApiKey: '' }, (localItems) => {
      document.getElementById('geminiApiKey').value = localItems.geminiApiKey || '';
    });

    toggleUsageDashboard(items.enableAi);
    if (items.enableAi) refreshUsageDashboard();
  });
};

// --- Usage Dashboard ---
function toggleUsageDashboard(show) {
  document.getElementById('usageDashboard').style.display = show ? 'block' : 'none';
}

function refreshUsageDashboard() {
  chrome.runtime.sendMessage({ type: 'GET_AI_USAGE' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      document.getElementById('usageModels').innerHTML = '<div class="usage-no-data">Unable to fetch usage data. Ensure the extension is loaded.</div>';
      return;
    }

    const { stats, lastCallAt } = response;
    const currentModel = document.getElementById('aiModel').value;

    // Last call timestamp
    const lastCallEl = document.getElementById('usageLastCall');
    if (lastCallAt) {
      const ago = Math.round((Date.now() - lastCallAt) / 1000);
      if (ago < 60) {
        lastCallEl.textContent = `Last API call: ${ago}s ago`;
      } else if (ago < 3600) {
        lastCallEl.textContent = `Last API call: ${Math.round(ago / 60)}m ago`;
      } else {
        lastCallEl.textContent = `Last API call: ${Math.round(ago / 3600)}h ago`;
      }
    } else {
      lastCallEl.textContent = 'No API calls recorded this session';
    }

    // Render model cards
    const container = document.getElementById('usageModels');
    container.innerHTML = '';

    for (const [model, data] of Object.entries(stats)) {
      const card = document.createElement('div');
      card.className = 'usage-model';

      const isActive = model === currentModel;
      const hasUsage = data.callsToday > 0 || data.callsThisMinute > 0;
      
      // Skip models with no usage and not active — keep dashboard clean
      if (!isActive && !hasUsage) continue;

      // Model name row
      const nameRow = document.createElement('div');
      nameRow.className = 'usage-model-name';
      nameRow.innerHTML = `<span>${model}</span>${isActive ? '<span class="active-badge">ACTIVE</span>' : ''}`;
      card.appendChild(nameRow);

      // Bars container
      const bars = document.createElement('div');
      bars.className = 'usage-bars';

      // RPM bar
      bars.appendChild(makeUsageBar(
        'RPM',
        data.callsThisMinute,
        data.limitRpm
      ));

      // RPD bar
      bars.appendChild(makeUsageBar(
        'RPD',
        data.callsToday,
        data.limitRpd
      ));

      card.appendChild(bars);
      container.appendChild(card);
    }

    if (container.children.length === 0) {
      container.innerHTML = '<div class="usage-no-data">No API usage yet. Make an AI call to see stats here.</div>';
    }
  });
}

function makeUsageBar(label, used, limit) {
  const group = document.createElement('div');
  group.className = 'usage-bar-group';

  const labelRow = document.createElement('div');
  labelRow.className = 'usage-bar-label';
  
  const limitText = limit === null ? '∞' : limit.toLocaleString();
  labelRow.innerHTML = `<span>${label}</span><span>${used.toLocaleString()} / ${limitText}</span>`;
  group.appendChild(labelRow);

  const track = document.createElement('div');
  track.className = 'usage-bar-track';
  
  const fill = document.createElement('div');
  fill.className = 'usage-bar-fill';
  
  let pct = 0;
  if (limit === null) {
    // Unlimited — show tiny bar if any usage, otherwise empty
    pct = used > 0 ? Math.min(10, used) : 0;
  } else if (limit > 0) {
    pct = Math.min(100, (used / limit) * 100);
  }
  
  fill.style.width = `${pct}%`;
  
  if (pct >= 80) fill.classList.add('red');
  else if (pct >= 50) fill.classList.add('yellow');
  else fill.classList.add('green');
  
  track.appendChild(fill);
  group.appendChild(track);
  return group;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('autoScroll').addEventListener('change', saveOptions);
document.getElementById('theme').addEventListener('change', saveOptions);
document.getElementById('displayMode').addEventListener('change', saveOptions);
document.getElementById('collapseDelay').addEventListener('change', saveOptions);
document.getElementById('enableAi').addEventListener('change', () => {
  saveOptions();
  const enabled = document.getElementById('enableAi').checked;
  toggleUsageDashboard(enabled);
  if (enabled) refreshUsageDashboard();
});
document.getElementById('geminiApiKey').addEventListener('change', saveOptions);
document.getElementById('enableShield').addEventListener('change', saveOptions);
document.getElementById('aiModel').addEventListener('change', () => {
  saveOptions();
  refreshUsageDashboard();
});
document.getElementById('aiFreeTierMode').addEventListener('change', saveOptions);
document.getElementById('aiInsightBatchSize').addEventListener('change', saveOptions);
document.getElementById('aiMaxCandidates').addEventListener('change', saveOptions);
document.getElementById('aiMinGapMs').addEventListener('change', saveOptions);
document.getElementById('usageRefreshBtn').addEventListener('click', refreshUsageDashboard);

document.getElementById('enableAutoFallback').addEventListener('change', saveOptions);
document.getElementById('fallbackNotifications').addEventListener('change', saveOptions);
document.getElementById('fallbackTier').addEventListener('change', saveOptions);

const refreshFallbackBtn = document.getElementById('refreshFallbackStats');
if (refreshFallbackBtn) {
  refreshFallbackBtn.addEventListener('click', () => {
    refreshFallbackBtn.textContent = '⏳ Refreshing...';
    loadFallbackStats();
    setTimeout(() => { refreshFallbackBtn.textContent = '🔄 Refresh Status'; }, 1000);
  });
}
setInterval(loadFallbackStats, 30000);

function addModelTooltips() {
  const modelSelect = document.getElementById('aiModel');
  if (!modelSelect) return;
  modelSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    const modelInfo = {
      'gemini-3.1-flash-lite': '15 RPM, 500 RPD - Best balance of speed and quota',
      'gemini-2.5-pro': 'Unlimited RPM/RPD - Slowest but most capable',
      'gemma-3-27b': '30 RPM, 14.4K RPD - Highest daily quota',
      'gemini-2.5-flash': '5 RPM, 20 RPD - Fast but low quota'
    };
    const info = modelInfo[selected];
    if (info) console.log(`Model info: ${info}`);
  });
}
document.addEventListener('DOMContentLoaded', addModelTooltips);

function loadFallbackStats() {
  chrome.runtime.sendMessage({ type: 'GET_FALLBACK_STATS' }, (response) => {
    if (!response) return;
    const { stats, currentModel, cooldowns } = response;
    const activeModelDisplay = document.getElementById('activeModelDisplay');
    if (activeModelDisplay) activeModelDisplay.textContent = currentModel || document.getElementById('aiModel').value || 'Not yet used';
    const fallbackCountDisplay = document.getElementById('fallbackCountDisplay');
    if (fallbackCountDisplay) fallbackCountDisplay.textContent = stats?.today || 0;
    const cooldownList = document.getElementById('cooldownList');
    if (cooldownList && cooldowns && cooldowns.length > 0) {
      const now = Date.now();
      const activeCooldowns = cooldowns.filter(([_, time]) => time > now);
      if (activeCooldowns.length > 0) {
        const cooldownHTML = activeCooldowns.map(([model, time]) => {
          const minutesLeft = Math.ceil((time - now) / 60000);
          return `<div style="padding:4px 0;">⏱️ ${model}: ${minutesLeft} min cooldown</div>`;
        }).join('');
        cooldownList.innerHTML = `<div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);"><div style="font-weight:600; margin-bottom:4px;">Active Cooldowns:</div>${cooldownHTML}</div>`;
      } else {
        cooldownList.innerHTML = '';
      }
    }
  });
}

// ===== NEW: Ollama Event Listeners =====
document.getElementById('useOllama')?.addEventListener('change', saveOptions);
document.getElementById('ollamaUrl')?.addEventListener('change', saveOptions);
document.getElementById('ollamaModel')?.addEventListener('change', saveOptions);
document.getElementById('ollamaTimeout')?.addEventListener('change', saveOptions);
document.getElementById('fallbackToOllama')?.addEventListener('change', saveOptions);

// Add to options.js - Ollama connection test
document.getElementById('testOllamaBtn')?.addEventListener('click', async () => {
  const statusDiv = document.getElementById('ollamaStatus');
  const statusIcon = document.getElementById('ollamaStatusIcon');
  const statusText = document.getElementById('ollamaStatusText');
  const statusDetail = document.getElementById('ollamaStatusDetail');
  const testBtn = document.getElementById('testOllamaBtn');
  
  statusDiv.style.display = 'block';
  statusIcon.textContent = '🔄';
  statusText.textContent = 'Testing connection...';
  statusText.classList.add('pulsing');
  statusDetail.textContent = '';
  testBtn.disabled = true;
  
  const url = document.getElementById('ollamaUrl').value || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    statusText.classList.remove('pulsing');
    statusIcon.textContent = '✅';
    statusText.textContent = 'Connected!';
    statusDetail.textContent = `Found ${models.length} model(s): ${models.map(m => m.name).join(', ') || 'none'}`;
    statusDetail.style.color = '#8ab4f8';
    
    if (models.length === 0) {
      statusDetail.textContent += ' ⚠️ No models installed. Run: ollama pull llama3.2:3b';
      statusDetail.style.color = '#fbbc04';
    }
  } catch (error) {
    statusText.classList.remove('pulsing');
    statusIcon.textContent = '❌';
    statusText.textContent = 'Connection failed';
    statusDetail.textContent = `Error: ${error.message}. Make sure Ollama is running (ollama serve)`;
    statusDetail.style.color = '#ea4335';
  } finally {
    testBtn.disabled = false;
  }
});

// Auto-test when "Use Ollama" is checked
document.getElementById('useOllama')?.addEventListener('change', (e) => {
  if (e.target.checked) {
    document.getElementById('ollamaStatus').style.display = 'block';
    document.getElementById('testOllamaBtn')?.click();
  }
});
