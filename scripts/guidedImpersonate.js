// scripts/guidedImpersonate.js
import { getContext, extension_settings, extensionName, debugLog, handleSwitching, getPreviousImpersonateInput, setPreviousImpersonateInput, getLastImpersonateResult, setLastImpersonateResult, captureWorldInfoBudget, applyImpersonateWorldInfoBudget, restoreWorldInfoBudget } from './persistentGuides/guideExports.js'; // Import from central hub

const guidedImpersonate = async () => {
    const textarea = document.getElementById('send_textarea');
    if (!textarea) {
        console.error('[GuidedGenerations] Textarea #send_textarea not found.');
        return;
    }
    const currentInputText = textarea.value;
    const lastGeneratedText = getLastImpersonateResult(); // Use getter

    // Check if the current input matches the last generated text
    if (lastGeneratedText && currentInputText === lastGeneratedText) {
        textarea.value = getPreviousImpersonateInput(); // Use getter
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return; // Restoration done, exit
    }

    // --- If not restoring, proceed with impersonation ---
    setPreviousImpersonateInput(currentInputText); // Use setter

    // Capture the original profile BEFORE any switching happens
    const context = getContext();
    let originalProfile = '';
    if (context && typeof context.executeSlashCommandsWithOptions === 'function') {
        try {
            // Get current profile before any switching
            const { getCurrentProfile } = await import('./persistentGuides/guideExports.js');
            originalProfile = await getCurrentProfile();
            debugLog(`[Impersonate-1st] Captured original profile before switching: "${originalProfile}"`);
        } catch (error) {
            debugLog(`[Impersonate-1st] Could not get original profile:`, error);
        }
    }

    // Handle profile and preset switching using unified utility
    const profileKey = 'profileImpersonate1st';
    const presetKey = 'presetImpersonate1st';
    const profileValue = extension_settings[extensionName]?.[profileKey] ?? '';
    const presetValue = extension_settings[extensionName]?.[presetKey] ?? '';
    
    // Debug: Log the exact values being retrieved
    debugLog(`[Impersonate-1st] Profile key: "${profileKey}"`);
    debugLog(`[Impersonate-1st] Preset key: "${presetKey}"`);
    debugLog(`[Impersonate-1st] Profile value from settings: "${profileValue}"`);
    debugLog(`[Impersonate-1st] Preset value from settings: "${presetValue}"`);
    debugLog(`[Impersonate-1st] All profile settings:`, Object.keys(extension_settings[extensionName] || {}).filter(key => key.startsWith('profile')));
    
    debugLog(`[Impersonate-1st] Using profile: ${profileValue || 'current'}, preset: ${presetValue || 'none'}`);
    
    const { switch: switchProfileAndPreset, restore } = await handleSwitching(profileValue, presetValue, originalProfile);

    // Use user-defined impersonate prompt override
    const promptTemplate = extension_settings[extensionName]?.promptImpersonate1st ?? '';
    const filledPrompt = promptTemplate.replace('{{input}}', currentInputText);

    // Build STScript without preset switching
    const stscriptCommand = `/impersonate await=true ${filledPrompt} |`;
    const fullScript = `// Impersonate guide|\n${stscriptCommand}`;

    // Capture World Info budget so it can be temporarily overridden for this Impersonate call
    let wiBudgetSnapshot = null;
    const impersonateWiBudget = extension_settings[extensionName]?.impersonateWorldInfoBudget ?? 0;

    try {
        const context = getContext();
        if (typeof context.executeSlashCommandsWithOptions === 'function') {
            debugLog('[Impersonate-1st] About to switch profile and preset...');
            
            // Switch profile and preset before executing
            await switchProfileAndPreset();

            // Apply Impersonate-specific World Info budget override, if configured
            if (impersonateWiBudget > 0) {
                wiBudgetSnapshot = captureWorldInfoBudget();
                applyImpersonateWorldInfoBudget(impersonateWiBudget);
            }
            
            debugLog('[Impersonate-1st] Profile and preset switch complete, about to execute STScript...');
            
            // Execute the command and wait for it to complete
            await context.executeSlashCommandsWithOptions(fullScript); 
            
            debugLog('[Impersonate-1st] STScript execution complete, about to restore profile...');
            
            // After completion, read the new input and store it using the setter
            setLastImpersonateResult(textarea.value);
            debugLog('[Impersonate-1st] STScript executed, new input stored in shared state.');

            // Restore World Info budget before restoring profile/preset
            if (wiBudgetSnapshot) {
                restoreWorldInfoBudget(wiBudgetSnapshot);
            }

            // After completion, restore original profile and preset using utility restore function
            await restore();
            
            debugLog('[Impersonate-1st] Profile restore complete');

        } else {
            console.error('[GuidedGenerations] context.executeSlashCommandsWithOptions not found!');
        }
    } catch (error) {
        console.error(`[GuidedGenerations] Error executing Guided Impersonate (1st) stscript: ${error}`);
        setLastImpersonateResult(''); // Use setter to clear shared state on error
        
        debugLog('[Impersonate-1st] Error occurred, about to restore profile...');
        
        // Restore World Info budget on error too
        if (wiBudgetSnapshot) {
            restoreWorldInfoBudget(wiBudgetSnapshot);
        }

        // Restore original profile and preset on error
        await restore();
        
        debugLog('[Impersonate-1st] Profile restore complete after error');
    }
};

// Export the function
export { guidedImpersonate };
