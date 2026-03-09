---
trigger: always_on
---

## Browser Subagent (WSL2 Environment)
Before using the `browser_subagent` tool in a WSL2 environment, you MUST first run the `/start-browser` workflow to launch Chrome/Chromium in CDP mode. Without this step, browser_subagent will fail with "CDP port not responsive" errors.
Global Workflow: `/start-browser`