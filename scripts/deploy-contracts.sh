#!/bin/bash

# Set default environment variables if not set
export NODE_ENV="${NODE_ENV:-TEST}"
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <network> [--clean] [--indexer] [--api] [--fe] [--monitor] [--demo-script] [--multipass]"
    exit 1
fi
NETWORK="$1"
CLEAN=""
INDEXER_FLAG=""
API_FLAG=""
FE_FLAG=""
MONITOR_FLAG=""
DEMO_SCRIPT_FLAG=""
MULTIPASS_FLAG=""

shift # Remove network from arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --clean) CLEAN="clean"; shift ;;
        --indexer) INDEXER_FLAG="true"; shift ;;
        --api) API_FLAG="true"; shift ;;
        --fe) FE_FLAG="true"; shift ;;
        --monitor) MONITOR_FLAG="true"; shift ;;
        --demo-script) DEMO_SCRIPT_FLAG="true"; shift ;;
        --multipass) MULTIPASS_FLAG="true"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

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

# Function to kill anvil tmux session
kill_anvil() {
    if tmux_session_exists "anvil"; then
        echo "🔨 Killing existing Anvil session..."
        tmux kill-session -t anvil
        echo "✅ Anvil session killed"
    fi
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

start_indexer() {
    local clean_flag=$1
    local envio_path
    envio_path="$(dirname "$0")/../../rankify-indexer"
    
    # Kill existing indexer session if clean flag is set
    if [ "$clean_flag" = "clean" ]; then
        if tmux_session_exists "indexer"; then
            echo "🧹 Killing existing indexer session for clean start..."
            tmux kill-session -t indexer
        fi
        
        echo "🧹 Running indexer clean setup..."
        cd "$envio_path"
        pnpm install --force
        pnpm dev:clean
        cd -
    fi
    
    if ! tmux_session_exists "indexer"; then
        echo "📦 Starting Envio indexer in tmux session..."

        local indexer_cmd="cd '${envio_path}' && pnpm install --force && pnpm dev:local"

        # Step 1: Create a new, detached session without a command.
        tmux new-session -d -s indexer

        # Give it a moment to stabilize
        sleep 1

        # Step 2: Send the commands to the session's first window.
        tmux send-keys -t indexer "${indexer_cmd}" C-m

        # Give the process time to start up
        sleep 5

        # Check if the process started successfully.
        # Give more time for the process to start and check for common success indicators
        sleep 3
        local indexer_output
        indexer_output=$(tmux capture-pane -pt indexer)
        
        # Check for various success indicators in indexer output
        if ! echo "$indexer_output" | grep -q -E "(Config file updated|Listening|Running|Started|Success)" && ! echo "$indexer_output" | grep -q -E "(Error|Failed|Exception)"; then
            echo "Warning: Could not determine if indexer started successfully."
            echo "Indexer output preview:"
            echo "$indexer_output" | tail -10
            echo "You can check the indexer status with: tmux attach -t indexer"
            echo "Continuing anyway..."
        else
            echo "✅ Indexer appears to be running"
        fi

        echo "✅ Indexer started successfully in tmux session 'indexer'"
    else
        echo "✅ Indexer already running in tmux session 'indexer'"
    fi
}

start_api() {
    local clean_flag=$1
    local api_path
    api_path="$(dirname "$0")/../../api"
    
    # Kill existing API session if clean flag is set
    if [ "$clean_flag" = "clean" ]; then
        if tmux_session_exists "api"; then
            echo "🧹 Killing existing API session for clean start..."
            tmux kill-session -t api
        fi
        
        echo "🧹 Running API clean setup..."
        cd "$api_path"
        pnpm install --force
        source .secrets/dev.env && pnpm prisma migrate reset --force
        source .secrets/dev.env && pnpm prisma:seed
        cd -
    fi
    
    if ! tmux_session_exists "api"; then
        echo "🚀 Starting API server in tmux session..."

        local api_cmd="cd '${api_path}' && pnpm install --force && pnpm link ../sdk/dist && source .secrets/dev.env && pnpm prisma migrate deploy && pnpm server:dev"

        # Step 1: Create a new, detached session without a command.
        tmux new-session -d -s api

        # Give it a moment to stabilize
        sleep 1

        # Step 2: Send the commands to the session's first window.
        tmux send-keys -t api "${api_cmd}" C-m

        # Give the process time to start up
        sleep 5

        # Check if the process started successfully.
        # Give more time for the process to start and check for common success indicators
        sleep 3
        local api_output
        api_output=$(tmux capture-pane -pt api)
        
        # Check for various success indicators in API output
        if ! echo "$api_output" | grep -q -E "(Server running|Listening|Running|Started|Success)" && ! echo "$api_output" | grep -q -E "(Error|Failed|Exception)"; then
            echo "Warning: Could not determine if API started successfully."
            echo "API output preview:"
            echo "$api_output" | tail -10
            echo "You can check the API status with: tmux attach -t api"
            echo "Continuing anyway..."
        else
            echo "✅ API appears to be running"
        fi

        echo "✅ API started successfully in tmux session 'api'"
    else
        echo "✅ API already running in tmux session 'api'"
    fi
}

start_fe() {
    local clean_flag=$1
    local fe_path
    fe_path="$(dirname "$0")/../../telegram_mini_app"
    
    # Kill existing FE session if clean flag is set
    if [ "$clean_flag" = "clean" ]; then
        if tmux_session_exists "fe"; then
            echo "🧹 Killing existing FE session for clean start..."
            tmux kill-session -t fe
        fi
    fi
    
    if ! tmux_session_exists "fe"; then
        echo "🌐 Starting Frontend in tmux session..."

        local fe_cmd="cd '${fe_path}' && pnpm install && pnpm link ../sdk && pnpm dev"

        # Step 1: Create a new, detached session without a command.
        tmux new-session -d -s fe

        # Give it a moment to stabilize
        sleep 1

        # Step 2: Send the commands to the session's first window.
        tmux send-keys -t fe "${fe_cmd}" C-m

        # Give the process time to start up
        sleep 5

        # Check if the process started successfully.
        # Give more time for the process to start and check for common success indicators
        sleep 3
        local fe_output
        fe_output=$(tmux capture-pane -pt fe)
        
        # Check for various success indicators in FE output
        if ! echo "$fe_output" | grep -q -E "(Local:|Network:|ready|started|compiled)" && ! echo "$fe_output" | grep -q -E "(Error|Failed|Exception)"; then
            echo "Warning: Could not determine if Frontend started successfully."
            echo "Frontend output preview:"
            echo "$fe_output" | tail -10
            echo "You can check the Frontend status with: tmux attach -t fe"
            echo "Continuing anyway..."
        else
            echo "✅ Frontend appears to be running"
        fi

        echo "✅ Frontend started successfully in tmux session 'fe'"
    else
        echo "✅ Frontend already running in tmux session 'fe'"
    fi
}

start_monitor() {
    local clean_flag=$1
    local monitor_path
    monitor_path="$(dirname "$0")/../../monitor"
    
    # Kill existing Monitor session if clean flag is set
    if [ "$clean_flag" = "clean" ]; then
        if tmux_session_exists "monitor"; then
            echo "🧹 Killing existing Monitor session for clean start..."
            tmux kill-session -t monitor
        fi
    fi
    
    if ! tmux_session_exists "monitor"; then
        echo "📊 Starting Monitor in tmux session..."

        local monitor_cmd="cd '${monitor_path}' && pnpm install && pnpm monitor:dev"

        # Step 1: Create a new, detached session without a command.
        tmux new-session -d -s monitor

        # Give it a moment to stabilize
        sleep 1

        # Step 2: Send the commands to the session's first window.
        tmux send-keys -t monitor "${monitor_cmd}" C-m

        # Give the process time to start up
        sleep 5

        # Check if the process started successfully.
        # Give more time for the process to start and check for common success indicators
        sleep 3
        local monitor_output
        monitor_output=$(tmux capture-pane -pt monitor)
        
        # Check for various success indicators in Monitor output
        if ! echo "$monitor_output" | grep -q -E "(Monitoring|Listening|Running|Started|Success)" && ! echo "$monitor_output" | grep -q -E "(Error|Failed|Exception)"; then
            echo "Warning: Could not determine if Monitor started successfully."
            echo "Monitor output preview:"
            echo "$monitor_output" | tail -10
            echo "You can check the Monitor status with: tmux attach -t monitor"
            echo "Continuing anyway..."
        else
            echo "✅ Monitor appears to be running"
        fi

        echo "✅ Monitor started successfully in tmux session 'monitor'"
    else
        echo "✅ Monitor already running in tmux session 'monitor'"
    fi
}

run_demo_script() {
    echo "🎮 Running demo script playbook..."
    local sdk_path
    sdk_path="$(dirname "$0")/.."
    
    cd "$sdk_path"
    
    # Check if indexer is running
    if ! tmux_session_exists "indexer"; then
        echo "Error: Indexer is not running. Please start it with --indexer flag"
        return 1
    fi
    
    # Check if API is running
    if ! tmux_session_exists "api"; then
        echo "Error: API is not running. Please start it with --api flag"
        return 1
    fi
    
    # Source the CLI environment file to get required variables
    if [ -f ".secrets/localhost.cli.env" ]; then
        echo "📝 Sourcing environment variables from .secrets/localhost.cli.env"
        source .secrets/localhost.cli.env
    else
        echo "Error: .secrets/localhost.cli.env not found"
        echo "Please ensure the environment file exists with RPC_URL, GM_KEY, and INDEXER_URL"
        return 1
    fi
    
    # Verify required environment variables are set
    if [ -z "$RPC_URL" ] || [ -z "$GM_KEY" ] || [ -z "$INDEXER_URL" ]; then
        echo "Error: Missing required environment variables"
        echo "RPC_URL: ${RPC_URL:-NOT SET}"
        echo "GM_KEY: ${GM_KEY:+SET}"
        echo "INDEXER_URL: ${INDEXER_URL:-NOT SET}"
        return 1
    fi
    
    # Verify indexer is responding
    echo "🔍 Checking if indexer is responding..."
    local max_attempts=10
    local attempt=1
    local indexer_ready=false
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -X POST "$INDEXER_URL" \
            -H "Content-Type: application/json" \
            -d '{"query":"{ __typename }"}' \
            --max-time 2 > /dev/null 2>&1; then
            indexer_ready=true
            echo "✅ Indexer is responding"
            break
        fi
        echo "⏳ Waiting for indexer to be ready (attempt $attempt/$max_attempts)..."
        sleep $((2 * attempt * attempt))
        attempt=$((attempt + 1))
    done
    
    if [ "$indexer_ready" = false ]; then
        echo "❌ Indexer is not responding after $max_attempts attempts"
        echo "   Please check the indexer logs: tmux attach -t indexer"
        return 1
    fi
    
    # Wait for the distribution to be indexed
    echo "🔍 Waiting for fellowship/distribution to be indexed..."
    local max_fellowship_attempts=40
    local fellowship_attempt=1
    local fellowship_indexed=false
    
    # Distribution ID for "MAO Distribution"
    local distribution_id="0x4d414f20446973747269627574696f6e00000000000000000000000000000000"
    
    while [ $fellowship_attempt -le $max_fellowship_attempts ]; do
        # Query the indexer directly to check if the distribution instantiation is indexed
        local query_result
        query_result=$(curl -s -X POST "$INDEXER_URL" \
            -H "Content-Type: application/json" \
            -d "{\"query\":\"{ DAODistributor_Instantiated(where: {distributionId: {_eq: \\\"$distribution_id\\\"}, newInstanceId: {_eq: \\\"1\\\"}}) { id } }\"}" \
            --max-time 5 2>/dev/null)
        
        # Check if we got a valid response with data
        if echo "$query_result" | grep -q '"DAODistributor_Instantiated"' && echo "$query_result" | grep -q '"id"'; then
            fellowship_indexed=true
            echo "✅ Fellowship 1 is indexed and ready"
            # Give it a moment more to ensure all related data is synced
            sleep 2
            break
        fi
        
        echo "⏳ Waiting for fellowship to be indexed (attempt $fellowship_attempt/$max_fellowship_attempts)..."
        sleep 3
        fellowship_attempt=$((fellowship_attempt + 1))
    done
    
    if [ "$fellowship_indexed" = false ]; then
        echo "❌ Fellowship not indexed after $max_fellowship_attempts attempts (120 seconds)"
        echo "   The indexer may still be syncing or there might be an issue."
        echo "   You can:"
        echo "   1. Check indexer logs: tmux attach -t indexer"
        echo "   2. Verify the indexer config is correct"
        echo "   3. Wait a bit longer and run the demo script manually:"
        echo "      cd sdk && source .secrets/localhost.cli.env && ./src/cli/playbooks/cliPlaybooks.sh demo-script 1 0x335c213532b25064c7f3823a2FE8Dde921C90d6F"
        return 1
    fi
    
    # Get fellowship ID and instance address
    local fellowship_id=1
    local instance_address="0x335c213532b25064c7f3823a2FE8Dde921C90d6F"
    
    echo "Instance address: ${instance_address}"
    echo "Running: ./src/cli/playbooks/cliPlaybooks.sh demo-script ${fellowship_id} ${instance_address}"
    
    # Run the demo script playbook
    ./src/cli/playbooks/cliPlaybooks.sh demo-script "${fellowship_id}" "${instance_address}"
    
    if [ $? -eq 0 ]; then
        echo "✅ Demo script completed successfully!"
    else
        echo "❌ Demo script failed"
        return 1
    fi
    
    cd -
}

# Check required environment variables
required_vars=(
    "RPC_URL"
    "PRIVATE_KEY"
    "RANKIFY_CONTRACTS_PATH"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: $var environment variable is not set"
        exit 1
    fi
done

# Handle anvil for localhost network
if [ "$NETWORK" = "localhost" ]; then
    if [ "$CLEAN" = "clean" ]; then
        kill_anvil
    fi
    start_anvil 
fi

echo "🚀 Setting up local development environment..."

# Function to setup a repository
setup_repo() {
    local repo_path=$1
    local repo_name=$2
    local tags=$3
    local clean_flag=$4
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
    
    # Link multipass only if multipass flag is set
    if [ "$MULTIPASS_FLAG" = "true" ]; then
        echo "Linking multipass to $repo_name..."
        pnpm link ../multipass
    fi

    # Deploy contracts
    echo "Deploying $repo_name contracts..."
    if [ "$clean_flag" = "clean" ]; then
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

    # Run additional setup commands if clean flag is set and network is localhost
    if [ "$clean_flag" = "clean" ] && [ "$NETWORK" = "localhost" ]; then
        echo "🧹 Running additional setup commands for clean deployment..."
        
        # Mint tokens to default address
        echo "Minting tokens to default address..."
        pnpm hardhat --network localhost mintTokensTo --address 0xaA63aA2D921F23f204B6Bcb43c2844Fb83c82eb9
        
        # Add distribution in SDK
        echo "Adding distribution in SDK..."
        local sdk_path
        sdk_path="$(dirname "$repo_path")/sdk"
        if [ ! -d "$sdk_path" ]; then
            echo "Error: expected SDK repo at $sdk_path"
            exit 1
        fi
        echo "SDK path: $sdk_path"
        cd "$sdk_path"
        pnpm install
        pnpm link ../contracts
        source .secrets/localhost.cli.env    
        pnpm cli distributions add -i 1 -y
        cd "$repo_path"  # Return to the repo path
    fi

    # Return to original directory
    cd -
}
setup_repo "$RANKIFY_CONTRACTS_PATH" "rankify-contracts" "ERC7744,MAO,rankify,multipass" "$CLEAN"

# Deploy and initialize Multipass if flag is set (BEFORE rankify contracts)
if [ "$MULTIPASS_FLAG" = "true" ]; then
    echo "🎫 Deploying and initializing Multipass..."
    MULTIPASS_PATH="$(dirname "$0")/../../multipass"
    
    if [ ! -d "$MULTIPASS_PATH" ]; then
        echo "Error: Multipass directory not found at $MULTIPASS_PATH"
        exit 1
    fi
    
    cd "$MULTIPASS_PATH"
    
    # Install dependencies
    echo "Installing Multipass dependencies..."
    pnpm install
    
    # Link SDK with Multipass
    echo "Linking SDK with Multipass..."
    pnpm link ../sdk
    
    # Run the deployment script
    echo "Running Multipass deployment script..."
    #./playbook/utils/deploy-to-local-anvil.sh
    
    # Initialize the domain
    echo "Initializing Multipass domain..."
    pnpm hardhat --network localhost initializeDomain --registrar-address 0xaA63aA2D921F23f204B6Bcb43c2844Fb83c82eb9 --domain "invisible.garden.mao"
    
    echo "✅ Multipass deployed and initialized"
    
    cd -
fi

if [ "$INDEXER_FLAG" = "true" ]; then
    start_indexer "$CLEAN"
fi

if [ "$API_FLAG" = "true" ]; then
    echo "⏳ Waiting 3 seconds before starting API..."
    sleep 3
    start_api "$CLEAN"
fi

if [ "$FE_FLAG" = "true" ]; then
    start_fe "$CLEAN"
fi

if [ "$MONITOR_FLAG" = "true" ]; then
    start_monitor "$CLEAN"
fi

# Run demo script if flag is set and dependencies are running
if [ "$DEMO_SCRIPT_FLAG" = "true" ]; then
    if [ "$API_FLAG" = "true" ] && [ "$INDEXER_FLAG" = "true" ]; then
        echo ""
        echo "⏳ Waiting for services to be fully ready before running demo script..."
        sleep 10
        run_demo_script
    else
        echo "⚠️  Warning: --demo-script flag requires both --api and --indexer flags to be set"
        if [ "$API_FLAG" != "true" ]; then
            echo "   Missing: --api"
        fi
        if [ "$INDEXER_FLAG" != "true" ]; then
            echo "   Missing: --indexer"
        fi
        echo "   Skipping demo script execution"
    fi
fi

if [ "$INDEXER_FLAG" = "true" ]; then
    echo "📦 Indexer is running in tmux session 'indexer'"
fi

if [ "$API_FLAG" = "true" ]; then
    echo "🚀 API is running in tmux session 'api'"
fi

if [ "$FE_FLAG" = "true" ]; then
    echo "🌐 Frontend is running in tmux session 'fe'"
fi

if [ "$MONITOR_FLAG" = "true" ]; then
    echo "📊 Monitor is running in tmux session 'monitor'"
fi

echo "✅ Local development environment setup complete!"
echo "🔨 Anvil is running in tmux session 'anvil'"
echo "To view Anvil logs: tmux attach -t anvil"
echo "To detach from Anvil logs: Ctrl+B then D"
echo "To stop Anvil: tmux kill-session -t anvil"

if [ "$INDEXER_FLAG" = "true" ]; then
    echo "To view Indexer logs: tmux attach -t indexer"
fi

if [ "$API_FLAG" = "true" ]; then
    echo "To view API logs: tmux attach -t api"
fi

if [ "$FE_FLAG" = "true" ]; then
    echo "To view Frontend logs: tmux attach -t fe"
fi

if [ "$MONITOR_FLAG" = "true" ]; then
    echo "To view Monitor logs: tmux attach -t monitor"
fi

# Generate stop command based on what's running
stop_cmd="tmux kill-session -t anvil"
if [ "$INDEXER_FLAG" = "true" ]; then
    stop_cmd="$stop_cmd && tmux kill-session -t indexer"
fi
if [ "$API_FLAG" = "true" ]; then
    stop_cmd="$stop_cmd && tmux kill-session -t api"
fi
if [ "$FE_FLAG" = "true" ]; then
    stop_cmd="$stop_cmd && tmux kill-session -t fe"
fi
if [ "$MONITOR_FLAG" = "true" ]; then
    stop_cmd="$stop_cmd && tmux kill-session -t monitor"
fi

echo "To stop all services: $stop_cmd"

# Open frontend URL if FE flag is present
if [ "$FE_FLAG" = "true" ]; then
    echo ""
    echo "🌐 Opening frontend in browser..."
    # If demo script ran, frontend should be ready; otherwise give it a moment to start
    if [ "$DEMO_SCRIPT_FLAG" != "true" ]; then
        sleep 2
    fi
    open "http://localhost:3000/brain-breeze/" 2>/dev/null || echo "Please open http://localhost:3000/brain-breeze/ in your browser"
    echo "Frontend URL: http://localhost:3000/brain-breeze/"
fi
