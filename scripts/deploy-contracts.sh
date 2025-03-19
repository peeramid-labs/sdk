#!/bin/bash

# Set default environment variables if not set
export NODE_ENV="${NODE_ENV:-TEST}"
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <network> <clean>"
    exit 1
fi
NETWORK="$1"
CLEAN="$2"
# Exit on error
set -e

# Source .env file if it exists
if [ -f "$(dirname "$0")/../.env" ]; then
    source "$(dirname "$0")/../.env"
fi

# Source network specific environment file if it exists
if [ -f "$(dirname "$0")/../.secrets/$NETWORK.env" ]; then
    source "$(dirname "$0")/../.secrets/$NETWORK.env"
fi

# Function to check if tmux session exists
tmux_session_exists() {
    tmux has-session -t $1 2>/dev/null
}

# Function to start anvil in tmux if not already running
start_anvil() {
    if ! tmux_session_exists "anvil"; then
        echo "🔨 Starting Anvil development network in tmux session..."
        tmux new-session -d -s anvil "anvil -m 'casual vacant letter raw trend tool vacant opera buzz jaguar bridge myself' --steps-tracing  --order fifo"
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
    "RPC_URL"
    "PRIVATE_KEY"
    "RANKIFY_CONTRACTS_PATH"
    "MULTIPASS_PATH"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var environment variable is not set"
        exit 1
    fi
done

# Always try to start anvil if network is localhost, but it will skip if already running
if [ "$NETWORK" = "localhost" ]; then
    start_anvil
fi

echo "🚀 Setting up local development environment..."

# Function to setup a repository
setup_repo() {
    local repo_path=$1
    local repo_name=$2
    local tags=$3
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

    # Deploy contracts
    echo "Deploying $repo_name contracts..."
    if [ "$CLEAN" = "clean" ]; then
        echo "Cleaning up deployments for $NETWORK..."
        pnpm hardhat clean && rm -rf deployments/$NETWORK
    fi

    pnpm build
    pnpm hardhat deploy --network "$NETWORK" --tags "$tags"

    # Verify contracts if VERIFICATION_ENDPOINT is set
    if [ ! -z "$VERIFICATION_ENDPOINT" ]; then
        echo "Verifying deployed contracts using sourcify..."
        pnpm hardhat --network "$NETWORK" sourcify --endpoint "$VERIFICATION_ENDPOINT"
    fi

    # Return to original directory
    cd -
}

# Setup each repository
setup_repo "$MULTIPASS_PATH" "multipass" "multipass,rankify"
setup_repo "$RANKIFY_CONTRACTS_PATH" "rankify-contracts" "ERC7744,MAO,rankify"

echo "✅ Local development environment setup complete!"
echo "🔨 Anvil is running in tmux session 'anvil'"
echo "To view Anvil logs: tmux attach -t anvil"
echo "To detach from Anvil logs: Ctrl+B then D"
echo "To stop Anvil: tmux kill-session -t anvil"
