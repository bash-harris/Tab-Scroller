// ai-tool-handlers.js
// Implementation of AI Tool Call Handlers
// Add this code to background.js after the existing functions

// ===== FILTER ENGINE =====
async function resolveTabsFromFilters(filters, windowId) {
  const allTabs = await chrome.tabs.query({ windowId });
  
  let matchedTabs = allTabs;
  
  // Domain filter
  if (filters.domain) {
    const domain = filters.domain.toLowerCase();
    matchedTabs = matchedTabs.filter(t => safeHost(t.url).includes(domain));
  }
  
  // Title filter
  if (filters.titleContains) {
    const title = filters.titleContains.toLowerCase();
    matchedTabs = matchedTabs.filter(t => (t.title || '').toLowerCase().includes(title));
  }
  
  // URL filter
  if (filters.urlContains) {
    const url = filters.urlContains.toLowerCase();
    matchedTabs = matchedTabs.filter(t => (t.url || '').toLowerCase().includes(url));
  }
  
  // Group filter
  if (filters.groupName) {
    const groupName = filters.groupName.toLowerCase();
    const groups = await chrome.tabGroups.query({ windowId });
    const groupIds = groups
      .filter(g => (g.title || '').toLowerCase().includes(groupName))
      .map(g => g.id);
    matchedTabs = matchedTabs.filter(t => groupIds.includes(t.groupId));
  }
  
  // Inactive time filter
  if (filters.inactiveMinutes) {
    const thresholdMs = filters.inactiveMinutes * 60 * 1000;
    const now = Date.now();
    matchedTabs = matchedTabs.filter(t => {
      const lastActive = tabLastActive.get(t.id) || now;
      return (now - lastActive) >= thresholdMs;
    });
  }
  
  // Audio filter
  if (filters.audible !== undefined) {
    matchedTabs = matchedTabs.filter(t => !!t.audible === filters.audible);
  }
  
  // Pinned filter
  if (filters.pinned !== undefined) {
    matchedTabs = matchedTabs.filter(t => !!t.pinned === filters.pinned);
  }
  
  // Duplicates filter
  if (filters.duplicates) {
    const urlCounts = new Map();
    allTabs.forEach(t => {
      if (t.url) urlCounts.set(t.url, (urlCounts.get(t.url) || 0) + 1);
    });
    matchedTabs = matchedTabs.filter(t => urlCounts.get(t.url) > 1);
  }
  
  // Except active filter
  if (filters.exceptActive !== false) {
    matchedTabs = matchedTabs.filter(t => !t.active);
  }
  
  return matchedTabs;
}

// ===== TOOL HANDLERS =====

async function handleCloseTabs({ filters, confirmation = true }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs matched the criteria" };
  }
  
  // Auto-confirm if less than 3 tabs, otherwise require confirmation
  if (tabs.length >= 3 && confirmation) {
    // Will be handled by content script confirmation modal
    return {
      success: true,
      requiresConfirmation: true,
      tabIds: tabs.map(t => t.id),
      message: `Close ${tabs.length} tabs?`,
      details: tabs.map(t => t.title).slice(0, 5).join(', ') + (tabs.length > 5 ? '...' : '')
    };
  }
  
  const tabIds = tabs.map(t => t.id);
  await chrome.tabs.remove(tabIds);
  
  return { 
    success: true, 
    message: `✅ Closed ${tabs.length} tab${tabs.length > 1 ? 's' : ''}`,
    count: tabs.length 
  };
}

async function handleGroupTabs({ groupName, color = 'blue', filters }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to group" };
  }
  
  if (tabs.length < 2) {
    return { success: false, message: "Need at least 2 tabs to create a group" };
  }
  
  const tabIds = tabs.map(t => t.id);
  
  try {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: groupName, color });
    
    return { 
      success: true, 
      message: `✅ Grouped ${tabs.length} tabs into "${groupName}"`,
      groupId,
      count: tabs.length
    };
  } catch (error) {
    return { success: false, message: `Failed to group tabs: ${error.message}` };
  }
}

async function handleBookmarkTabs({ folderName, filters, closeAfterBookmark = false }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to bookmark" };
  }
  
  // Get or create bookmark folder
  try {
    const tree = await chrome.bookmarks.getTree();
    let folder = await findBookmarkFolderByName(tree, folderName);
    
    if (!folder) {
      folder = await chrome.bookmarks.create({
        parentId: '1', // Bookmarks Bar
        title: folderName
      });
    }
    
    // Create bookmarks
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.bookmarks.create({
          parentId: folder.id,
          title: tab.title || 'Untitled',
          url: tab.url
        });
      }
    }
    
    if (closeAfterBookmark) {
      await chrome.tabs.remove(tabs.map(t => t.id));
      return {
        success: true,
        message: `✅ Bookmarked and closed ${tabs.length} tabs in "${folderName}"`,
        count: tabs.length
      };
    }
    
    return {
      success: true,
      message: `✅ Bookmarked ${tabs.length} tabs to "${folderName}"`,
      count: tabs.length
    };
  } catch (error) {
    return { success: false, message: `Failed to bookmark: ${error.message}` };
  }
}

function findBookmarkFolderByName(nodes, name) {
  const lowerName = name.toLowerCase();
  
  for (const node of nodes) {
    if (!node) continue;
    
    if (!node.url && node.title && node.title.toLowerCase().includes(lowerName)) {
      return node;
    }
    
    if (node.children) {
      const found = findBookmarkFolderByName(node.children, name);
      if (found) return found;
    }
  }
  
  return null;
}

async function handlePinTabs({ action, filters }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to " + action };
  }
  
  const shouldPin = (action === 'pin');
  
  for (const tab of tabs) {
    await chrome.tabs.update(tab.id, { pinned: shouldPin });
  }
  
  return {
    success: true,
    message: `✅ ${shouldPin ? 'Pinned' : 'Unpinned'} ${tabs.length} tabs`,
    count: tabs.length
  };
}

async function handleMuteTabs({ action, filters }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to " + action };
  }
  
  const shouldMute = (action === 'mute');
  
  for (const tab of tabs) {
    await chrome.tabs.update(tab.id, { muted: shouldMute });
  }
  
  return {
    success: true,
    message: `✅ ${shouldMute ? 'Muted' : 'Unmuted'} ${tabs.length} tabs`,
    count: tabs.length
  };
}

async function handleReloadTabs({ filters, bypassCache = false }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to reload" };
  }
  
  for (const tab of tabs) {
    await chrome.tabs.reload(tab.id, { bypassCache });
  }
  
  return {
    success: true,
    message: `✅ Reloaded ${tabs.length} tabs${bypassCache ? ' (cache cleared)' : ''}`,
    count: tabs.length
  };
}

async function handleSortTabs({ sortBy, order = 'asc' }, windowId) {
  let tabs = await chrome.tabs.query({ windowId });
  
  // Sort logic
  tabs.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'domain':
        comparison = safeHost(a.url).localeCompare(safeHost(b.url));
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'lastActive':
        const aTime = tabLastActive.get(a.id) || 0;
        const bTime = tabLastActive.get(b.id) || 0;
        comparison = bTime - aTime; // Most recent first by default
        break;
    }
    
    return order === 'desc' ? -comparison : comparison;
  });
  
  // Move tabs to new positions
  for (let i = 0; i < tabs.length; i++) {
    await chrome.tabs.move(tabs[i].id, { index: i });
  }
  
  return {
    success: true,
    message: `✅ Sorted ${tabs.length} tabs by ${sortBy}`,
    count: tabs.length
  };
}

// Natural language time parser
function parseNaturalTime(timeString) {
  const now = Date.now();
  const lower = timeString.toLowerCase().trim();
  
  // Hours
  if (lower.includes('hour')) {
    const hours = parseInt(lower.match(/(\d+)/)?.[1] || '1');
    return now + (hours * 60 * 60 * 1000);
  }
  
  // Minutes
  if (lower.includes('minute') || lower.includes('min')) {
    const mins = parseInt(lower.match(/(\d+)/)?.[1] || '15');
    return now + (mins * 60 * 1000);
  }
  
  // Tomorrow
  if (lower === 'tomorrow' || lower.includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default 9 AM
    return tomorrow.getTime();
  }
  
  // Next week
  if (lower.includes('next week')) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(9, 0, 0, 0);
    return nextWeek.getTime();
  }
  
  // Default: 1 hour from now
  return now + (60 * 60 * 1000);
}

async function handleSnoozeTabs({ filters, wakeTime }, windowId) {
  const tabs = await resolveTabsFromFilters(filters, windowId);
  
  if (tabs.length === 0) {
    return { success: false, message: "No tabs to snooze" };
  }
  
  const wakeTimestamp = parseNaturalTime(wakeTime);
  const delayMs = wakeTimestamp - Date.now();
  
  // Use existing snooze infrastructure
  for (const tab of tabs) {
    const wakeTime = Date.now() + delayMs;
    const snoozedTabs = await new Promise((resolve) => {
      chrome.storage.local.get({ snoozedTabs: [] }, (items) => resolve(items.snoozedTabs));
    });
    
    snoozedTabs.push({
      url: tab.url,
      title: tab.title,
      wakeTime: wakeTime
    });
    
    await chrome.storage.local.set({ snoozedTabs });
    await chrome.tabs.remove(tab.id);
  }
  
  const wakeDate = new Date(wakeTimestamp);
  return {
    success: true,
    message: `✅ Snoozed ${tabs.length} tabs until ${wakeDate.toLocaleString()}`,
    count: tabs.length,
    wakeTime: wakeTimestamp
  };
}

async function handleSearchAndSwitch({ query }, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  
  // Use existing localTabScore function
  const ranked = tabs
    .map((t) => ({ tab: t, score: localTabScore(query, t) }))
    .sort((a, b) => b.score - a.score);
  
  const best = ranked[0];
  
  if (!best || best.score === 0) {
    return { success: false, message: `No tabs found matching "${query}"` };
  }
  
  await chrome.tabs.update(best.tab.id, { active: true });
  
  return {
    success: true,
    message: `✅ Switched to "${best.tab.title}"`,
    tabId: best.tab.id
  };
}

async function handleAnalyzeTabs({ analysisType }, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  
  let analysis = {};
  
  switch (analysisType) {
    case 'summary':
      const domains = new Map();
      tabs.forEach(t => {
        const host = safeHost(t.url);
        if (host) domains.set(host, (domains.get(host) || 0) + 1);
      });
      
      analysis = {
        totalTabs: tabs.length,
        pinnedTabs: tabs.filter(t => t.pinned).length,
        groupedTabs: tabs.filter(t => t.groupId && t.groupId !== -1).length,
        audibleTabs: tabs.filter(t => t.audible).length,
        topDomains: Array.from(domains.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([domain, count]) => `${domain} (${count})`)
      };
      break;
      
    case 'duplicates':
      const urlCounts = new Map();
      tabs.forEach(t => {
        if (t.url) urlCounts.set(t.url, (urlCounts.get(t.url) || 0) + 1);
      });
      const dupes = Array.from(urlCounts.entries())
        .filter(([_, count]) => count > 1);
      
      analysis = {
        duplicateUrls: dupes.length,
        duplicateTabs: dupes.reduce((sum, [_, count]) => sum + count, 0),
        examples: dupes.slice(0, 5).map(([url, count]) => ({
          url: url.substring(0, 60) + '...',
          count
        }))
      };
      break;
      
    case 'inactive_tabs':
      const now = Date.now();
      const inactive = tabs.filter(t => {
        const lastActive = tabLastActive.get(t.id) || now;
        return (now - lastActive) > 60 * 60 * 1000; // 1 hour
      });
      
      analysis = {
        inactiveTabs: inactive.length,
        examples: inactive.slice(0, 5).map(t => ({
          title: t.title,
          minutesInactive: Math.round((now - (tabLastActive.get(t.id) || now)) / 60000)
        }))
      };
      break;
      
    case 'by_domain':
      const domainGroups = new Map();
      tabs.forEach(t => {
        const host = safeHost(t.url);
        if (!host) return;
        if (!domainGroups.has(host)) domainGroups.set(host, []);
        domainGroups.get(host).push(t.title);
      });
      
      analysis = {
        totalDomains: domainGroups.size,
        domains: Array.from(domainGroups.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 10)
          .map(([domain, titles]) => ({
            domain,
            count: titles.length,
            examples: titles.slice(0, 3)
          }))
      };
      break;
  }
  
  return {
    success: true,
    analysis,
    message: `Analysis complete: ${analysisType}`
  };
}

// ===== MAIN EXECUTOR =====
async function executeToolCall(functionCall, windowId) {
  const { name, args } = functionCall;
  
  console.log(`[ToolCall] Executing: ${name}`, args);
  
  try {
    switch (name) {
      case "close_tabs":
        return await handleCloseTabs(args, windowId);
      
      case "group_tabs":
        return await handleGroupTabs(args, windowId);
      
      case "bookmark_tabs":
        return await handleBookmarkTabs(args, windowId);
      
      case "pin_tabs":
        return await handlePinTabs(args, windowId);
      
      case "mute_tabs":
        return await handleMuteTabs(args, windowId);
      
      case "reload_tabs":
        return await handleReloadTabs(args, windowId);
      
      case "sort_tabs":
        return await handleSortTabs(args, windowId);
      
      case "snooze_tabs":
        return await handleSnoozeTabs(args, windowId);
      
      case "search_and_switch":
        return await handleSearchAndSwitch(args, windowId);
      
      case "analyze_tabs":
        return await handleAnalyzeTabs(args, windowId);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[ToolCall] Error executing ${name}:`, error);
    return { success: false, message: `Error: ${error.message}` };
  }
}

// ===== GEMINI FUNCTION CALLING =====
async function callGeminiWithFunctionCalling(userCommand) {
  const apiKey = await readApiKey();
  if (!apiKey) throw new Error("No API key configured. Please add your Gemini API key in settings.");
  
  const settings = await readAiSettings();
  if (!settings.enableAi) throw new Error("AI features are disabled. Enable them in settings.");
  
  // Import tool schema
  const toolSchema = {
    function_declarations: TOOL_SCHEMA.function_declarations
  };
  
  const body = {
    contents: [{
      parts: [{ text: userCommand }]
    }],
    tools: [toolSchema],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512
    }
  };
  
  const model = settings.aiModel || 'gemini-2.5-flash';
  
  const response = await enqueueAiTask(async () => {
    console.log(`[ToolCalling] Sending command to ${model}:`, userCommand);
    
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    
    if (!res.ok) {
      const errText = await res.text().catch(() => 'no body');
      throw new Error(`HTTP_${res.status}: ${errText}`);
    }
    
    const data = await res.json();
    console.log(`[ToolCalling] Response:`, JSON.stringify(data).substring(0, 300));
    return data;
  }, true); // Priority = true for interactive commands
  
  const functionCall = response?.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  
  if (!functionCall) {
    // If no function call, try to get text response
    const textResponse = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textResponse) {
      return { type: 'text', text: textResponse };
    }
    throw new Error("Could not understand command. Try being more specific, like: 'close all YouTube tabs'");
  }
  
  recordAiCall(model);
  
  return {
    type: 'function',
    functionCall: {
      name: functionCall.name,
      args: functionCall.args || {}
    }
  };
}
