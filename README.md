# Guided Generations Extension for SillyTavern

This fork of Guided Generations trims the original extension down to a smaller set of writing tools focused on guided prompting and impersonation. Several upstream features were removed, and this fork adds an Impersonate-specific World Info budget override for better control when using smaller-context models.

## Disclaimer

This fork is very much a "vibe coded" project. I am not a programmer, and most changes were made with heavy help from LLMs. That means things may be rough around the edges, but the goal is still simple: keep the extension useful, focused, and easier to maintain for my own setup.

See `JSDoc.md` for code-level documentation.

---

## Features

### Guided Response
Injects temporary instructions before the model generates the next reply.

- Type guidance into the input box and press the Guided Response button.
- The extension injects your prompt as an ephemeral instruction, then restores your original input.
- In group chats, it can prompt you to choose which member should respond.
- You can customize both the prompt template and injection depth.

### Guided Swipe
Regenerates the latest AI reply with fresh guidance.

- Type new instructions and press Guided Swipe.
- If the input is empty, it performs a plain swipe.
- If guidance is present, it injects the instruction first, then generates a new swipe.
- You can customize both the prompt template and injection depth.

### Guided Continue
Continues the last message using your current input as guidance.

- Enter continuation instructions and run Guided Continue.
- The extension tracks the added text so you can undo the last guided addition or revert fully to the original message.
- Your input is restored after the action completes.
- The continuation prompt is configurable in settings.

### Impersonate (1st / 2nd / 3rd Person)
Expands a short outline into a fuller response from the selected perspective.

- First-person impersonation is enabled by default.
- Second- and third-person buttons can be enabled in settings.
- Each impersonation mode has its own prompt template, profile, and preset selection.
- The extension preserves and restores your input around impersonation runs.

### Input Recovery
Restores the previously captured input text.

- Useful after Guided Response, Guided Swipe, Guided Continue, or Impersonate actions.

### Profile and Preset Switching
Lets specific actions run with different model setups.

- Each impersonation mode can use its own profile and preset.
- The extension temporarily switches before execution, then restores your previous setup.
- Safety timeout settings are available for both profile and preset switching.

### Impersonate World Info Budget Override
Adds a fork-specific World Info budget control for impersonation.

- You can override the global World Info `Context %` only during impersonation calls.
- This is useful when your impersonation model has a smaller context window than your normal chat model.
- The original World Info budget is restored automatically after the impersonation finishes.
- Set the value to `Off` to leave SillyTavern's global World Info budget unchanged.

### Debug Logging
Provides optional logging for troubleshooting.

- When enabled, debug logs are captured and written to the browser console.
- Logs can be copied, downloaded as a `.txt` file, or cleared from the settings panel.

---

## Removed from the Original Version

This fork no longer includes much of the broader feature set described in the original Guided Generations README.

Removed features include:

- Persistent Guides and related guide management menus
- Situational, Thinking, Clothes, State, Rules, and Custom guides
- Corrections
- Spellchecker
- Simple Send
- Edit Intros
- Other auxiliary tool collections from the original package

If you are coming from the upstream README, treat this fork as a focused subset rather than a drop-in documentation match.

---

## Installation

1. In SillyTavern's Extension Manager, choose **Install Extension**.
2. Enter your fork's GitHub repository URL.
3. Reload SillyTavern if needed.

---

## Usage

- The extension adds Guided Generations action buttons near the chat input area.
- Which buttons appear depends on your settings.
- Guided Response, Guided Swipe, Guided Continue, and the three Impersonate modes all use the current input box as their source text.
- Input Recovery restores the last captured input if an action replaced or cleared it during processing.

---

## Settings

All settings are available from SillyTavern's Extensions settings panel.

### Action Buttons
- Show or hide:
  - Impersonate (1st Person)
  - Impersonate (2nd Person)
  - Impersonate (3rd Person)
  - Guided Continue
  - Guided Response
  - Guided Swipe

### UI Preferences
- **Integrate QR Bar into GG Button Area**
- **Enable Debug Logging**

### Injection Settings
- **Send Injections as**: choose `system`, `assistant`, or `user`

### Preset Usage
- Assign a profile and preset for:
  - Impersonate 1st
  - Impersonate 2nd
  - Impersonate 3rd
- Refresh profile dropdowns from the settings panel.
- Configure safety delays for profile and preset switching.

### Prompt Overrides
- Customize prompt templates for:
  - Impersonate 1st
  - Impersonate 2nd
  - Impersonate 3rd
  - Guided Continue
  - Guided Response
  - Guided Swipe
- Use `{{input}}` where the current input text should be inserted.

### Depth Controls
- Set custom injection depth for:
  - Guided Response
  - Guided Swipe

### World Info Budget Override
- **World Info Budget Override (Impersonate)**
- Temporarily overrides SillyTavern's global World Info `Context %` only while an impersonation action runs.
- `0` / `Off` disables the override.

---

## License

This project remains licensed under the GNU General Public License v3.0. See `LICENSE` for details.