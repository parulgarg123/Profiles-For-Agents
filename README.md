# Agent Profiles

A sleek, native macOS application designed to help you manage and quickly switch between different configuration profiles for your favorite LLM CLI agents (e.g., Claude Code, Rovo CLI, Cline, Cursor). 

Under the hood, Agent Profiles creates isolated Git branches inside your tool's configuration directory, allowing you to seamlessly maintain different sets of MCP Servers, Custom Instructions, and Skills for different projects (Work, Personal, Experiments, etc.).

## Features

- **Native macOS Experience:** Clean, minimal UI with seamless Menu Bar (Tray) integration for quick access.
- **Git-Backed Isolation:** Safely switches profiles without data loss. A background watcher automatically auto-commits changes you make.
- **Profile Preview:** Peek inside a profile to see exactly which MCP servers and skills are active before switching.
- **Blank Slate Mode:** Create completely blank profiles with no history to start fresh.

## Installation

### 1. NPM Global Installation
If you have Node.js installed, you can install the CLI globally:
```bash
# Clone the repository
git clone <repo-url>
cd ProfilesForAgents

# Install dependencies and link the CLI globally
npm install
npm install -g .
```
You can now launch the app from anywhere by typing `agent-profiles` in your terminal.

### 2. Brew Installation (DMG)
If you prefer a standard macOS application:
```bash
# Generate the native Mac .dmg installer
npm run package
```
After the build completes, look in the `dist/mac-arm64` directory for the `.dmg` file. Double-click it to install Agent Profiles to your Applications folder.

## Development

To run the app locally in development mode with Hot Module Replacement (HMR):
```bash
npm install
npm run dev
```

## How It Works

1. On your first launch, complete the **Onboarding Flow** by selecting your primary AI tool (e.g., Claude Code `~/.claude`).
2. The app initializes a lightweight Git repository inside the config folder if one doesn't exist.
3. Use the app to create a new profile (branch).
4. As you use your CLI agent, the background watcher saves changes to your active profile automatically.
5. Click "Switch to Profile" to seamlessly swap your entire tool's context!
