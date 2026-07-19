import { eventSource, saveSettingsDebounced } from '../../../../script.js'; // For event handling (will use later)
// Removed the incorrect SillyTavern import

// Import button logic from separate modules
import { guidedResponse } from './scripts/guidedResponse.js';
import { guidedSwipe } from './scripts/guidedSwipe.js';
import { guidedContinue, undoLastGuidedAddition, revertToOriginalGuidedContinue, initGuidedContinueListeners } from './scripts/guidedContinue.js'; // Added initGuidedContinueListeners, undoLastGuidedAddition, revertToOriginalGuidedContinue
import { guidedImpersonate } from './scripts/guidedImpersonate.js';
import { guidedImpersonate2nd } from './scripts/guidedImpersonate2nd.js'; // Import 2nd
import { guidedImpersonate3rd } from './scripts/guidedImpersonate3rd.js'; // Import 3rd
// Import necessary functions/objects from SillyTavern
import { getContext, loadExtensionSettings, extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js'; 
// Import Preset Manager
import { getPresetManager } from '../../../../scripts/preset-manager.js';
import { loadSettingsPanel } from './scripts/settingsPanel.js';
import { showVersionNotification } from './scripts/ui/versionNotificationPopup.js';
import { getProfileList } from './scripts/persistentGuides/guideExports.js';


// --- Shared State for Impersonation Input Recovery ---
let previousImpersonateInput = ''; // Input before the last impersonation
let lastImpersonateResult = '';    // Input after the last impersonation

export function getPreviousImpersonateInput() {
    return previousImpersonateInput;
}
export function setPreviousImpersonateInput(value) {
    previousImpersonateInput = value;
}
export function getLastImpersonateResult() {
    return lastImpersonateResult;
}
export function setLastImpersonateResult(value) {
    lastImpersonateResult = value;
}
// --- End Shared State ---

export const extensionName = "GuidedGenerations-Extension"; // Use the simple name as the internal identifier
// const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`; // No longer needed

let isSending = false;

// Debug message capture array - only populated when debug mode is enabled
let debugMessages = [];

/**
 * Captures debug messages when debug mode is enabled
 * @param {string} level - The log level (log, warn, error)
 * @param {...any} args - Arguments to log
 */
function captureDebugMessage(level, ...args) {
    if (extension_settings[extensionName]?.debugMode) {
        const timestamp = new Date().toISOString();
        
        // Get stack trace information
        const stack = new Error().stack;
        let fileInfo = 'Unknown';
        let lineInfo = 'Unknown';
        
        if (stack) {
            // Parse stack trace to find the calling function
            const stackLines = stack.split('\n');
            // Look for the first line that's not from this file or the debug functions
            for (let i = 1; i < stackLines.length; i++) {
                const line = stackLines[i];
                if (line && !line.includes('captureDebugMessage') && !line.includes('debugLog') && !line.includes('debugWarn')) {
                    // Extract file and line info from stack trace
                    const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
                    if (match) {
                        const fullPath = match[1];
                        // Extract just the filename from the full path
                        const fileName = fullPath.split('/').pop() || fullPath.split('\\').pop() || fullPath;
                        fileInfo = fileName;
                        lineInfo = match[2];
                        break;
                    }
                }
            }
        }
        
        const message = {
            timestamp,
            level,
            file: fileInfo,
            line: lineInfo,
            args: args.map(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            })
        };
        debugMessages.push(message);
        
        // Keep only the last 1000 messages to prevent memory issues
        if (debugMessages.length > 1000) {
            debugMessages = debugMessages.slice(-1000);
        }
    }
}

/**
 * Conditional logging utility that only logs when debug mode is enabled
 * @param {...any} args - Arguments to log (same as console.log)
 */
export function debugLog(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        captureDebugMessage('log', ...args);
        console.log(`[${extensionName}][DEBUG]`, ...args);
    }
}

/**
 * Conditional warning utility that only logs when debug mode is enabled
 * @param {...any} args - Arguments to log (same as console.warn)
 */
export function debugWarn(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        captureDebugMessage('warn', ...args);
        console.warn(`[${extensionName}][DEBUG]`, ...args);
    }
}

/**
 * Conditional error utility that only logs when debug mode is enabled
 * @param {...any} args - Arguments to log (same as console.error)
 */
export function debugError(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        captureDebugMessage('error', ...args);
        console.error(`[${extensionName}][DEBUG]`, ...args);
    }
}

/**
 * Gets all captured debug messages
 * @returns {Array} Array of debug message objects
 */
export function getDebugMessages() {
    return [...debugMessages]; // Return a copy to prevent external modification
}

/**
 * Clears all captured debug messages
 */
export function clearDebugMessages() {
    debugMessages = [];
}

/**
 * Gets debug messages as formatted text
 * @returns {string} Formatted debug messages
 */
export function getDebugMessagesAsText() {
    return debugMessages.map(msg => {
        const level = msg.level.toUpperCase().padEnd(5);
        const fileLine = `${msg.file}:${msg.line}`.padEnd(20);
        return `[${msg.timestamp}] ${level} [${fileLine}] ${msg.args.join(' ')}`;
    }).join('\n');
} 
// Removed storedInput as recovery now uses stscript global vars

export const defaultSettings = {
    showImpersonate1stPerson: true, // Default on
    showImpersonate2ndPerson: false, // Default off
    showImpersonate3rdPerson: false, // Default off
    showGuidedContinue: false, // Default off for Guided Continue
    showGuidedResponse: true, // Default on for Guided Response
    showGuidedSwipe: true, // Default on for Guided Swipe
    integrateQrBar: true, // Default on: Toggle for QR bar integration
    debugMode: false, // Default off: Toggle for debug logging
    injectionEndRole: 'system', // NEW SETTING: Default role for non-chat injections
    // Profile and Preset settings for each guide
    profileImpersonate1st: '', // Profile for Impersonate 1st Person
    presetImpersonate1st: '',
    profileImpersonate1stApiType: '', // API type for Impersonate 1st Person profile
    profileImpersonate2nd: '', // Profile for Impersonate 2nd Person
    presetImpersonate2nd: '',
    profileImpersonate2ndApiType: '', // API type for Impersonate 2nd Person profile
    profileImpersonate3rd: '', // Profile for Impersonate 3rd Person
    presetImpersonate3rd: '',
    profileImpersonate3rdApiType: '', // API type for Impersonate 3rd Person profile
    // Guide prompt overrides
    promptImpersonate1st: 'Write in first Person perspective from {{user}}. {{input}}',
    promptImpersonate2nd: 'Write in second Person perspective from {{user}}, using you/yours for {{user}}. {{input}}',
    promptImpersonate3rd: 'Write in third Person perspective from {{user}} using third-person pronouns for {{user}}. {{input}}',
    promptGuidedResponse: '[Take the following into special consideration for your next message: {{input}}]',
    promptGuidedSwipe: '[Take the following into special consideration for your next message: {{input}}]',
    promptGuidedContinue: '[Continue the story based on the following input: {{input}}]', // Default prompt override for Guided Continue
    // Depth settings for prompt overrides
    depthPromptGuidedResponse: 0,
    depthPromptGuidedSwipe: 0,
    profileSwitchTimeout: 500, // Default safety delay after profile switch (ms)
    presetSwitchTimeout: 200, // Default safety delay after preset switch (ms)
    LastPatchNoteVersion: '1.4.3' // Default extension version for patch notes
};

/**
 * Checks if the current chat context is a group chat.
 * @returns {boolean} True if it is a group chat, false otherwise.
 */
export function isGroupChat() {
    try {
        const context = getContext(); // Use imported getContext
        return !!context.groupId; // groupId will be a string ID if group, otherwise null/undefined
    } catch (error) {
        console.error(`${extensionName}: Error checking group chat status:`, error);
        return false; // Assume not a group chat on error
    }
}

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    // Check if settings are empty and initialize with defaults
    // This simplified approach assumes defaults are complete.
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        debugLog(`Initializing settings with defaults.`);
        Object.assign(extension_settings[extensionName], defaultSettings);
    } else {
         debugLog(`Settings already loaded, ensuring all keys exist.`);
        // Ensure all default keys exist (migration / update handling)
        for (const key in defaultSettings) {
            if (extension_settings[extensionName][key] === undefined) {
                debugWarn(`Setting key "${key}" missing, adding default value: ${defaultSettings[key]}`);
                extension_settings[extensionName][key] = defaultSettings[key];
            }
        }
    }

    // Handle backward compatibility for profile settings
    migrateProfileSettings();
    
    // Debug logging for presetFun specifically
    debugLog(`presetFun setting value:`, extension_settings[extensionName].presetFun);
    debugLog(`presetFun default value:`, defaultSettings.presetFun);

    debugLog(`Current settings:`, extension_settings[extensionName]);

    // Show debug mode status in normal console log
    const debugStatus = extension_settings[extensionName]?.debugMode ? 'ACTIVE' : 'INACTIVE';
    console.log(`${extensionName}: Debug logging is ${debugStatus}`);

    // No need to update UI here, updateSettingsUI will be called separately after template render
}

/**
 * Migrates existing settings to include profile fields for backward compatibility
 */
function migrateProfileSettings() {
    const settings = extension_settings[extensionName];
    if (!settings) return;
    
    // List of all preset keys that need corresponding profile keys
    const presetKeys = [
        'presetClothes', 'presetState', 'presetThinking', 'presetSituational', 'presetRules',
        'presetCustom', 'presetCorrections', 'presetSpellchecker', 'presetEditIntros',
        'presetImpersonate1st', 'presetImpersonate2nd', 'presetImpersonate3rd',
        'presetCustomAuto', 'presetFun'
    ];
    
    presetKeys.forEach(presetKey => {
        const profileKey = presetKey.replace('preset', 'profile');
        
        // If profile key doesn't exist but preset key does, set profile to empty (current profile)
        if (settings[presetKey] !== undefined && settings[profileKey] === undefined) {
            settings[profileKey] = '';
            debugLog(`[${extensionName}] Migrated ${profileKey} to empty (current profile) for backward compatibility`);
        }
    });
}

async function updateSettingsUI() {
    const settingsPanelId = `extension_settings_${extensionName}`;
    const container = document.getElementById(settingsPanelId);
    if (container) {
        debugLog(`Updating UI elements from settings.`);
        Object.keys(defaultSettings).forEach(key => {
            const checkbox = container.querySelector(`input[name="${key}"]`);
            if (checkbox) {
                // Check if the setting exists before trying to access it
                if (extension_settings[extensionName] && extension_settings[extensionName].hasOwnProperty(key)) {
                     checkbox.checked = extension_settings[extensionName][key];
                } else {
                    debugWarn(`Setting key "${key}" not found in loaded settings during UI update. Using default: ${defaultSettings[key]}`);
                    checkbox.checked = defaultSettings[key]; // Use default if missing
                }
            } else {
                 // Allow this warning during initial load before template might be ready
                 // console.warn(`${extensionName}: Could not find checkbox for setting "${key}" during updateSettingsUI.`);
            }
        });

        // Update checkboxes
        document.querySelectorAll('.gg-setting-input[type="checkbox"]').forEach(checkbox => {
            const settingName = checkbox.name;
            if (settingName in extension_settings[extensionName]) {
                checkbox.checked = extension_settings[extensionName][settingName];
            }
        });

        // Update the new dropdown
        const injectionRoleSelect = document.getElementById('gg_injectionEndRole');
        if (injectionRoleSelect && extension_settings[extensionName].injectionEndRole) {
            injectionRoleSelect.value = extension_settings[extensionName].injectionEndRole;
        }

        // Populate profile dropdowns
        try {
            const profileList = await getProfileList();
            debugLog(`[${extensionName}] Profile list received:`, profileList);
            
            const profileKeys = ['profileImpersonate1st','profileImpersonate2nd','profileImpersonate3rd'];
            
            profileKeys.forEach(key => {
                const select = document.getElementById(key);
                if (select) {
                    // Clear existing options
                    select.innerHTML = '<option value="">None</option>';
                    
                    // Add profile options
                    if (Array.isArray(profileList) && profileList.length > 0) {
                        profileList.forEach(profileName => {
                            const option = document.createElement('option');
                            option.value = profileName;
                            option.textContent = profileName;
                            select.appendChild(option);
                        });
                        debugLog(`[${extensionName}] Added ${profileList.length} profiles to ${key}`);
                    } else {
                        debugLog(`[${extensionName}] No profiles available for ${key}, profileList:`, profileList);
                    }
                    
                    // Set current value
                    select.value = extension_settings[extensionName][key] ?? defaultSettings[key] ?? '';
                } else {
                    debugLog(`[${extensionName}] Profile select element not found for ${key}`);
                }
            });
        } catch (error) {
            console.error(`[${extensionName}] Error populating profile dropdowns:`, error);
        }

        // Populate preset dropdowns with correct presets for selected profiles
        ['presetImpersonate1st','presetImpersonate2nd','presetImpersonate3rd'].forEach(async (key) => {
            const select = document.getElementById(key);
            if (select) {
                // Use the improved populatePresetDropdown function that checks for selected profiles
                await populatePresetDropdown(select);
                
                // Set current value after populating
                select.value = extension_settings[extensionName][key] ?? defaultSettings[key] ?? '';
            }
        });

        // Populate guide prompt override textareas
        ['promptImpersonate1st','promptImpersonate2nd','promptImpersonate3rd','promptGuidedResponse','promptGuidedSwipe','promptGuidedContinue'].forEach(key => {
            const textarea = document.getElementById(`gg_${key}`);
            if (textarea) {
                textarea.value = extension_settings[extensionName][key] ?? defaultSettings[key] ?? '';
            }
        });

        // Populate depth number input fields
        ['depthPromptGuidedResponse', 'depthPromptGuidedSwipe',
         'profileSwitchTimeout', 'presetSwitchTimeout'].forEach(key => {
            const input = document.getElementById(`gg_${key}`);
            if (input) {
                input.value = extension_settings[extensionName][key] ?? defaultSettings[key] ?? 0; // Default to 0 if undefined
            }
        });

        debugLog(`${extensionName}: Settings UI updated.`);
    } else {
        debugWarn(`${extensionName}: Settings container #${settingsPanelId} not found during updateSettingsUI.`);
    }
}

/**
 * Adds event listeners to the settings panel elements after they are loaded.
 * Uses event delegation on the container.
 */
const addSettingsEventListeners = () => {
    // Get the specific container for this extension's settings
    const containerId = `extension_settings_${extensionName}`;
    const settingsContainer = document.getElementById(containerId);

    if (settingsContainer) {
        debugLog(`[${extensionName}] Adding delegated event listener to #${containerId}`);
        // Remove any potentially existing listener first to avoid duplicates on reload
        settingsContainer.removeEventListener('change', handleSettingsChangeDelegated);
        // Add the delegated listener
        settingsContainer.addEventListener('change', handleSettingsChangeDelegated);
    } else {
        console.error(`[${extensionName}] Could not find settings container #${containerId} to attach listeners.`);
    }
};

/**
 * Delegated event handler for settings changes within the container.
 * @param {Event} event The event object
 */
const handleSettingsChangeDelegated = async (event) => {
    // Check if the changed element has the correct class
    if (event.target.classList.contains('gg-setting-input')) {
        debugLog(`[${extensionName}] Delegated change event detected on:`, event.target);
        handleSettingChange(event); // Call the original handler

        // Special handling for button visibility settings after change
        if (event.target.name === 'showImpersonateButton') {
            updateImpersonateButtonVisibility();
        }
        if (event.target.name === 'showSwipeButton') {
            const button = document.getElementById('guided_swipe_button');
            if (button) button.style.display = event.target.checked ? '' : 'none';
        }
        if (event.target.name === 'showResponseButton') {
            const button = document.getElementById('guided_response_button');
            if (button) button.style.display = event.target.checked ? '' : 'none';
        }
        if (event.target.name === 'showGuidedContinue') {
            const button = document.getElementById('gg_continue_button');
            if (button) button.style.display = event.target.checked ? '' : 'none';
        }
        
        // Special handling for profile dropdowns - repopulate preset dropdowns when profile changes
        if (event.target.name && event.target.name.startsWith('profile')) {
            const guideName = event.target.name.replace('profile', '');
            const presetSelect = document.getElementById(`preset${guideName}`);
            if (presetSelect) {
                // Store the API type for this profile
                const selectedProfile = event.target.value;
                if (selectedProfile && selectedProfile.trim() !== '') {
                    // Get and store the API type for this profile
                    const { getProfileApiType } = await import('./scripts/persistentGuides/guideExports.js');
                    const apiType = await getProfileApiType(selectedProfile);
                    
                    if (apiType) {
                        const apiTypeFieldName = `${event.target.name}ApiType`;
                        extension_settings[extensionName][apiTypeFieldName] = apiType;
                        debugLog(`[${extensionName}] Stored API type "${apiType}" for profile "${selectedProfile}"`);
                    }
                }
                
                // Update the preset dropdown
                await handleProfileChangeForPresets(selectedProfile, presetSelect);
            }
        }
    }
};

// Separate handler function for clarity
function handleSettingChange(event) {
    const target = event.target;
    const settingName = target.name;
    let settingValue;

    if (target.type === 'checkbox') {
        settingValue = target.checked;
    } else if (target.tagName === 'SELECT') { // Handle dropdowns
        settingValue = target.value;
        
        // Handle preset and profile dropdowns - no validation needed as values are preset IDs or profile names
        const presetFields = ['presetImpersonate1st', 'presetImpersonate2nd', 'presetImpersonate3rd'];
        const profileFields = ['profileImpersonate1st', 'profileImpersonate2nd', 'profileImpersonate3rd'];
        if (presetFields.includes(settingName) || profileFields.includes(settingName)) {
            // Values are preset IDs (numbers) or profile names, no pipe validation needed
            settingValue = settingValue.trim();
        }
    } else if (target.tagName === 'INPUT' && target.type === 'text') {
        settingValue = target.value;
        if (typeof settingValue === 'string') {
            settingValue = settingValue.trim().replace(/\r?\n/g, '\n');
            
            // Validate preset fields to prevent pipe characters
            const presetFields = ['presetImpersonate1st', 'presetImpersonate2nd', 'presetImpersonate3rd'];
            if (presetFields.includes(settingName) && settingValue.includes('|')) {
                console.warn(`${extensionName}: Preset value cannot contain pipe character (|)`);
                // Remove pipe characters and update the input field
                settingValue = settingValue.replace(/\|/g, '');
                target.value = settingValue;
            }
        }
    } else if (target.tagName === 'TEXTAREA') {
        settingValue = target.value;
        if (typeof settingValue === 'string') {
            settingValue = settingValue.trim().replace(/\r?\n/g, '\n');
            
            // Validate preset fields to prevent pipe characters
            const presetFields = ['presetImpersonate1st', 'presetImpersonate2nd', 'presetImpersonate3rd'];
            if (presetFields.includes(settingName) && settingValue.includes('|')) {
                console.warn(`${extensionName}: Preset value cannot contain pipe character (|)`);
                // Remove pipe characters and update the input field
                settingValue = settingValue.replace(/\|/g, '');
                target.value = settingValue;
            }
        }
    } else if (target.type === 'number') {
        const numValue = parseFloat(target.value);
        settingValue = isNaN(numValue) ? 0 : numValue;
    } else {
        console.warn(`${extensionName}: Unhandled setting type: ${target.type}`);
        return; // Don't save if it's not a recognized type
    }

    debugLog(`Setting Changed: ${settingName} = ${settingValue} (Type: ${typeof settingValue})`);

    if (extension_settings[extensionName]) {
        extension_settings[extensionName][settingName] = settingValue;
        debugLog(`> Updated setting: Key='${settingName}', New Value='${settingValue}'`);
        debugLog(`> Current extension_settings[${extensionName}]:`, JSON.stringify(extension_settings[extensionName]));
        saveSettingsDebounced(); // Save after updating the specific key

        // *** ADDED: Refresh buttons after setting change ***
        updateExtensionButtons();
    } else {
        console.error(`[${extensionName}] Error: extension_settings[${extensionName}] is undefined.`);
    }
}

/**
 * Handles profile change for presets - populates preset dropdown based on selected profile's API type
 * @param {string} selectedProfile - The selected profile name
 * @param {HTMLElement} presetDropdown - The preset dropdown element to populate
 */
async function handleProfileChangeForPresets(selectedProfile, presetDropdown) {
    try {
        debugLog(`[${extensionName}] Profile changed to: "${selectedProfile}", updating preset dropdown...`);
        
        // Clear existing preset options
        presetDropdown.innerHTML = '';
        
        if (!selectedProfile || selectedProfile.trim() === '') {
            debugLog(`[${extensionName}] No profile selected, populating with current profile's presets`);
            await populatePresetDropdown(presetDropdown);
            return;
        }
        
        // Get the API type for the selected profile without switching to it
        const { getProfileApiType, getPresetsForApiType } = await import('./scripts/persistentGuides/guideExports.js');
        const apiType = await getProfileApiType(selectedProfile);
        
        if (!apiType) {
            debugLog(`[${extensionName}] Could not determine API type for profile "${selectedProfile}", using current profile's presets`);
            await populatePresetDropdown(presetDropdown);
            return;
        }
        
        debugLog(`[${extensionName}] Profile "${selectedProfile}" uses API type: "${apiType}"`);
        
        // Get presets for this API type without switching profiles
        const presetList = await getPresetsForApiType(apiType);
        
        if (!presetList) {
            debugLog(`[${extensionName}] Could not get presets for API type "${apiType}", using current profile's presets`);
            await populatePresetDropdown(presetDropdown);
            return;
        }
        
        debugLog(`[${extensionName}] Retrieved ${presetList.preset_names?.length || 0} presets for API type "${apiType}"`);
        
        // Populate the preset dropdown with the API-specific presets
        await populatePresetDropdownWithList(presetDropdown, presetList);
        
    } catch (error) {
        console.error(`[${extensionName}] Error handling profile change for presets:`, error);
        // Fallback to current profile's presets
        await populatePresetDropdown(presetDropdown);
    }
}



/**
 * Populates a preset dropdown with a specific preset list
 * @param {HTMLElement} presetSelect - The preset select element to populate
 * @param {Object} presetList - The preset list to use
 */
function populatePresetDropdownWithList(presetSelect, presetList) {
    // Clear existing options
    presetSelect.innerHTML = '<option value="">None</option>';
    
    // Check if presetList is valid
    if (!presetList) {
        debugLog(`[${extensionName}] No preset list provided for dropdown population`);
        return;
    }
    
    // Add preset options - handle multiple possible data structures
    if (presetList.preset_names) {
        // Newer format: presetList has preset_names property
        const presetNames = presetList.preset_names;
        if (Array.isArray(presetNames)) {
            // Text Completion format: preset_names is an array of names
            presetNames.forEach((name, index) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                presetSelect.appendChild(option);
            });
        } else {
            // Chat Completion format: preset_names is an object with name-to-id mapping
            Object.entries(presetNames).forEach(([name, id]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = name;
                presetSelect.appendChild(option);
            });
        }
    } else if (Array.isArray(presetList)) {
        // Legacy format: presetList is an array of objects with id and name properties
        presetList.forEach(preset => {
            if (preset.name && preset.id !== undefined) {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.name;
                presetSelect.appendChild(option);
            }
        });
    } else {
        debugLog(`[${extensionName}] Unknown preset list format:`, presetList);
    }
}

// Function to create and add buttons based on settings
function updateExtensionButtons() {
    const settings = extension_settings[extensionName];
    if (!settings) {
        console.error(`${extensionName}: Settings not loaded, cannot update buttons.`);
        return;
    }
    console.log(`${extensionName}: Updating extension buttons based on settings...`, settings);

    // --- Right Side: Action Buttons (Now in Container Below Input) --- 
    const sendForm = document.getElementById('send_form');
    const nonQRFormItems = document.getElementById('nonQRFormItems');

    if (!sendForm || !nonQRFormItems) {
        console.error(`${extensionName}: Could not find #send_form or #nonQRFormItems. Cannot add button container.`);
        return;
    }

    // --- Get or Create the Action Button Container --- 
    let buttonContainer = document.getElementById('gg-action-button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'gg-action-button-container';
        buttonContainer.className = 'gg-action-buttons-container'; // Add class for styling
        // Insert the container AFTER nonQRFormItems within send_form
        nonQRFormItems.parentNode.insertBefore(buttonContainer, nonQRFormItems.nextSibling);
        console.log(`${extensionName}: Created action button container below input area. - TESTING CHANGES TRANSFER`);
    }

    // Clear the container before adding/arranging buttons
    buttonContainer.innerHTML = '';

    // Create a separate container for menu buttons (left side)
    const menuButtonsContainer = document.createElement('div');
    menuButtonsContainer.id = 'gg-menu-buttons-container';
    menuButtonsContainer.className = 'gg-menu-buttons-container';
    
    // Create a separate container for action buttons (right side)
    const actionButtonsContainer = document.createElement('div');
    actionButtonsContainer.id = 'gg-regular-buttons-container';
    actionButtonsContainer.className = 'gg-regular-buttons-container';
    
    // Create a spacer/QR container that will either hold QR buttons or just provide spacing
    const qrContainer = document.createElement('div');
    qrContainer.id = 'gg-qr-container';
    qrContainer.className = 'gg-qr-container';
    
    // Add all three containers to the main button container in the correct order
    buttonContainer.appendChild(menuButtonsContainer);
    buttonContainer.appendChild(qrContainer);
    buttonContainer.appendChild(actionButtonsContainer);
    
    // --- Create GG Tools Menu Button (Wand) --- 
    let ggMenuButton = document.getElementById('gg_menu_button');
    if (!ggMenuButton) {
        // Create it for the first time
        ggMenuButton = document.createElement('div');
        ggMenuButton.id = 'gg_menu_button';
        ggMenuButton.className = 'gg-menu-button fa-solid fa-bookmark'; // Base classes
        ggMenuButton.classList.add('interactable'); // Make sure it has interactable styles
        ggMenuButton.title = 'Guided Generations Tools';

        const ggToolsMenu = document.createElement('div');
        ggToolsMenu.id = 'gg_tools_menu';
        ggToolsMenu.className = 'gg-tools-menu'; // Dropdown menu styling

        // Add Undo Last Addition menu item
        const undoMenuItem = document.createElement('a');
        undoMenuItem.href = '#';
        undoMenuItem.className = 'interactable';
        undoMenuItem.innerHTML = '<i class="fa-solid fa-rotate-left fa-fw"></i><span data-i18n="Undo Last Addition">Undo Last Addition</span>';
        undoMenuItem.title = 'Removes the last segment added by a guided continue action.';
        undoMenuItem.addEventListener('click', (event) => {
            if (window.GuidedGenerations && typeof window.GuidedGenerations.undoLastGuidedAddition === 'function') {
                window.GuidedGenerations.undoLastGuidedAddition();
            }
            ggToolsMenu.classList.remove('shown');
            event.stopPropagation();
        });

        // Add Revert to Original Message menu item
        const revertMenuItem = document.createElement('a');
        revertMenuItem.href = '#';
        revertMenuItem.className = 'interactable';
        revertMenuItem.innerHTML = '<i class="fa-solid fa-history fa-fw"></i><span data-i18n="Revert to Original">Revert to Original</span>';
        revertMenuItem.title = 'Restores the message to its state before any guided continues were applied.';
        revertMenuItem.addEventListener('click', (event) => {
            if (window.GuidedGenerations && typeof window.GuidedGenerations.revertToOriginalGuidedContinue === 'function') {
                window.GuidedGenerations.revertToOriginalGuidedContinue();
            }
            ggToolsMenu.classList.remove('shown');
            event.stopPropagation();
        });

        // Add items to the menu
        ggToolsMenu.appendChild(undoMenuItem);
        ggToolsMenu.appendChild(revertMenuItem);
        // Add a separator
        const separator2 = document.createElement('hr');
        separator2.className = 'pg-separator';
        ggToolsMenu.appendChild(separator2);
        
        // Add Help menu item
        const helpMenuItem = document.createElement('a');
        helpMenuItem.href = '#';
        helpMenuItem.className = 'interactable';
        helpMenuItem.innerHTML = '<i class="fa-solid fa-question-circle fa-fw"></i><span data-i18n="Help">Help</span>';
        helpMenuItem.title = 'Opens the extension wiki for documentation and help.';
        helpMenuItem.addEventListener('click', (event) => {
            // Open the GitHub wiki in a new tab/window
            const wikiUrl = 'https://github.com/Samueras/GuidedGenerations-Extension/wiki';
            window.open(wikiUrl, '_blank');
            ggToolsMenu.classList.remove('shown');
            event.stopPropagation();
        });

        ggToolsMenu.appendChild(helpMenuItem);

        // Append the menu itself to the body, not the button
        document.body.appendChild(ggToolsMenu);

        // Event Handlers for Menu Toggle and Close
        ggMenuButton.addEventListener('click', (event) => {

            // --- Measure Height Correctly ---
            // Temporarily show the menu off-screen to measure its height
            ggToolsMenu.style.visibility = 'hidden'; 
            ggToolsMenu.style.display = 'block'; // Or the display type it uses when shown
            const menuHeight = ggToolsMenu.offsetHeight; 
            ggToolsMenu.style.display = ''; // Reset display before final positioning
            ggToolsMenu.style.visibility = ''; // Reset visibility
            // ---------------------------------

            // Calculate position before showing
            const buttonRect = ggMenuButton.getBoundingClientRect();
            const gap = 5; // Add a 5px gap above the button

            // Calculate Y so the *bottom* of the menu is 'gap' pixels above the button's top
            const targetMenuBottomY = buttonRect.top - gap + window.scrollY;
            const targetMenuTopY = targetMenuBottomY - menuHeight; // This is the final top coordinate
            const targetMenuLeftX = buttonRect.left + window.scrollX;

            // Apply top/left instead of transform
            ggToolsMenu.style.top = `${targetMenuTopY}px`;
            ggToolsMenu.style.left = `${targetMenuLeftX}px`;

            ggToolsMenu.classList.toggle('shown');
            event.stopPropagation();
        });

        document.addEventListener('click', (event) => {
            if (ggToolsMenu.classList.contains('shown') && !ggMenuButton.contains(event.target)) {
                ggToolsMenu.classList.remove('shown');
            }
        });
    } 
    // Add menu button to the menu buttons container
    menuButtonsContainer.appendChild(ggMenuButton);

    // --- Create Action Buttons --- 
    // Helper function to create buttons
    const createActionButton = (id, title, iconClass, actionFunc) => {
        const button = document.createElement('div');
        button.id = id;
        button.className = 'gg-action-button'; // Base class
        
        // Split the icon class string by spaces and add each class separately
        if (iconClass) {
            const iconClasses = iconClass.split(' ');
            iconClasses.forEach(cls => {
                if (cls) button.classList.add(cls);
            });
        }
        
        button.classList.add('interactable'); // Add interactable class
        button.title = title;
        
        button.addEventListener('click', (event) => {
            actionFunc(event);
        });
        
        return button;
    };
    
    // Create an array to store all buttons that will go in the regular buttons container
    // We'll add the buttons in the desired order and then add them to the container
    const regularButtons = [];
    
    // Add impersonate buttons
    if (settings.showImpersonate1stPerson) {
        const btn1 = createActionButton('gg_impersonate_button', 'Guided Impersonate (1st Person)', 'fa-solid fa-user', guidedImpersonate);
        regularButtons.push(btn1);
    }
    
    if (settings.showImpersonate2ndPerson) {
        const btn2 = createActionButton('gg_impersonate_button_2nd', 'Guided Impersonate (2nd Person)', 'fa-solid fa-user-group', guidedImpersonate2nd);
        regularButtons.push(btn2);
    }
    
    if (settings.showImpersonate3rdPerson) {
        const btn3 = createActionButton('gg_impersonate_button_3rd', 'Guided Impersonate (3rd Person)', 'fa-solid fa-users', guidedImpersonate3rd);
        regularButtons.push(btn3);
    }

    // Add Guided Swipe Button
    if (settings.showGuidedSwipe) {
        const guidedSwipeButton = createActionButton('gg_swipe_button', 'Guided Swipe', 'fa-solid fa-forward', guidedSwipe);
        regularButtons.push(guidedSwipeButton);
    }

    // Add Guided Response Button
    if (settings.showGuidedResponse) {
        const guidedResponseButton = createActionButton('gg_response_button', 'Guided Response', 'fa-solid fa-dog', guidedResponse);
        regularButtons.push(guidedResponseButton);
    }

    // Add Guided Continue Button
    if (settings.showGuidedContinue) {
        const guidedContinueButton = createActionButton('gg_continue_button', 'Guided Continue', 'fa-solid fa-arrow-right', guidedContinue);
        regularButtons.push(guidedContinueButton);
    }
    
    // Append all buttons to the container in the correct order
    regularButtons.forEach(button => {
        actionButtonsContainer.appendChild(button);
    });

    integrateQRBar(); // Ensure QR bar is correctly placed after UI update
}

// Function to integrate QR Bar from other extensions into our container
function integrateQRBar() {
    const qrBar = document.getElementById('qr--bar');
    const qrContainer = document.getElementById('gg-qr-container');
    const sendForm = document.getElementById('send_form'); // Common parent for QR bar

    if (!qrBar || !qrContainer) {
        // QR Bar or our container doesn't exist yet, will keep checking or log error
        if (!qrBar) return false; // Keep polling if QR bar not found
        if (!qrContainer) {
            console.log(`${extensionName}: QR container (gg-qr-container) not found. This shouldn't happen.`);
            return false;
        }
    }

    const currentSettings = extension_settings[extensionName];
    if (!currentSettings) {
        console.log(`${extensionName}: Extension settings not found.`);
        return false; // Cannot determine integration preference
    }

    if (currentSettings.integrateQrBar) {
        // Setting wants QR bar IN our container
        if (qrBar.parentElement !== qrContainer) {
            try {
                qrContainer.appendChild(qrBar);
            } catch (error) {
                console.error(`${extensionName}: Error moving QR Bar into gg-qr-container:`, error);
                return false;
            }
        }
        // Else: it's already in our container, do nothing
    } else {
        // Setting wants QR bar OUT of our container
        if (qrBar.parentElement === qrContainer) {
            if (sendForm) {
                try {
                    // Attempt to move it back to a common parent like send_form
                    // This might not be its exact original parent, but a sensible default
                    sendForm.appendChild(qrBar); 
                } catch (error) {
                    console.error(`${extensionName}: Error moving QR Bar out of gg-qr-container:`, error);
                    // Fallback: if send_form append fails, at least remove from our container if possible
                    // though this might leave it orphaned if not handled carefully.
                    // For now, we'll rely on appendChild to handle reparenting.
                    return false;
                }
            } else {
                console.warn(`${extensionName}: Could not find 'send_form' to move QR bar back.`);
                // If send_form doesn't exist, we can't reliably move it back. 
                // Leaving it in qrContainer might be the lesser evil than orphaning it.
                // Or, we could try qrContainer.removeChild(qrBar) but this needs a defined destination.
            }
        }
        // Else: it's not in our container, do nothing (it's already where it should be according to this setting)
    }
    return true; // Indicates an attempt was made or state is correct
}

// Setup a polling mechanism to integrate QR Bar when it appears
function startQRBarIntegration() {
    // Try to integrate immediately
    let integrated = integrateQRBar();
    
    // If not successful, set up a polling mechanism
    if (!integrated) {
        const integrationInterval = setInterval(() => {
            integrated = integrateQRBar();
            if (integrated) {
                clearInterval(integrationInterval);
            }
        }, 1000); // Check every second
        
        // Stop checking after 30 seconds if not found
        setTimeout(() => {
            if (!integrated) {
                clearInterval(integrationInterval);
            }
        }, 30000);
    }
}

// Set up a more aggressive and robust mutation observer to detect when the QR bar appears
function setupQRMutationObserver() {
    // Create a timer that will periodically try to integrate the QR bar
    const integrationTimer = setInterval(() => {
        const integrated = integrateQRBar();
        // Stop the timer after 30 seconds regardless to avoid ongoing polling
        setTimeout(() => {
            clearInterval(integrationTimer);
        }, 30000);
    }, 1000); // Try every second
    
    // Set up a document-wide mutation observer to catch the QR bar whenever it appears
    setTimeout(() => {
        // Watch the entire document for changes
        const observer = new MutationObserver((mutations) => {
            // Check if any of the mutations involve the qr--bar being added
            const shouldTryIntegrate = mutations.some(mutation => {
                // Check added nodes
                if (mutation.addedNodes.length) {
                    return Array.from(mutation.addedNodes).some(node => {
                        if (node.id === 'qr--bar') return true;
                        if (node.querySelector && node.querySelector('#qr--bar')) return true;
                        return false;
                    });
                }
                return false;
            });
            
            if (shouldTryIntegrate) {
                integrateQRBar();
            }
        });
        
        // Observe the whole document with a focus on childList and subtree
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    }, 1000); // Start observing after a short delay to ensure main UI is loaded
}

// Initial setup function
async function setup() {
    // Load extension settings
    loadSettings();
    
    // Initialize event listeners for profile and preset switching
    try {
        const { initializeEventListeners } = await import('./scripts/utils/presetUtils.js');
        initializeEventListeners();
        console.log(`${extensionName}: Event listeners initialized for profile/preset switching`);
    } catch (error) {
        console.warn(`${extensionName}: Could not initialize event listeners:`, error);
    }
    
    // Initial UI update - executes after settings are verified loaded
    updateExtensionButtons(); // Initial button creation/update
    // Start the QR Bar integration
    startQRBarIntegration();
    // Setup mutation observer
    setupQRMutationObserver();
    // Initialize listeners for guided continue functionality
    initGuidedContinueListeners();
}

// --- Preset Installation ---
// Installs the text completion preset defined within GGSytemPrompt.json if it doesn't exist.
// This file should be a full preset object exported from SillyTavern.
async function installPreset() {
    const presetFileName = 'GGSytemPrompt.json';
    // Derive the preset name from the filename (matching manual import behavior)
    const presetName = presetFileName.replace(/\.json$/i, ''); // Remove .json extension case-insensitively
    // Preset type for Chat Completion parameters (OpenAI/ChatGPT style models)
    const presetApiId = 'openai'; 
    // Construct the path relative to the SillyTavern root
    const presetPath = `scripts/extensions/third-party/${extensionName}/${presetFileName}`;

    try {
        const response = await fetch(presetPath);

        if (!response.ok) {
            console.error(`${extensionName}: Failed to fetch ${presetFileName}. Status: ${response.status}`);
            if (response.status === 404) {
                 console.error(`${extensionName}: Make sure '${presetFileName}' exists in the '${extensionName}' extension folder.`);
            }
            return;
        }

        // Read the full preset data from the JSON file
        const presetData = await response.json(); 

        // Validate internal structure: Must have a prompts array with at least one entry containing name and content.
        // Keep this validation even for chat completion presets to ensure the file has the right structure
        if (!presetData || typeof presetData !== 'object' || 
            !Array.isArray(presetData.prompts) || presetData.prompts.length === 0 || 
            !presetData.prompts[0].name || typeof presetData.prompts[0].content !== 'string') {
            console.error(`${extensionName}: Invalid internal structure in ${presetFileName}. It must be an object containing a 'prompts' array, where the first element has 'name' and 'content' properties. Received structure:`, presetData);
            return;
        }

        const presetManager = getPresetManager(presetApiId);

        if (!presetManager) {
            console.error(`${extensionName}: Could not get Preset Manager for apiId '${presetApiId}'.`);
            return;
        }

        // Store the currently selected preset name/value before we install ours
        let currentPresetName = null;
        try {
            // Get the currently selected option
            const $select = $(presetManager.select);
            const currentValue = $select.val();
            
            if (presetManager.isKeyedApi()) {
                // For keyed APIs (like 'openai'), the value is the name
                currentPresetName = currentValue;
            } else {
                // For indexed APIs, we need to get the text of the selected option
                currentPresetName = $select.find('option:selected').text();
            }
        } catch(err) {
            console.warn(`${extensionName}: Could not determine current preset: ${err}`);
        }

        // Check if preset already exists using the filename-derived name
        const existingPreset = presetManager.findPreset(presetName);

        if (existingPreset !== undefined && existingPreset !== null) {
            // console.log(`${extensionName}: Preset "${presetName}" (${presetApiId}) already exists. Skipping installation.`);
        } else {
            // console.log(`${extensionName}: Preset "${presetName}" (${presetApiId}) not found. Attempting to save...`);
            // Save the entire original presetData object, using the filename-derived name.
            // This matches how performMasterImport handles chat completion presets.
            await presetManager.savePreset(presetName, presetData);
            // console.log(`${extensionName}: Preset "${presetName}" (${presetApiId}) successfully saved (using full data structure and filename).`);
            
            // If we had a previously selected preset, switch back to it
            if (currentPresetName && currentPresetName !== presetName) {
                try {
                    // This uses jQuery to select the option and trigger the change event
                    // This is the same way PresetManager does it internally
                    setTimeout(() => {
                        const $select = $(presetManager.select);
                        if (presetManager.isKeyedApi()) {
                            $select.val(currentPresetName).trigger('change');
                        } else {
                            // For indexed APIs, find the option with the matching text
                            const $option = $select.find(`option:contains("${currentPresetName}")`);
                            if ($option.length > 0) {
                                $select.val($option.val()).trigger('change');
                            }
                        }
                        // console.log(`${extensionName}: Restored previous ${presetApiId} preset: "${currentPresetName}"`);
                    }, 100); // Small delay to ensure the DOM has updated
                } catch(err) {
                    console.warn(`${extensionName}: Could not restore previous preset: ${err}`);
                }
            }
        }

    } catch (error) {
        console.error(`${extensionName}: Error during preset installation:`, error);
        if (error instanceof SyntaxError) {
             console.error(`${extensionName}: Check if ${presetFileName} contains valid JSON.`);
        }
    }
}

// Run setup after page load
$(document).ready(async function () {
    const context = getContext(); // Get the context here

    // Clear debug messages on page refresh to prevent memory buildup
    clearDebugMessages();

    setup(); // Initial setup of settings, UI elements etc.

    // Register listeners for profile/preset change events (needed by presetUtils.js's
    // switching system for Impersonate profile/preset detection).
    console.log(`${extensionName}: Registering profile/preset change event listeners.`);
    context.eventSource.makeLast(context.eventTypes.CONNECTION_PROFILE_LOADED, (...args) => {
        const profileName = args[0];
        console.log(`${extensionName}: Profile change detected: "${profileName}"`);
        window.dispatchEvent(new CustomEvent('gg-profile-changed', { detail: { profileName } }));
    });
    context.eventSource.makeLast(context.eventTypes.PRESET_CHANGED, (...args) => {
        const presetInfo = args[0];
        console.log(`${extensionName}: Preset change detected:`, presetInfo);
        window.dispatchEvent(new CustomEvent('gg-preset-changed', { detail: { presetInfo } }));
    });

    // Settings Panel Setup (runs with delay to allow main UI to render)
    setTimeout(() => {
        loadSettingsPanel(context); // Pass context
    }, 1000);

    // Attempt to install the preset (can run relatively early)
    installPreset();
    
    // Initialize other scripts that need context or should run on ready

    // Also set up a mutation observer to detect when the QR bar might be added/removed
    const observer = new MutationObserver(() => {
        integrateQRBar();
    });
    
    // Start observing after a delay to ensure main UI is loaded
    setTimeout(() => {
        const sendForm = document.getElementById('send_form');
        if (sendForm) {
            observer.observe(sendForm, { childList: true, subtree: true });
        }
    }, 2000);

    // Delayed check for QR bar integration
    setTimeout(() => {
        const sendForm = document.getElementById('send_form');
        if (sendForm && !document.getElementById('gg-qr-container')) {
            integrateQRBar(sendForm);
        }
        // Fallback if send_form is not immediately available
        else if (!sendForm) {
            const qrObserver = new MutationObserver((mutationsList, obs) => { // Renamed observer to avoid conflict
                const sendFormElement = document.getElementById('send_form'); // Renamed variable
                if (sendFormElement) {
                    if (!document.getElementById('gg-qr-container')) {
                        integrateQRBar(sendFormElement);
                    }
                    obs.disconnect(); // Stop observing once found and integrated
                }
            });
            qrObserver.observe(document.body, { childList: true, subtree: true });
        }
    }, 2000);

    // Check extension version and notify if updated
    checkVersionAndNotify();
}); // END OF $(document).ready()

// Export settings helpers for settingsPanel.js import
export { loadSettings, updateSettingsUI, addSettingsEventListeners };

// Function to check version and show notification popup
async function checkVersionAndNotify() {
    if (!extension_settings[extensionName]) {
        console.warn(`${extensionName}: Extension settings not found, skipping version check.`);
        return;
    }

    const currentVersionInSettings = extension_settings[extensionName].LastPatchNoteVersion;
    const defaultVersion = defaultSettings.LastPatchNoteVersion;

    // If version in settings is undefined, null, empty, or older than default
    if (!currentVersionInSettings || currentVersionInSettings < defaultVersion) {
        const popupTitle = `${extensionName} v${defaultVersion} Updated`;
        const messageContent = `This version includes an update to Auto-Triggered Guides: they now also run when you use the normal SillyTavern Send button (or press Enter to send), in addition to when using the Guided Response button.\n\nMany of the default Prompts for the Guides have also been updated. If you are still using the defaults, you might want to get the new defaults for a better experience.`;
        
        const userAcknowledged = await showVersionNotification(popupTitle, messageContent);

        if (userAcknowledged) {
            extension_settings[extensionName].LastPatchNoteVersion = defaultVersion;
            await saveSettingsDebounced();
        } else {
        }
    }
}

// Expose functions to the global scope for buttons or STScripts
window.GuidedGenerations = {
    guidedSwipe,
    guidedContinue,
    undoLastGuidedAddition, // Expose new function
    revertToOriginalGuidedContinue, // Expose new function
    guidedResponse,
};

/**
 * Debug function for the profile system
 */
export async function debugProfileSystem() {
    const statusElement = document.getElementById('profileDebugStatus');
    if (!statusElement) {
        console.error(`[${extensionName}] Debug status element not found`);
        return;
    }

    try {
        statusElement.textContent = 'Testing profile system...';
        
        // Test getCurrentProfile
        const currentProfile = await getCurrentProfile();
        console.log(`[${extensionName}] Current Profile:`, currentProfile);
        
        // Test getProfileList
        const profileList = await getProfileList();
        console.log(`[${extensionName}] Profile List:`, profileList);
        
        if (Array.isArray(profileList) && profileList.length > 0) {
            statusElement.textContent = `✓ Found ${profileList.length} profiles. Current: ${currentProfile || 'None'}`;
            statusElement.style.color = 'green';
        } else {
            statusElement.textContent = `⚠ No profiles found. Current: ${currentProfile || 'None'}`;
            statusElement.style.color = 'orange';
        }
        
        // Refresh the profile dropdowns
        await updateSettingsUI();
        
    } catch (error) {
        console.error(`[${extensionName}] Error in debugProfileSystem:`, error);
        statusElement.textContent = `✗ Error: ${error.message}`;
        statusElement.style.color = 'red';
    }
}

/**
 * Populates a preset dropdown with the current profile's presets
 * @param {HTMLElement} presetDropdown - The preset dropdown element to populate
 */
async function populatePresetDropdown(presetDropdown) {
    try {
        // Get the guide name from the dropdown ID
        const guideName = presetDropdown.id.replace('preset', '');
        const profileFieldName = `profile${guideName}`;
        
        // Check if a profile is already selected for this guide
        const selectedProfile = extension_settings[extensionName]?.[profileFieldName];
        
        if (selectedProfile && selectedProfile.trim() !== '') {
            debugLog(`[${extensionName}] Profile "${selectedProfile}" already selected for ${guideName}, using its presets`);
            
            // Get the API type for the selected profile
            const { getProfileApiType, getPresetsForApiType } = await import('./scripts/persistentGuides/guideExports.js');
            const apiType = await getProfileApiType(selectedProfile);
            
            if (apiType) {
                // Get presets for this profile's API type
                const presetList = await getPresetsForApiType(apiType);
                if (presetList) {
                    await populatePresetDropdownWithList(presetDropdown, presetList);
                    return;
                }
            }
            
            debugLog(`[${extensionName}] Failed to get presets for selected profile "${selectedProfile}", falling back to current profile`);
        }
        
        // Fallback: use current profile's presets
        debugLog(`[${extensionName}] Using current profile's presets for ${guideName}`);
        const context = getContext();
        const presetManager = context?.getPresetManager?.();
        
        if (presetManager) {
            const presetList = presetManager.getPresetList();
            await populatePresetDropdownWithList(presetDropdown, presetList);
        } else {
            debugLog(`[${extensionName}] No preset manager available for current profile`);
        }
    } catch (error) {
        console.error(`[${extensionName}] Error populating preset dropdown:`, error);
    }
}
