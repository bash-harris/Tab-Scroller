// content.js
// Injects the tab scroller micro-bar into the page using Shadow DOM.

(function () {
  "use strict";

  // Prevent double injection
  if (document.getElementById("tab-scroller-host")) return;

  // --- Create Shadow DOM host ---
  const host = document.createElement("div");
  host.id = "tab-scroller-host";
  const shadow = host.attachShadow({ mode: "closed" });

  // --- Inject CSS ---
  const style = document.createElement("style");
  const cssPromise = fetch(chrome.runtime.getURL("content.css"))
    .then((r) => r.text())
    .then((css) => {
      style.textContent = css;
    });
  shadow.appendChild(style);

  // --- Build DOM ---
  const trigger = document.createElement("div");
  trigger.className = "ts-trigger hidden"; // Start hidden to prevent initial slide-down

  const track = document.createElement("div");
  track.className = "ts-track";
  trigger.appendChild(track);

  // Scroll arrow indicators
  const arrowLeft = document.createElement("div");
  arrowLeft.className = "ts-arrow ts-arrow-left";
  arrowLeft.textContent = "\u2039"; // ‹
  trigger.appendChild(arrowLeft);

  const arrowRight = document.createElement("div");
  arrowRight.className = "ts-arrow ts-arrow-right";
  arrowRight.textContent = "\u203A"; // ›
  trigger.appendChild(arrowRight);

  // --- Release Phase 1: Center Button ---
  const centerBtn = document.createElement("div");
  centerBtn.className = "ts-center-btn";
  centerBtn.title = "Center on active tab";
  centerBtn.tabIndex = 0;
  centerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    scrollActiveTabIntoView(true);
  });
  centerBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      scrollActiveTabIntoView(true);
    }
  });
  trigger.insertBefore(centerBtn, track);

  // --- Release Phase 2: Search Input ---
  const searchContainer = document.createElement("div");
  searchContainer.className = "ts-search-container";
  
  const searchIcon = document.createElement("span");
  searchIcon.textContent = "🔍";
  searchIcon.style.fontSize = "12px";
  searchIcon.style.marginRight = "4px";
  searchContainer.appendChild(searchIcon);

  const searchInput = document.createElement("input");
  searchInput.className = "ts-search-input";
  searchInput.placeholder = "Search tabs...";
  searchInput.spellcheck = false;
  searchContainer.appendChild(searchInput);

  trigger.insertBefore(searchContainer, track);

  const magicBtn = document.createElement("div");
  magicBtn.className = "ts-magic-btn";
  magicBtn.title = "AI Smart Group";
  magicBtn.textContent = "🪄";
  magicBtn.tabIndex = 0;
  magicBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    safeSendMessage({ type: "AI_SMART_GROUP" });
  });
  magicBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      safeSendMessage({ type: "AI_SMART_GROUP" });
    }
  });
  trigger.insertBefore(magicBtn, track);

  const sortSelect = document.createElement("select");
  sortSelect.className = "ts-sort-select";
  sortSelect.title = "Sort order";
  [
    { v: 'default', t: 'Default' },
    { v: 'domain', t: 'By Domain' },
    { v: 'title', t: 'By Title' }
  ].forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.v;
    o.textContent = opt.t;
    sortSelect.appendChild(o);
  });
  sortSelect.addEventListener("change", (e) => {
    currentSortMode = e.target.value;
    render();
  });
  trigger.insertBefore(sortSelect, magicBtn);
  
  const cleanupBtn = document.createElement("div");
  cleanupBtn.className = "ts-cleanup-btn";
  cleanupBtn.title = "Purge duplicate tabs";
  cleanupBtn.textContent = "🧹";
  cleanupBtn.tabIndex = 0;
  cleanupBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    performPurgeAnimation();
    setTimeout(() => {
      safeSendMessage({ type: "PURGE_DUPLICATES" });
    }, 400); // Wait for animation
  });
  cleanupBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      performPurgeAnimation();
      setTimeout(() => {
        safeSendMessage({ type: "PURGE_DUPLICATES" });
      }, 400);
    }
  });
  const declutterBtn = document.createElement("div");
  declutterBtn.className = "ts-declutter-btn";
  declutterBtn.title = "AI Declutter";
  declutterBtn.textContent = "✨";
  declutterBtn.tabIndex = 0;
  declutterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    safeSendMessage({ type: "AI_DECLUTTER" });
  });
  declutterBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      safeSendMessage({ type: "AI_DECLUTTER" });
    }
  });
  trigger.insertBefore(declutterBtn, searchContainer);

  const shieldBtn = document.createElement("div");
  shieldBtn.className = "ts-shield-btn";
  shieldBtn.title = "AI Privacy Shield";
  shieldBtn.textContent = "🛡️";
  shieldBtn.tabIndex = 0;
  shieldBtn.style.display = "none"; // Hidden by default, toggled by setting
  shieldBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    safeSendMessage({ type: "SHIELD_ACTIVATE" });
  });
  shieldBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      safeSendMessage({ type: "SHIELD_ACTIVATE" });
    }
  });
  trigger.insertBefore(shieldBtn, searchContainer);

  // Sync Shield visibility from settings
  chrome.storage.sync.get({ enableShield: false }, (items) => {
    shieldBtn.style.display = items.enableShield ? '' : 'none';
  });

  const bookmarkBtn = document.createElement("div");
  bookmarkBtn.className = "ts-bookmark-btn";
  bookmarkBtn.title = "Open Bookmark Organizer";
  bookmarkBtn.textContent = "🔖";
  bookmarkBtn.tabIndex = 0;
  bookmarkBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    safeSendMessage({ type: "OPEN_BOOKMARK_MANAGER" });
  });
  bookmarkBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      safeSendMessage({ type: "OPEN_BOOKMARK_MANAGER" });
    }
  });

  trigger.insertBefore(bookmarkBtn, searchContainer);

  // ===== UNDO BUTTON =====
  const undoBtn = document.createElement("div");
  undoBtn.className = "ts-undo-btn";
  undoBtn.title = "Undo last action";
  undoBtn.textContent = "↩️";
  undoBtn.tabIndex = 0;
  undoBtn.style.display = "none"; // Hidden until an undoable action occurs
  undoBtn.style.cssText += `
    cursor: pointer; font-size: 14px; padding: 2px 6px;
    border-radius: 6px; transition: all 0.2s ease;
    opacity: 0.8; min-width: 20px; text-align: center;
  `;
  undoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    safeSendMessage({ type: "UNDO_LAST_ACTION" }, (response) => {
      if (response && response.success) {
        showToast(response.message, "success");
      } else {
        showToast(response?.message || "Nothing to undo", "warning");
      }
      undoBtn.style.display = "none";
    });
  });
  undoBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      undoBtn.click();
    }
  });
  trigger.insertBefore(undoBtn, searchContainer);

  shadow.appendChild(trigger);
  
  // Prevent FOUC: wait for CSS to be fully applied before appending to document
  cssPromise.then(() => {
    document.documentElement.appendChild(host);
  });

  let tabs = [];
  let contextValid = true;
  let suggestedCloseIds = new Set();
  let selectedTabIds = new Set();
  let quarantinedTabIds = new Set();

  // Drag and drop state
  let draggedTabId = null;
  let insertionLine = document.createElement("div");
  insertionLine.className = "insertion-line";
  let scrollInterval = null;

  // Release Phase 1 Settings
  let userSettings = { autoScroll: true, theme: 'system', displayMode: 'auto_hide', collapseDelay: 1500 };

  // Release Phase 2 Search & Nav
  let searchQuery = "";
  let focusedIndex = -1;
  let isSearchActive = false;
  let searchHasFocus = false;

  // Custom Sort (Task 8)
  let currentSortMode = 'default';

  // AI Command Debouncing
  let aiCommandInProgress = false;

  // Release Phase 3 Hover Preview
  let hoverTimeout = null;
  const hoverCard = document.createElement("div");
  hoverCard.className = "ts-hover-card";
  shadow.appendChild(hoverCard);

  // --- Context Menu Setup ---
  const contextMenu = document.createElement("div");
  contextMenu.className = "ts-context-menu";
  shadow.appendChild(contextMenu);

  let activeContextMenuTabId = null;

  function closeContextMenu() {
    contextMenu.classList.remove("visible");
    activeContextMenuTabId = null;
  }

  // Close the menu if clicking anywhere else
  window.addEventListener("click", closeContextMenu);
  window.addEventListener("blur", closeContextMenu);
  track.addEventListener("scroll", closeContextMenu); // Close if user scrolls the ribbon

  contextMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.target.closest(".ts-menu-item");
    if (!item || !activeContextMenuTabId) return;

    const action = item.dataset.action;
    const tabId = activeContextMenuTabId;

    switch (action) {
      case "new_right": safeSendMessage({ type: "NEW_TAB_RIGHT", tabId }); break;
      case "reload": safeSendMessage({ type: "RELOAD_TAB", tabId }); break;
      case "duplicate": safeSendMessage({ type: "DUPLICATE_TAB", tabId }); break;
      case "pin": safeSendMessage({ type: "TOGGLE_PIN", tabId }); break;
      case "mute": safeSendMessage({ type: "TOGGLE_MUTE", tabId }); break;
      case "close": safeSendMessage({ type: "CLOSE_TAB", tabId }); break;
      case "close_other": safeSendMessage({ type: "CLOSE_OTHER_TABS", tabId }); break;
      case "close_right": safeSendMessage({ type: "CLOSE_TABS_RIGHT", tabId }); break;
      case "snooze_1hr":
        console.log('[Snooze UI] Menu clicked. Firing SNOOZE_TAB to background with delay:', 3600000);
        safeSendMessage({ type: "SNOOZE_TAB", tabId, delayMs: 3600000 });
        break;
      case "snooze_tmrw":
        console.log('[Snooze UI] Menu clicked. Firing SNOOZE_TAB to background with delay:', 86400000);
        safeSendMessage({ type: "SNOOZE_TAB", tabId, delayMs: 86400000 });
        break;
    }
    closeContextMenu();
  });
  
  // Hover card click delegation
  hoverCard.addEventListener("click", (e) => {
    const muteBtn = e.target.closest(".ts-hc-mute-btn");
    if (muteBtn) {
      e.stopPropagation();
      const tabId = parseInt(muteBtn.dataset.tabId);
      const isMuted = muteBtn.dataset.muted === "true";
      safeSendMessage({ type: "TOGGLE_MUTE", tabId: tabId });
      // Update local state temporarily for immediate feedback
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        tab.muted = !isMuted;
        showHoverCard(tab, shadow.querySelector(`[data-tab-id="${tabId}"]`));
      }
    }
  });

  // --- Safe messaging (handles extension reload) ---
  function safeSendMessage(msg, callback) {
    try {
      if (!chrome.runtime?.id) {
        contextValid = false;
        showReloadHint();
        return;
      }
      if (callback) {
        // Expects a response — pass callback
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) {
            contextValid = false;
            showReloadHint();
            return;
          }
          callback(response);
        });
      } else {
        // Fire-and-forget (e.g. SWITCH_TAB) — no response expected
        chrome.runtime.sendMessage(msg);
      }
    } catch (e) {
      contextValid = false;
      showReloadHint();
    }
  }

  function showReloadHint() {
    track.innerHTML = "";
    const hint = document.createElement("div");
    hint.style.cssText = "color:#fff;font-size:11px;padding:8px 12px;opacity:0.7;white-space:nowrap;";
    hint.textContent = "⟳ Extension updated — refresh this page";
    track.appendChild(hint);
  }

  // --- Page Push Logic ---
  const PAGE_OFFSET = 36;
  const shiftedElements = new Set();
  let isPagePushed = false;
  
  function updatePageMargin(shown) {
    if (shown === isPagePushed) return;
    isPagePushed = shown;

    document.documentElement.style.setProperty('transition', 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    document.documentElement.style.setProperty('margin-top', shown ? `${PAGE_OFFSET}px` : '3px', 'important');

    if (shown) {
      shiftedElements.clear();
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el === host || host.contains(el)) continue;
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const top = parseFloat(style.top);
          if (!isNaN(top) && top >= 0 && top < 150) {
            el.dataset.tsOrigTop = el.style.top || '';
            el.dataset.tsOrigTransition = el.style.transition || '';
            el.style.setProperty('transition', 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
            el.style.setProperty('top', `${top + PAGE_OFFSET}px`, 'important');
            shiftedElements.add(el);
          }
        }
      }
    } else {
      for (const el of shiftedElements) {
        if (el.dataset.tsOrigTop) el.style.setProperty('top', el.dataset.tsOrigTop, 'important');
        else el.style.removeProperty('top');
        setTimeout(() => {
          if (el.dataset.tsOrigTransition) el.style.setProperty('transition', el.dataset.tsOrigTransition, 'important');
          else el.style.removeProperty('transition');
        }, 300);
      }
      shiftedElements.clear();
    }
  }

  // --- Idle Hide Logic ---
  let hideTimeout;
  
  function showBar() {
    clearTimeout(hideTimeout);
    trigger.classList.remove("hidden");
    updatePageMargin(true);
  }

  function startHideTimer() {
    clearTimeout(hideTimeout);
    if (userSettings.displayMode === 'always_show') return;
    const delay = userSettings.collapseDelay !== undefined ? userSettings.collapseDelay : 1500;
    hideTimeout = setTimeout(() => {
      trigger.classList.add("hidden");
      updatePageMargin(false);
    }, delay);
  }

  trigger.addEventListener("mouseenter", showBar);
  trigger.addEventListener("mousemove", showBar); // Keeps it open if moving inside
  track.addEventListener("wheel", showBar); // Keeps it open if scrolling
  trigger.addEventListener("mouseleave", startHideTimer); // Only hide when mouse leaves
  // Start hidden on page load cleanly; only show when user interacts with top edge
  document.documentElement.style.setProperty('margin-top', '3px', 'important');

  // --- Arrow visibility (Throttled) ---
  let arrowUpdatePending = false;
  function updateArrows() {
    if (arrowUpdatePending) return;
    arrowUpdatePending = true;
    requestAnimationFrame(() => {
      arrowUpdatePending = false;
      const atStart = track.scrollLeft <= 4;
      const atEnd =
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      arrowLeft.classList.toggle("visible", !atStart);
      arrowRight.classList.toggle("visible", !atEnd);
    });
  }

  track.addEventListener("scroll", () => {
    updateArrows();
    scheduleVisibleInsightsPrefetch();
  });

  // --- Drag and Drop Track Events ---
  track.addEventListener("dragenter", (e) => {
    e.preventDefault();
  });

  track.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedTabId) return;
    
    e.dataTransfer.dropEffect = "move";

    // Auto-scroll logic
    const rect = track.getBoundingClientRect();
    const scrollThreshold = 30;
    const scrollSpeed = 5;

    clearInterval(scrollInterval);
    if (e.clientX < rect.left + scrollThreshold) {
      scrollInterval = setInterval(() => track.scrollLeft -= scrollSpeed, 16);
    } else if (e.clientX > rect.right - scrollThreshold) {
      scrollInterval = setInterval(() => track.scrollLeft += scrollSpeed, 16);
    } else {
      scrollInterval = null;
    }

    // Insertion line logic
    const domTabs = Array.from(track.querySelectorAll('.ts-tab:not(.dragging)'));
    let insertBeforeEl = null;

    for (const tabEl of domTabs) {
      const elRect = tabEl.getBoundingClientRect();
      if (e.clientX < elRect.left + elRect.width / 2) {
        insertBeforeEl = tabEl;
        break;
      }
    }

    if (insertBeforeEl) {
      insertBeforeEl.parentNode.insertBefore(insertionLine, insertBeforeEl);
    } else {
      track.appendChild(insertionLine);
    }
  });

  track.addEventListener("dragleave", (e) => {
    if (!track.contains(e.relatedTarget)) {
      if (insertionLine.parentNode) insertionLine.remove();
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
  });

  track.addEventListener("drop", (e) => {
    e.preventDefault();
    clearInterval(scrollInterval);
    scrollInterval = null;

    if (!draggedTabId) {
      if (insertionLine.parentNode) insertionLine.remove();
      return;
    }

    // Calculate new index based on insertionLine position before removing it
    const domChildren = Array.from(track.querySelectorAll('.ts-tab:not(.dragging), .insertion-line'));
    const dropIndex = domChildren.indexOf(insertionLine);

    if (insertionLine.parentNode) insertionLine.remove();
    if (dropIndex === -1) return;

    const originalIndex = tabs.findIndex(t => t.id === draggedTabId);
    if (originalIndex === -1) return;

    // Optimistic UI updates
    const [tabToMove] = tabs.splice(originalIndex, 1);

    // Adjust target index based on array modification
    let targetIndex = dropIndex;
    if (originalIndex < dropIndex) targetIndex--;
    // TargetIndex here is within the tab scroller's DOM list, which maps closely to Chrome's tab index
    // if we consider this covers all tabs in window.
    // background.js uses the absolute tab indexes. Assuming tab scroller shows all tabs in sequence.
    tabs.splice(targetIndex, 0, tabToMove);
    render();

    // Map the relative DOM index to the absolute chrome tab index
    // If targetIndex is the end of the list, use the last tab's index + 1
    // Actually, background.js requires native chrome tab index.
    // The tab scroller array `tabs` is ordered exactly like chrome tabs in the window.
    // Since we just updated `tabs` optimistically, `targetIndex` is the new position.
    
    // We must pass the new absolute index. If we are dragging past other tabs, 
    // we want it to literally take `targetIndex` within the window's tabs.
    // Because the tab cache is sorted by `index`.
    
    const absNewIndex = targetIndex; 

    safeSendMessage({ type: "MOVE_TAB", tabId: draggedTabId, toIndex: absNewIndex });
  });

  // --- Lazy Loading Observer ---
  const iconObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
          iconObserver.unobserve(img);
        }
      });
    },
    { root: track, rootMargin: "20px" }
  );

  // --- Search Filtering ---
  function fuzzyMatch(query, text) {
    if (!query) return true;
    if (!text) return false;
    const t = text.toLowerCase();
    let qIdx = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === query[qIdx]) {
        qIdx++;
        if (qIdx === query.length) return true;
      }
    }
    return false;
  }

  function isTabMatch(tab, query) {
    if (!query) return true;
    return (
      fuzzyMatch(query, tab.title) ||
      (tab.url && fuzzyMatch(query, tab.url)) ||
      (tab.groupTitle && fuzzyMatch(query, tab.groupTitle))
    );
  }

  // --- Render (Surgical DOM Updates) ---
  function render() {
    const visibleItems = []; // { type: 'header'|'tab', data: group|tab }
    let lastGroupId = -1;

    let tabsToRender = [...tabs];

    if (currentSortMode === 'domain') {
      tabsToRender.sort((a, b) => {
        const getHost = (url) => {
          try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
          catch(e) { return ''; }
        };
        return getHost(a.url).localeCompare(getHost(b.url));
      });
    } else if (currentSortMode === 'title') {
      tabsToRender.sort((a, b) => (a.title || "").toLowerCase().localeCompare((b.title || "").toLowerCase()));
    }

    tabsToRender.forEach((tab) => {
      const gId = (tab.groupId !== undefined && tab.groupId !== -1) ? tab.groupId : -1;
      
      // If start of a new group (Only show groups in default sort mode)
      if (currentSortMode === 'default' && gId !== -1 && gId !== lastGroupId) {
        visibleItems.push({
          type: "header",
          id: `group-${gId}`,
          groupId: gId,
          title: tab.groupTitle || "Unnamed Group",
          color: tab.groupColor || "grey",
          collapsed: !!tab.groupCollapsed,
        });
      }

      // Show tab if not collapsed OR if in custom sort mode (where we ignore groups)
      if (currentSortMode !== 'default' || !tab.groupCollapsed) {
        visibleItems.push({ type: "tab", id: tab.id.toString(), tab: tab });
      }

      lastGroupId = gId;
    });

    // 2. Fast lookup for items in track
    const currentItemIds = new Set(visibleItems.map((item) => item.id));

    // 3. Remove obsolete DOM elements (tabs or headers)
    Array.from(track.children).forEach((el) => {
      if (!currentItemIds.has(el.dataset.id)) {
        el.remove();
      }
    });

    // 4. Update or create elements in correct order
    visibleItems.forEach((item, index) => {
      let el = track.querySelector(`[data-id="${item.id}"]`);

      if (!el) {
        if (item.type === "header") {
          el = document.createElement("div");
          el.className = `ts-group-header ts-group-${item.color}`;
          el.dataset.id = item.id;
          el.textContent = item.title;
          el.tabIndex = 0;
          const toggleGroup = () => {
            safeSendMessage({
              type: "TOGGLE_GROUP",
              groupId: item.groupId,
              collapsed: !item.collapsed,
            });
          };
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleGroup();
          });
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              toggleGroup();
            }
          });
        } else {
          // Tab Creation (refactored from previous version)
          el = createTabElement(item.tab);
        }
      }

      // Update state for existing elements
      if (item.type === "header") {
        el.className = `ts-group-header ts-group-${item.color}`;
        el.classList.toggle("collapsed", item.collapsed);
        if (el.textContent !== item.title) el.textContent = item.title;
      } else {
        updateTabElement(el, item.tab);
      }

      // Ensure correct DOM order
      if (track.children[index] !== el) {
        track.insertBefore(el, track.children[index]);
      }
    });

    scrollActiveTabIntoView();
    updateArrows();
    scheduleVisibleInsightsPrefetch();
  }

  function createTabElement(tab) {
    const tabIdStr = tab.id.toString();
    const el = document.createElement("div");
    el.className = "ts-tab";
    el.dataset.tabId = tabIdStr;
    el.dataset.id = tabIdStr; // For unified management
    el.draggable = true;
    el.tabIndex = 0;

    el.addEventListener("dragstart", (e) => {
      draggedTabId = tab.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabIdStr);
      requestAnimationFrame(() => el.classList.add("dragging"));
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      draggedTabId = null;
      if (insertionLine.parentNode) insertionLine.remove();
      clearInterval(scrollInterval);
      scrollInterval = null;
    });

    // Group Color Bar
    const groupBar = document.createElement("div");
    groupBar.className = "ts-tab-group-bar";
    el.appendChild(groupBar);

    const audioIndicator = document.createElement("div");
    audioIndicator.className = "ts-tab-audio-indicator";
    audioIndicator.title = "Click to mute/unmute";
    audioIndicator.style.cursor = "pointer";
    audioIndicator.addEventListener("click", (e) => {
      e.stopPropagation();
      const tabId = parseInt(tab.id);
      safeSendMessage({ type: "TOGGLE_MUTE", tabId: tabId });
      // Optimistic state update
      tab.muted = !tab.muted;
      updateTabElement(el, tab);
    });
    el.appendChild(audioIndicator);

    if (tab.favIconUrl) {
      const img = document.createElement("img");
      img.dataset.src = tab.favIconUrl;
      img.alt = "";
      img.onerror = () => img.replaceWith(makeFallback(tab));
      el.appendChild(img);
      iconObserver.observe(img);
    } else {
      el.appendChild(makeFallback(tab));
    }

    const tooltip = document.createElement("div");
    tooltip.className = "ts-tooltip";
    el.appendChild(tooltip);

    const closeBtn = document.createElement("div");
    closeBtn.className = "ts-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      safeSendMessage({ type: "CLOSE_TAB", tabId: tab.id });
      hideHoverCard();
    });
    el.appendChild(closeBtn);

    // Hover Preview Logic
    el.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        const hoveredId = tab.id;
        const neighborIds = tabs
          .map((t) => t.id)
          .filter((id) => Math.abs(tabs.findIndex((x) => x.id === id) - tabs.findIndex((x) => x.id === hoveredId)) <= 4)
          .slice(0, 9);

        safeSendMessage({ type: 'PREFETCH_TAB_INSIGHTS', tabIds: neighborIds }, () => {
          showHoverCard(tab, el);
        });
      }, 250);
    });

    el.addEventListener("mouseleave", () => {
      clearTimeout(hoverTimeout);
      hideHoverCard();
    });

    el.addEventListener("click", (e) => {
      e.stopPropagation();

      if (quarantinedTabIds.has(tab.id)) {
        if (!confirm("This tab looks suspicious. Are you sure you want to switch to it?")) {
          return;
        }
        quarantinedTabIds.delete(tab.id);
        el.classList.remove("quarantined");
      }

      if (e.shiftKey) {
        if (selectedTabIds.has(tab.id)) {
          selectedTabIds.delete(tab.id);
        } else {
          selectedTabIds.add(tab.id);
        }
        
        if (selectedTabIds.size > 1) {
          searchInput.placeholder = "Ask AI to extract data...";
        } else {
          searchInput.placeholder = "Search tabs...";
        }
        render(); // Update selected class on all tabs
        return;
      }
      
      // Create ripple element
      const ripple = document.createElement("span");
      ripple.className = "ts-ripple";
      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);

      safeSendMessage({ type: "SWITCH_TAB", tabId: tab.id });
      hideHoverCard();
      selectedTabIds.clear();
      searchInput.placeholder = "Search tabs...";
      render();
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        safeSendMessage({ type: "SWITCH_TAB", tabId: tab.id });
        hideHoverCard();
      }
    });

    el.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        e.stopPropagation();
        safeSendMessage({ type: "CLOSE_TAB", tabId: tab.id });
      }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Keep existing logic to unflag suggested close tabs
      if (suggestedCloseIds.has(tab.id)) {
        suggestedCloseIds.delete(tab.id);
        el.classList.remove("suggested-close");
      }

      activeContextMenuTabId = tab.id;

      // Populate menu matching standard Chrome options
      contextMenu.innerHTML = `
        <div class="ts-menu-item" data-action="new_right">New tab to the right</div>
        <div class="ts-menu-divider"></div>
        <div class="ts-menu-item" data-action="reload">
          Reload <span class="ts-menu-shortcut">Ctrl+R</span>
        </div>
        <div class="ts-menu-item" data-action="duplicate">Duplicate</div>
        <div class="ts-menu-item" data-action="pin">${tab.pinned ? 'Unpin' : 'Pin'}</div>
        <div class="ts-menu-item" data-action="mute">${tab.muted ? 'Unmute site' : 'Mute site'}</div>
        <div class="ts-menu-divider"></div>
        <div class="ts-menu-item" data-action="close">
          Close <span class="ts-menu-shortcut">Ctrl+W</span>
        </div>
        <div class="ts-menu-item" data-action="close_other">Close other tabs</div>
        <div class="ts-menu-item" data-action="close_right">Close tabs to the right</div>
        <div class="ts-menu-divider"></div>
        <div class="ts-menu-item" data-action="snooze_1hr" style="color: var(--ts-accent)">Snooze for 1 hour</div>
        <div class="ts-menu-item" data-action="snooze_tmrw" style="color: var(--ts-accent)">Snooze until tomorrow</div>
      `;

      // Position the menu at the cursor
      let x = e.clientX;
      let y = e.clientY;

      // Ensure it doesn't clip off the screen
      contextMenu.classList.add("visible");
      const menuRect = contextMenu.getBoundingClientRect();
      
      if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 5;
      }
      if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 5;
      }

      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
    });

    return el;
  }

  function updateTabElement(el, tab) {
    el.classList.toggle("active", tab.active);
    el.draggable = (currentSortMode === 'default');
    el.style.cursor = el.draggable ? 'pointer' : 'default';
    el.classList.toggle("discarded", !!tab.discarded);
    el.classList.toggle("selected", selectedTabIds.has(tab.id));

    // Group bar update
    const groupBar = el.querySelector(".ts-tab-group-bar");
    const gId = (tab.groupId !== undefined && tab.groupId !== -1) ? tab.groupId : -1;
    if (gId !== -1) {
      groupBar.className = `ts-tab-group-bar ${tab.groupColor || "grey"}`;
      groupBar.style.display = "block";
    } else {
      groupBar.style.display = "none";
    }

    el.classList.toggle("suggested-close", suggestedCloseIds.has(tab.id));
    el.classList.toggle("quarantined", quarantinedTabIds.has(tab.id));

    // Search & Focus states
    const isMatch = isTabMatch(tab, searchQuery);
    el.classList.toggle("search-dimmed", !isMatch);

    const filteredTabs = tabs.filter((t) => isTabMatch(t, searchQuery));
    const isFocused =
      focusedIndex !== -1 && filteredTabs[focusedIndex]?.id === tab.id;
    el.classList.toggle("focused", isFocused);

    // Update tooltip title
    const tooltip = el.querySelector(".ts-tooltip");
    const fullTitle = tab.groupTitle
      ? `[${tab.groupTitle}] ${tab.title || "Untitled"}`
      : tab.title || "Untitled";
    if (tooltip && tooltip.textContent !== fullTitle) {
      tooltip.textContent = fullTitle;
    }

    // Audio Indicator
    const audioInd = el.querySelector(".ts-tab-audio-indicator");
    if (audioInd) {
      audioInd.style.display = (tab.audible || tab.muted) ? "block" : "none";
      audioInd.innerHTML = tab.muted ? "🔇" : "🔊";
      audioInd.classList.toggle("muted", tab.muted);
    }

    // Update favicon safely
    const currentMedia = el.querySelector("img, .ts-fallback");
    if (tab.favIconUrl) {
      if (
        !currentMedia ||
        currentMedia.tagName !== "IMG" ||
        (currentMedia.dataset.src !== tab.favIconUrl &&
          currentMedia.src !== tab.favIconUrl)
      ) {
        const newImg = document.createElement("img");
        newImg.dataset.src = tab.favIconUrl;
        newImg.alt = "";
        newImg.onerror = () => newImg.replaceWith(makeFallback(tab.title));
        if (currentMedia) currentMedia.replaceWith(newImg);
        else el.insertBefore(newImg, tooltip);
        iconObserver.observe(newImg);
      }
    } else {
      const fallbackContent = tab.emoji ? tab.emoji : (tab.title || "?")[0].toUpperCase();
      if (!currentMedia || currentMedia.tagName !== "DIV" || currentMedia.textContent !== fallbackContent) {
        const newFallback = makeFallback(tab);
        if (currentMedia) currentMedia.replaceWith(newFallback);
        else el.insertBefore(newFallback, tooltip);
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") updateSettings(changes);
  });

  // --- Release Phase 2 Search & Nav Logic ---
  function startSearch() {
    isSearchActive = true;
    searchContainer.classList.add("active");
    searchInput.focus();
    focusedIndex = -1;
    render();
  }

  function stopSearch() {
    isSearchActive = false;
    searchQuery = "";
    searchInput.value = "";
    searchContainer.classList.remove("active");
    searchInput.blur();
    focusedIndex = -1;
    render();
  }

  searchInput.addEventListener("focus", () => { searchHasFocus = true; });
  searchInput.addEventListener("blur", () => { searchHasFocus = false; });

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase();
    focusedIndex = -1; // Reset focus on search change
    render();
    
    // Auto-scroll to first match
    if (searchQuery) {
      const firstMatchIndex = tabs.findIndex(t => isTabMatch(t, searchQuery));
      if (firstMatchIndex !== -1) {
        scrollActiveTabIntoView(true, firstMatchIndex);
      }
    }
  });

  function handleKeyDown(e) {
    const isVisible = !trigger.classList.contains("hidden");

    // Ctrl+K to search (Visibility gated)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (isVisible) {
        e.preventDefault();
        startSearch();
      }
      return;
    }

    if (!isVisible) return;

    // Esc to close
    if (e.key === "Escape") {
      if (isSearchActive) {
        stopSearch();
      } else if (userSettings.displayMode !== 'always_show') {
        trigger.classList.add("hidden");
        updatePageMargin(false);
      }
      return;
    }

    // Keyboard Nav (don't interfere if typing in search UNLESS it's arrows/enter)
    const navigating = ["ArrowLeft", "ArrowRight", "Enter", "Delete", "Backspace"].includes(e.key);
    if (!navigating && isSearchActive) return;

    // AI commands must be checked BEFORE filteredTabs guard — when user types
    // "> query", no tabs match the ">" character, causing early return otherwise.
    if (e.key === "Enter" && searchHasFocus) {
      if (searchInput.value.length > 0) {
        e.preventDefault();
 
        const commandText = searchInput.value.trim();
                
        // Clear input and disable BEFORE sending to prevent repeat fires
        searchInput.value = "";
        searchInput.disabled = true;

        safeSendMessage({ type: "AI_COMMAND", command: commandText }, (response) => {
          aiCommandInProgress = false; // Clear flag when done
          searchInput.disabled = false; // Re-enable
          searchInput.focus();

          if (response && response.awaitingConfirmation) {
            // Confirmation modal will be handled by CONFIRM_TOOL_CALL message
            // Wait for user to confirm or cancel
            return;
          }

          if (response && response.success) {
            if (typeof showToast !== 'undefined') showToast(response.message, "success");
          } else {
            if (typeof showToast !== 'undefined') showToast(response?.message || "Error", "error");
          }
        });
        return;
      }
      if (selectedTabIds.size > 1) {
        e.preventDefault();
        safeSendMessage({ type: "AI_EXTRACT", query: searchInput.value, tabIds: Array.from(selectedTabIds) });
        searchInput.value = "";
        searchInput.placeholder = "⏳ Extracting...";
        searchInput.disabled = true;
        setTimeout(() => { searchInput.disabled = false; searchInput.placeholder = "Search tabs..."; }, 8000);
        return;
      }
    }

    const filteredTabs = tabs.filter(t => isTabMatch(t, searchQuery));

    if (filteredTabs.length === 0) return;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusedIndex = (focusedIndex + 1) % filteredTabs.length;
      render();
      scrollActiveTabIntoView(true, tabs.indexOf(filteredTabs[focusedIndex]));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusedIndex = (focusedIndex - 1 + filteredTabs.length) % filteredTabs.length;
      render();
      scrollActiveTabIntoView(true, tabs.indexOf(filteredTabs[focusedIndex]));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex !== -1) {
        safeSendMessage({ type: "SWITCH_TAB", tabId: filteredTabs[focusedIndex].id });
        if (isSearchActive) stopSearch();
      }
    } else if (e.key === "Delete" || (e.altKey && e.key === "Backspace")) {
      e.preventDefault();
      if (focusedIndex !== -1) {
        const tabToClose = filteredTabs[focusedIndex];
        safeSendMessage({ type: "CLOSE_TAB", tabId: tabToClose.id });
        focusedIndex = Math.min(focusedIndex, filteredTabs.length - 2);
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown, true);

  function scrollActiveTabIntoView(force = false, specificIndex = -1) {
    if (!force && !userSettings.autoScroll) return;
    
    let targetEl;
    if (specificIndex !== -1) {
      const tabId = tabs[specificIndex]?.id;
      targetEl = track.querySelector(`.ts-tab[data-tab-id="${tabId}"]`);
    } else {
      targetEl = track.querySelector(".ts-tab.active");
    }

    if (targetEl) {
      targetEl.scrollIntoView({
        inline: "center",
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  function showHoverCard(tab, el) {
    hoverCard.dataset.currentTabId = tab.id.toString();
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const barRect = trigger.getBoundingClientRect();
    
    // Position below the bar (bar is at the top)
    const topPosition = barRect.bottom + 10; 

    const showMute = tab.audible || tab.muted;
    const muteIcon = tab.muted ? "🔇" : "🔊";
    const muteText = tab.muted ? "Unmute Tab" : "Mute Tab";

    // Initial render without thumbnail (unless we already have it temporarily)
    hoverCard.innerHTML = `
      <div class="ts-hc-title">${tab.title || "Untitled"}</div>
      <div class="ts-hc-url">${tab.url ? tab.url.replace(/^https?:\/\//, "").split("/")[0] : ""}</div>
      ${tab.groupTitle ? `<div class="ts-hc-group" style="color: var(--ts-accent)">${tab.groupTitle}</div>` : ""}
      ${showMute ? `
        <div class="ts-hc-mute-container">
          <button class="ts-hc-mute-btn" data-tab-id="${tab.id}" data-muted="${tab.muted}">
            <span class="ts-hc-mute-icon">${muteIcon}</span>
            <span class="ts-hc-mute-text">${muteText}</span>
          </button>
        </div>
      ` : ""}
    `;

    // Fetch thumbnail on-demand
    safeSendMessage({ type: "GET_THUMBNAIL", tabId: tab.id }, (response) => {
      if (response && response.dataUrl && hoverCard.dataset.currentTabId === tab.id.toString()) {
        const img = document.createElement("img");
        img.className = "ts-hc-thumbnail";
        img.src = response.dataUrl;
        hoverCard.prepend(img);
      }
    });

    safeSendMessage({ type: "GET_AI_SUMMARY", tabId: tab.id }, (response) => {
      if (response && response.summary && hoverCard.dataset.currentTabId === tab.id.toString()) {
        const summaryDiv = document.createElement("div");
        summaryDiv.className = "ts-hc-ai-summary";
        summaryDiv.textContent = response.summary;
        hoverCard.appendChild(summaryDiv);
      }
    });
    
    hoverCard.style.left = `${centerX}px`;
    hoverCard.style.top = `${topPosition}px`;
    hoverCard.style.pointerEvents = showMute ? "auto" : "none"; // Enable interaction if button exists
    hoverCard.classList.add("visible");
  }

  function hideHoverCard() {
    hoverCard.classList.remove("visible");
  }

  function applyTheme(theme) {
    host.classList.remove("ts-theme-light", "ts-theme-dark");
    if (theme === "light") {
      host.classList.add("ts-theme-light");
    } else if (theme === "dark") {
      host.classList.add("ts-theme-dark");
    } else if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      host.classList.add(isDark ? "ts-theme-dark" : "ts-theme-light");
    }
  }

  // --- Settings Sync ---
  function updateSettings(changes) {
    if (changes.autoScroll) userSettings.autoScroll = changes.autoScroll.newValue;
    if (changes.collapseDelay) userSettings.collapseDelay = changes.collapseDelay.newValue;
    if (changes.theme) {
      userSettings.theme = changes.theme.newValue;
      applyTheme(userSettings.theme);
    }
    if (changes.displayMode) {
      userSettings.displayMode = changes.displayMode.newValue;
      if (userSettings.displayMode === 'always_show') {
        showBar();
      } else {
        startHideTimer();
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      updateSettings(changes);
      // Sync Shield visibility in real-time
      if (changes.enableShield) {
        shieldBtn.style.display = changes.enableShield.newValue ? '' : 'none';
      }
    }
  });

  chrome.storage.sync.get({ autoScroll: true, theme: 'system', displayMode: 'auto_hide', collapseDelay: 1500, enableShield: false }, (items) => {
    userSettings = items;
    applyTheme(userSettings.theme);
    if (userSettings.displayMode === 'always_show') {
      showBar();
    }
    shieldBtn.style.display = items.enableShield ? '' : 'none';
  });

  function makeFallback(tab) {
    const fb = document.createElement("div");
    fb.className = "ts-fallback";
    if (tab.emoji) {
      fb.textContent = tab.emoji;
      fb.style.fontSize = "14px";
    } else {
      fb.textContent = (tab.title || "?")[0].toUpperCase();
      fb.style.fontSize = "";
    }
    return fb;
  }

  // ===== TOAST NOTIFICATION SYSTEM =====
  let undoAutoHideTimer = null;

  function showToast(message, type = 'info', duration = 4000) {
    // Remove existing toast
    const existing = shadow.querySelector('.ts-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `ts-toast ts-toast-${type}`;
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
      padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 10001; opacity: 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto; max-width: 90vw; text-align: center; white-space: nowrap;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    switch (type) {
      case 'success':
        toast.style.background = 'rgba(34, 197, 94, 0.9)';
        toast.style.color = '#fff';
        toast.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        break;
      case 'error':
        toast.style.background = 'rgba(239, 68, 68, 0.9)';
        toast.style.color = '#fff';
        toast.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        break;
      case 'warning':
        toast.style.background = 'rgba(245, 158, 11, 0.9)';
        toast.style.color = '#fff';
        toast.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        break;
      default:
        toast.style.background = 'rgba(30, 30, 30, 0.9)';
        toast.style.color = '#fff';
        toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }

    toast.textContent = message;
    shadow.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }

  // ===== CLARIFICATION MODAL (§5) =====
  function showClarificationModal(data) {
    const modal = document.createElement("div");
    modal.className = "ts-clarify-modal";
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      z-index: 10000; opacity: 0; transition: opacity 0.2s ease;
      pointer-events: none;
    `;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px);
    `;
    modal.appendChild(overlay);

    const content = document.createElement("div");
    content.style.cssText = `
      position: relative; background: var(--ts-bg, #222); padding: 24px;
      border-radius: 12px; max-width: 420px; width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
      color: var(--ts-text, #fff); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const question = document.createElement("h3");
    question.textContent = data.question || "Which tabs do you mean?";
    question.style.cssText = "margin: 0 0 16px 0; font-size: 16px; font-weight: 600;";
    content.appendChild(question);

    const optionsList = document.createElement("div");
    optionsList.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

    (data.options || []).forEach((option) => {
      const btn = document.createElement("button");
      btn.textContent = option.label;
      btn.style.cssText = `
        padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.05); color: inherit; cursor: pointer;
        font-size: 14px; text-align: left; transition: background 0.15s ease;
      `;
      btn.addEventListener("mouseenter", () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
      btn.addEventListener("mouseleave", () => { btn.style.background = 'rgba(255,255,255,0.05)'; });
      btn.addEventListener("click", () => close(option));
      optionsList.appendChild(btn);
    });

    content.appendChild(optionsList);

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      width: 100%; margin-top: 12px; padding: 10px 16px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2); background: transparent;
      color: inherit; cursor: pointer; font-size: 14px; opacity: 0.7;
    `;
    cancelBtn.addEventListener("click", () => close(null));
    content.appendChild(cancelBtn);

    modal.appendChild(content);
    shadow.appendChild(modal);

    requestAnimationFrame(() => {
      modal.style.opacity = "1";
      modal.style.pointerEvents = "auto";
    });

    function close(selectedOption) {
      modal.style.opacity = "0";
      modal.style.pointerEvents = "none";
      setTimeout(() => modal.remove(), 200);

      if (selectedOption) {
        safeSendMessage({
          type: "CLARIFICATION_RESPONSE",
          functionCall: data.functionCall,
          selectedOption: selectedOption.value || selectedOption
        }, (response) => {
          if (response && response.success) {
            showToast(response.message, "success");
          } else {
            showToast(response?.message || "Error", "error");
          }
        });
      }
    }

    overlay.addEventListener("click", () => close(null));
  }

  // --- Smooth momentum scrolling ---
  let scrollVelocity = 0;
  let scrollAnimFrame = null;

  function animateScroll() {
    if (Math.abs(scrollVelocity) < 0.5) {
      scrollVelocity = 0;
      scrollAnimFrame = null;
      return;
    }
    track.scrollLeft += scrollVelocity;
    scrollVelocity *= 0.92; // friction
    scrollAnimFrame = requestAnimationFrame(animateScroll);
  }

  trigger.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scrollVelocity += e.deltaY > 0 ? 15 : -15;
      // Clamp velocity
      scrollVelocity = Math.max(-80, Math.min(80, scrollVelocity));
      if (!scrollAnimFrame) {
        scrollAnimFrame = requestAnimationFrame(animateScroll);
      }
    },
    { passive: false }
  );

  // Bar is always visible — no hover expand/collapse needed.

  // --- Task 5: AI Insight Prefetching ---
  let prefetchTimer = null;

  function getVisibleTabIdsForPrefetch(limit = 20) {
    const ids = [];
    const trackRect = track.getBoundingClientRect();
    const tabEls = Array.from(track.querySelectorAll('.ts-tab'));

    for (const el of tabEls) {
      const rect = el.getBoundingClientRect();
      const visible = rect.right >= trackRect.left && rect.left <= trackRect.right;
      if (!visible) continue;

      const id = parseInt(el.dataset.tabId, 10);
      if (!Number.isNaN(id)) ids.push(id);
      if (ids.length >= limit) break;
    }

    return ids;
  }

  function scheduleVisibleInsightsPrefetch() {
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => {
      chrome.storage.sync.get({ aiInsightBatchSize: 20, enableAi: false }, (items) => {
        if (!items.enableAi) return;
        const ids = getVisibleTabIdsForPrefetch(items.aiInsightBatchSize || 20);
        if (ids.length === 0) return;
        safeSendMessage({ type: 'PREFETCH_TAB_INSIGHTS', tabIds: ids });
      });
    }, 350);
  }

  // --- Fetch initial tabs ---
  safeSendMessage({ type: "GET_TABS" }, (response) => {
    if (response && response.tabs) {
      tabs = response.tabs;
      render();
    }
  });

  // --- Listen for live updates ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'FALLBACK_NOTIFICATION') {
      if (typeof showToast !== 'undefined') {
        showToast(
          `⚠️ ${msg.fromModel} rate-limited. Using ${msg.toModel}`,
          'warning'
        );
      }
    } else if (msg.type === 'ALL_MODELS_FAILED') {
      if (typeof showToast !== 'undefined') {
        showToast(
          `❌ All AI models rate-limited (tried ${msg.attemptCount}). Wait a few minutes.`,
          'error'
        );
      }
    } else if (msg.type === "TABS_UPDATED") {
      tabs = msg.tabs;
      render();
    } else if (msg.type === "DECLUTTER_RESULTS") {
      if (msg.tabIds && msg.tabIds.length > 0) {
        msg.tabIds.forEach(id => suggestedCloseIds.add(id));
        render();
      }
    } else if (msg.type === "AI_EXTRACT_RESULT") {
      if (msg.result && msg.result.startsWith("Error")) {
        searchInput.value = "Error: extraction failed";
        setTimeout(() => { searchInput.value = ""; searchInput.placeholder = "Search tabs..."; }, 2000);
      } else if (msg.result) {
        navigator.clipboard.writeText(msg.result).then(() => {
          searchInput.placeholder = "Search tabs...";
          searchInput.value = "Copied!";
          setTimeout(() => { searchInput.value = ""; }, 2000);
        });
      }
      selectedTabIds.clear();
      render();
    } else if (msg.type === "AI_WORKSPACE_DONE") {
      searchInput.disabled = false;
      searchInput.value = "";
      if (msg.error) {
        searchInput.placeholder = "⚠️ " + msg.error;
      } else {
        searchInput.placeholder = "✅ Workspace ready!";
      }
      setTimeout(() => { searchInput.placeholder = "Search tabs..."; }, 3000);
      if (isSearchActive) stopSearch();
    } else if (msg.type === "QUARANTINE_TAB") {
      quarantinedTabIds.add(msg.tabId);
      render();
    } else if (msg.type === "TOGGLE_SCROLLER") {
      if (trigger.classList.contains("hidden")) {
        refreshTabs();
        showBar();
      } else if (userSettings.displayMode !== 'always_show') {
        trigger.classList.add("hidden");
        updatePageMargin(false);
        if (isSearchActive) stopSearch();
      }
    } else if (msg.type === "CONFIRM_TOOL_CALL") {
      (async () => {
        const confirmed = await showConfirmationModal(msg);
        if (confirmed) {
          safeSendMessage({
            type: "EXECUTE_CONFIRMED_TOOL_CALL",
            functionCall: msg.functionCall
          }, (response) => {
            if (response && response.success) {
              if (typeof showToast !== 'undefined') showToast(response.message, "success");
              // Clear search and reset UI if successful
              searchInput.value = "";
              render();
            } else {
              if (typeof showToast !== 'undefined') showToast(response?.message || "Error", "error");
            }
          });
        }
      })();
    } else if (msg.type === "UNDO_AVAILABLE") {
      undoBtn.style.display = "";
      undoBtn.title = `Undo: ${msg.action} (${msg.count} tabs)`;
      showToast(msg.message, "success", 5000);
      // Auto-hide undo button after 15 seconds
      clearTimeout(undoAutoHideTimer);
      undoAutoHideTimer = setTimeout(() => { undoBtn.style.display = "none"; }, 15000);
    } else if (msg.type === "CLARIFICATION_NEEDED") {
      showClarificationModal(msg);
    }
  });

  // ===== CONFIRMATION MODAL =====
  function showConfirmationModal(data) {
    const modal = document.createElement("div");
    modal.className = "ts-confirm-modal";
    
    // Add missing CSS for modal inline to avoid relying on external CSS
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      z-index: 10000; opacity: 0; transition: opacity 0.2s ease;
      pointer-events: none;
    `;
    
    const overlay = document.createElement("div");
    overlay.className = "ts-modal-overlay";
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px);
    `;
    modal.appendChild(overlay);
    
    const content = document.createElement("div");
    content.className = "ts-modal-content";
    content.style.cssText = `
      position: relative; background: var(--ts-bg, #222); padding: 24px;
      border-radius: 12px; max-width: 400px; width: 90%; text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
      color: var(--ts-text, #fff); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;
    
    const title = document.createElement("h3");
    title.textContent = data.message;
    title.style.cssText = "margin: 0 0 12px 0; font-size: 18px; font-weight: 600;";
    content.appendChild(title);
    
    const details = document.createElement("p");
    details.textContent = data.details || "";
    details.style.cssText = "margin: 0 0 24px 0; font-size: 14px; opacity: 0.8; line-height: 1.5; color: var(--ts-text-dim, #aaa);";
    content.appendChild(details);
    
    const buttons = document.createElement("div");
    buttons.style.cssText = "display: flex; gap: 12px; justify-content: center;";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      flex: 1; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
      background: transparent; color: inherit; cursor: pointer; font-size: 14px; font-weight: 500;
    `;
    buttons.appendChild(cancelBtn);
    
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.cssText = `
      flex: 1; padding: 10px 16px; border-radius: 8px; border: none;
      background: var(--ts-accent, #0078d7); color: white; cursor: pointer; font-size: 14px; font-weight: 500;
    `;
    buttons.appendChild(confirmBtn);
    
    content.appendChild(buttons);
    modal.appendChild(content);
    shadow.appendChild(modal);
    
    requestAnimationFrame(() => {
      modal.style.opacity = "1";
      modal.style.pointerEvents = "auto";
    });
    
    return new Promise((resolve) => {
      const close = (result) => {
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
        setTimeout(() => modal.remove(), 200);
        resolve(result);
      };
      
      confirmBtn.onclick = () => close(true);
      cancelBtn.onclick = () => close(false);
      overlay.onclick = () => close(false);
    });
  }

  function refreshTabs() {
    safeSendMessage({ type: "GET_TABS" }, (response) => {
      if (response && response.tabs) {
        tabs = response.tabs;
        render();
      }
    });
  }

  function performPurgeAnimation() {
    const urlMap = new Map();
    tabs.forEach(tab => {
      if (!tab.url) return;
      if (!urlMap.has(tab.url)) urlMap.set(tab.url, []);
      urlMap.get(tab.url).push(tab);
    });

    urlMap.forEach(instances => {
      if (instances.length > 1) {
        const activeInstance = instances.find(inst => inst.active);
        const keepTabId = activeInstance ? activeInstance.id : instances.sort((a,b) => a.index - b.index)[0].id;
        
        instances.forEach(inst => {
          if (inst.id !== keepTabId) {
            const el = track.querySelector(`[data-tab-id="${inst.id}"]`);
            if (el) el.classList.add("purging");
          }
        });
      }
    });
  }


  // --- Resync if tab becomes visible (handles inactive tab staleness) ---
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      safeSendMessage({ type: "GET_TABS" }, (response) => {
        if (response && response.tabs) {
          tabs = response.tabs;
          render();
        }
      });
    }
  });
})();
