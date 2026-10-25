# The Copilot (Claude) in every app

Rule for the suite: every Office In 1 app has Claude built in, for help and for correcting text, tables and code.

## How an app adds it

1. Put `<CopilotButton>` first in the ribbon's quick area (right of the tabs) and call `useCopilotShortcut` (Ctrl+Shift+Space).
2. Put `<Copilot host={…} ai={shell.ai} onClose={…} />` at the side of the work area (a flex row). On phones it becomes a bottom sheet by itself.
3. Describe the app with a `CopilotHost` (`src/ui/Copilot.tsx`):
   - `role`: what the app is and how its content works (for Claude: formula syntax, file names…);
   - `context()`: what is selected or open, as text, with a label like "the selection (42 words)" and `at` (where to put answers back);
   - `actions`: quick actions (a prompt, choices like languages, a `fill` text to finish, or a `run` that does a whole job itself);
   - `applies`: buttons under every answer that put it back (replace, insert, put in the cell…).

Examples: `src/modules/letter/copilot.ts`, `src/modules/class/copilot.ts`, `src/modules/code/copilot.ts`.

## The key

The user pastes their own Claude API key (console.anthropic.com) in the panel. It is kept in this browser's localStorage only,
sent only to api.anthropic.com, and never put in files, autosaves or the repo. "Remove the key from this device" forgets it.
Requests use Claude Opus 5.5 by default (Sonnet 5.5 and Haiku 5.5 can be picked), stream their answer, and opt in to the API's
server-side fallback so a request declined by a safety check is retried on a fitting model.

Before OI1 goes public, a small proxy (for example a Cloudflare Worker holding one key, with sign-in and limits) can replace
the user's key: only `src/shell/ai.ts` changes.
