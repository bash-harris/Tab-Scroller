// ai-toolcalling.js
// AI Tool Calling Infrastructure for Tab Scroller
// Translates natural language commands into Chrome Tab API calls

// ===== TOOL SCHEMA DEFINITION =====
const TOOL_SCHEMA = {
  function_declarations: [
    {
      name: "close_tabs",
      description: "Close tabs matching specific criteria",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            description: "Criteria to match tabs",
            properties: {
              domain: { type: "string", description: "Domain to match (e.g., 'youtube.com')" },
              titleContains: { type: "string", description: "Text that must appear in tab title" },
              urlContains: { type: "string", description: "Text that must appear in URL" },
              groupName: { type: "string", description: "Tab group name" },
              inactiveMinutes: { type: "number", description: "Minutes since last active" },
              audible: { type: "boolean", description: "Is playing audio" },
              pinned: { type: "boolean", description: "Is pinned" },
              duplicates: { type: "boolean", description: "Only close duplicate URLs" },
              exceptActive: { type: "boolean", description: "Exclude active tab", default: true }
            }
          },
          confirmation: { 
            type: "boolean", 
            description: "Require user confirmation before closing",
            default: true 
          }
        },
        required: ["filters"]
      }
    },
    
    {
      name: "group_tabs",
      description: "Create a tab group or add tabs to existing group",
      parameters: {
        type: "object",
        properties: {
          groupName: { type: "string", description: "Name for the group" },
          color: { 
            type: "string", 
            enum: ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"],
            description: "Group color",
            default: "blue"
          },
          filters: {
            type: "object",
            description: "Criteria to match tabs for grouping",
            properties: {
              domain: { type: "string" },
              titleContains: { type: "string" },
              urlContains: { type: "string" }
            }
          }
        },
        required: ["groupName", "filters"]
      }
    },
    
    {
      name: "bookmark_tabs",
      description: "Save tabs to a bookmark folder",
      parameters: {
        type: "object",
        properties: {
          folderName: { type: "string", description: "Bookmark folder name" },
          filters: { 
            type: "object",
            description: "Tabs to bookmark",
            properties: {
              domain: { type: "string" },
              titleContains: { type: "string" },
              groupName: { type: "string" }
            }
          },
          closeAfterBookmark: { type: "boolean", default: false, description: "Close tabs after bookmarking" }
        },
        required: ["folderName", "filters"]
      }
    },
    
    {
      name: "pin_tabs",
      description: "Pin or unpin tabs",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["pin", "unpin"] },
          filters: { 
            type: "object",
            properties: {
              domain: { type: "string" },
              titleContains: { type: "string" }
            }
          }
        },
        required: ["action", "filters"]
      }
    },
    
    {
      name: "mute_tabs",
      description: "Mute or unmute tabs",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["mute", "unmute"] },
          filters: { 
            type: "object",
            properties: {
              domain: { type: "string" },
              audible: { type: "boolean" }
            }
          }
        },
        required: ["action"]
      }
    },
    
    {
      name: "reload_tabs",
      description: "Reload tabs matching criteria",
      parameters: {
        type: "object",
        properties: {
          filters: { 
            type: "object",
            properties: {
              domain: { type: "string" },
              groupName: { type: "string" }
            }
          },
          bypassCache: { type: "boolean", default: false }
        },
        required: ["filters"]
      }
    },
    
    {
      name: "sort_tabs",
      description: "Sort tabs by various criteria",
      parameters: {
        type: "object",
        properties: {
          sortBy: {
            type: "string",
            enum: ["domain", "title", "lastActive"],
            description: "Sort criteria"
          },
          order: { type: "string", enum: ["asc", "desc"], default: "asc" }
        },
        required: ["sortBy"]
      }
    },
    
    {
      name: "snooze_tabs",
      description: "Snooze tabs until a specific time",
      parameters: {
        type: "object",
        properties: {
          filters: { 
            type: "object",
            properties: {
              domain: { type: "string" },
              titleContains: { type: "string" }
            }
          },
          wakeTime: { type: "string", description: "Natural language time like '2 hours', 'tomorrow', '30 minutes'" }
        },
        required: ["filters", "wakeTime"]
      }
    },
    
    {
      name: "search_and_switch",
      description: "Find and switch to a specific tab",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for tab title or URL" }
        },
        required: ["query"]
      }
    },
    
    {
      name: "analyze_tabs",
      description: "Get insights about current tabs",
      parameters: {
        type: "object",
        properties: {
          analysisType: {
            type: "string",
            enum: ["summary", "duplicates", "inactive_tabs", "by_domain"],
            description: "Type of analysis"
          }
        },
        required: ["analysisType"]
      }
    }
  ]
};

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TOOL_SCHEMA };
}
