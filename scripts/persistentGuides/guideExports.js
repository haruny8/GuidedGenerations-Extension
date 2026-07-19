/**
 * @file Central import/export hub for all GuidedGenerations extension modules.
 * This file serves as a single point of entry for all imports, eliminating path depth issues.
 *
 * TRIMMED VERSION: Only Impersonate (1st/2nd/3rd) + Guided Continue/Response/Swipe are retained.
 * All Persistent Guides, Tools, Stat Tracker, and Fun Prompts features have been removed.
 */

// External dependencies (SillyTavern)
import { getContext, extension_settings, renderExtensionTemplateAsync } from '../../../../../extensions.js';
import { chat, eventSource, event_types, saveChatConditional, addOneMessage } from '../../../../../../script.js';

// Core extension constants and functions (defined locally to avoid circular dependency)
const extensionName = "GuidedGenerations-Extension";

// Conditional logging utility that only logs when debug mode is enabled
function debugLog(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        console.log(`[${extensionName}][DEBUG]`, ...args);
    }
}

// Conditional warning utility that only logs when debug mode is enabled
function debugWarn(...args) {
    if (extension_settings[extensionName]?.debugMode) {
        console.warn(`[${extensionName}][DEBUG]`, ...args);
    }
}

// Shared state functions for impersonate input management
let previousImpersonateInput = '';
let lastImpersonateResult = '';

function setPreviousImpersonateInput(input) {
    previousImpersonateInput = input;
}

function getPreviousImpersonateInput() {
    return previousImpersonateInput;
}

function setLastImpersonateResult(result) {
    lastImpersonateResult = result;
}

function getLastImpersonateResult() {
    return lastImpersonateResult;
}

// Group chat detection function
function isGroupChat() {
    const context = getContext();
    return context && context.groupId && context.groups;
}

// Settings management functions - imported from index.js
import { loadSettings, updateSettingsUI, addSettingsEventListeners, debugProfileSystem, getDebugMessages, clearDebugMessages, getDebugMessagesAsText, debugError } from '../../index.js';

// Default settings object (small local subset used by settingsPanel.js's "Default" buttons)
const defaultSettings = {
    showImpersonate1stPerson: true,
    showImpersonate2ndPerson: false,
    showImpersonate3rdPerson: false,
    showGuidedContinue: false,
    showGuidedResponse: true,
    showGuidedSwipe: true,
    integrateQrBar: true,
    debugMode: false,
    injectionEndRole: 'system'
};

// Utility functions
import { handleSwitching, getProfileApiType, getPresetsForApiType, getCurrentProfile, getProfileList, switchToProfile, switchToPreset, withProfile, getConnectApiMap, initializeEventListeners, extractApiIdFromApiType, captureWorldInfoBudget, applyImpersonateWorldInfoBudget, restoreWorldInfoBudget } from '../utils/presetUtils.js';

// Main script functions
import { guidedSwipe, generateNewSwipe } from '../guidedSwipe.js';
import { guidedContinue, initGuidedContinueListeners, undoLastGuidedAddition, revertToOriginalGuidedContinue } from '../guidedContinue.js';
import { guidedResponse } from '../guidedResponse.js';
import { guidedImpersonate } from '../guidedImpersonate.js';
import { guidedImpersonate2nd } from '../guidedImpersonate2nd.js';
import { guidedImpersonate3rd } from '../guidedImpersonate3rd.js';
import { loadSettingsPanel } from '../settingsPanel.js';

// Export everything
export {
    // Context and settings
    getContext,
    extension_settings,
    extensionName,
    debugLog,
    debugWarn,
    debugError,

    // SillyTavern dependencies
    chat,
    eventSource,
    event_types,
    saveChatConditional,
    addOneMessage,
    renderExtensionTemplateAsync,

    // Utility functions
    handleSwitching,
    getProfileApiType,
    getPresetsForApiType,
    getCurrentProfile,
    getProfileList,
    switchToProfile,
    switchToPreset,
    withProfile,
    getConnectApiMap,
    initializeEventListeners,
    extractApiIdFromApiType,
    captureWorldInfoBudget,
    applyImpersonateWorldInfoBudget,
    restoreWorldInfoBudget,

    // Main script functions
    guidedSwipe,
    generateNewSwipe,
    guidedContinue,
    initGuidedContinueListeners,
    undoLastGuidedAddition,
    revertToOriginalGuidedContinue,
    guidedResponse,
    guidedImpersonate,
    guidedImpersonate2nd,
    guidedImpersonate3rd,
    loadSettingsPanel,

    // Settings and other
    loadSettings,
    updateSettingsUI,
    addSettingsEventListeners,
    debugProfileSystem,
    defaultSettings,
    isGroupChat,
    setPreviousImpersonateInput,
    getPreviousImpersonateInput,
    setLastImpersonateResult,
    getLastImpersonateResult,

    // Debug logging functions
    getDebugMessages,
    clearDebugMessages,
    getDebugMessagesAsText,
};
