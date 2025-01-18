#!/bin/bash
tmux kill-session -t anvil
# Source .env file if it exists
if [ -f "$(dirname "$0")/../.env" ]; then
    source "$(dirname "$0")/../.env"
fi

# Set default environment variables if not set
export NODE_ENV="${NODE_ENV:-TEST}"
export FORK_RPC_URL="${FORK_RPC_URL:-https://arb1.arbitrum.io/rpc}"

# Exit on error
set -e

# Function to check if tmux session exists
tmux_session_exists() {
    tmux has-session -t $1 2>/dev/null
}

# Function to start anvil in tmux if not already running
start_anvil() {
    if ! tmux_session_exists "anvil"; then
        echo "🔨 Starting Anvil development network in tmux session..."
        tmux new-session -d -s anvil "anvil -m 'casual vacant letter raw trend tool vacant opera buzz jaguar bridge myself'"
        sleep 2

        # Check if anvil started successfully by looking for its output in tmux
        if ! tmux capture-pane -pt anvil | grep -q "Listening on"; then
            echo "Error: Failed to start Anvil"
            exit 1
        fi
        echo "✅ Anvil started successfully in tmux session 'anvil'"
    else
        echo "✅ Anvil already running in tmux session 'anvil'"
    fi
}

# Check required environment variables
required_vars=(
    "RANKIFY_CONTRACTS_PATH"
    "MULTIPASS_PATH"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var environment variable is not set"
        exit 1
    fi
done

# Always try to start anvil, but it will skip if already running
start_anvil

echo "🚀 Setting up local development environment..."

# Function to setup a repository
setup_repo() {
    local repo_path=$1
    local repo_name=$2

    echo "📦 Setting up $repo_name..."

    # Check if directory exists
    if [ ! -d "$repo_path" ]; then
        echo "Error: $repo_name directory not found at $repo_path"
        exit 1
    fi

    # Navigate to repository
    cd "$repo_path"

    # Install dependencies
    echo "Installing dependencies for $repo_name..."
    pnpm install

    # Run local deployment script
    if [ -f "playbook/utils/deploy-to-local-anvil.sh" ]; then
        echo "Deploying $repo_name contracts..."
        pnpm hardhat clean
        pnpm hardhat compile && rm -rf deployments/localhost
        bash playbook/utils/deploy-to-local-anvil.sh
    else
        echo "Warning: deployment script not found for $repo_name"
    fi

    # Return to original directory
    cd -
}

# Setup each repository
setup_repo "$MULTIPASS_PATH" "multipass"
sleep 1
setup_repo "$RANKIFY_CONTRACTS_PATH" "rankify-contracts"

# Link dependencies in SDK
echo "🔗 Linking dependencies in SDK..."
cd "$(dirname "$0")/.."
pnpm install

# Create local links
echo "Creating local links..."
pnpm link "$RANKIFY_CONTRACTS_PATH"
pnpm link "$MULTIPASS_PATH"

echo "✅ Local development environment setup complete!"
echo "🔨 Anvil is running in tmux session 'anvil'"
echo "To view Anvil logs: tmux attach -t anvil"
echo "To detach from Anvil logs: Ctrl+B then D"
echo "To stop Anvil: tmux kill-session -t anvil"
