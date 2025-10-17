# SDK

This is SDK for use with Rankify game. You can ease interaction with smart contracts.

## Installation

```bash
# Using npm
npm install @peeramid-labs/sdk

# Using yarn
yarn add @peeramid-labs/sdk

# Using pnpm
pnpm add @peeramid-labs/sdk
```

## CLI Usage

The SDK includes a command-line interface for interacting with Peeramid contracts:

```bash
# Set up environment variables
export RPC_URL="your-rpc-url"
export PRIVATE_KEY="your-private-key"

# List available commands
peeramid --help

# Examples:
peeramid distributions list
peeramid fellowship create
peeramid instances list
peeramid multipass domains create
```

## Development

## Prerequisites

Before setting up the local development environment, ensure you have the following installed:

1. **Node.js and pnpm**

   ```bash
   # Using homebrew
   brew install node
   npm install -g pnpm
   ```

2. **Foundry (for Anvil)**

   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. **tmux**
   ```bash
   # Using homebrew
   brew install tmux
   ```

## Local Development Setup

To set up your local development environment:

1. Create your environment file:

   ```bash
   mkdir -p .secrets
   cp samples/<network>.env.example .secrets/<network>.env
   ```

   Then edit `.env` to set your local repository paths.

2. Set the required environment variables:

   ```bash
   export RANKIFY_CONTRACTS_PATH="/path/to/rankify/contracts"
   export MULTIPASS_PATH="/path/to/multipass"
   ```

3. Make the setup script executable:

   ```bash
   chmod +x scripts/deploy-contracts.sh
   ```
Possible CLI arguments for deployment:

```bash
./scripts/deploy-contracts.sh --clean  #rebuilds and redeploys contracts and all upstream deps
./scripts/deploy-contracts.sh --indexer #launches envio indexer right after contracts (requires ../envio checked out)
```


4. Run the setup script:
   ```bash
   ./scripts/deploy-contracts.sh <network> --clean # set last argument to clean the deployments & artifacts
   ```

This will:

- Start a local Anvil development network in a tmux session (for localhost network)
- Install dependencies for all repositories
- Run local deployment scripts (`playbook/utils/deploy-to-local-anvil.sh`) in each repository
- Set up local pnpm links between packages

The script uses a fixed mnemonic for consistent addresses across runs.

### Managing Anvil

- View Anvil logs: `tmux attach -t anvil`
- Detach from logs: Press `Ctrl+B` then `D`
- Stop Anvil: `tmux kill-session -t anvil`

### Setting requirements on game creation

To set requirements on game creation, you can use the `game create` command with the `--requirement` flag. For example:

```bash
peeramid game create ... --requirement ./req.json
```
works with following JSON file structure:
```JSON
{
  "ethValues": {
    "have": "1",
    "lock": "2",
    "burn": "3",
    "pay": "4",
    "stake": "5"
  },
  "contracts": [
    {
      "contractAddress": "0x98fBE64861B331674e195E1A0b2fA303324c83e1",
      "contractId": 1,
      "contractType": 2,
      "contractRequirement": {
        "have": { "data": "0x00", "amount": "100000000000000" },
        "lock": { "data": "0x00", "amount": "100000000000000" },
        "burn": { "data": "0x00", "amount": "100000000000000" },
        "pay": { "data": "0x00", "amount": "100000000000000" },
        "stake": { "data": "0x00", "amount": "100000000000000" }
      }
    }
  ]
}
```

## Documentation

The SDK comes with comprehensive API documentation generated using TypeDoc. The documentation is automatically generated during the package build process and is included in the npm package.

### Generating Documentation

To generate the documentation locally:

```bash
pnpm run docs
```

This will create a `docs` directory with the generated documentation.

For development, you can use the watch mode:

```bash
pnpm run docs:watch
```

### Accessing Documentation

- **Local Development**: Open `docs/index.html` in your browser after generating the documentation
- **Published Package**: Documentation is available through the npm package page
