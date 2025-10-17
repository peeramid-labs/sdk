---
"@peeramid-labs/sdk": patch
---

## Development Infrastructure Improvements and Bug Fixes

### 🚀 New Features
- **Indexer Integration**: Added `--indexer` flag to deploy-contracts script to automatically launch Envio indexer after contract deployment
- **Enhanced CLI Arguments**: Improved deploy-contracts script with proper flag parsing (`--clean`, `--indexer`)

### 🐛 Bug Fixes
- **Vote Validation Fix**: Fixed points calculation bug in GameMaster where points were being subtracted incorrectly (using `maxPoints` instead of `maxPoints * maxPoints`)

### 🔧 Improvements
- **Simplified Dependencies**: Removed multipass from deployment process, focusing on core rankify contracts
- **Better Session Management**: Added ability to kill existing Anvil sessions when using `--clean` flag
- **Enhanced Documentation**: Updated README with clearer usage instructions and new CLI options
- **Improved Error Handling**: Better script reliability with enhanced session detection and management

### 📝 Documentation Updates
- Updated deployment script usage examples with new CLI argument format
- Added comprehensive CLI argument documentation
- Improved setup instructions for local development environment

### 🛠️ Technical Changes
- Refactored deploy-contracts.sh with proper argument parsing using while loop
- Added tmux session management for indexer with error checking
- Enhanced environment variable validation (removed MULTIPASS_PATH requirement)
- Improved script error handling and user feedback
- Fixed mathematical error in vote points calculation algorithm
