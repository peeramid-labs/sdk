# Playbooks

This directory contains various TypeScript scripts to automate common testing and development scenarios. For now these playbooks will work correctly on fresh anvil instance, to match the state of the permutations while upgrade to dynamic voting according to permutation is in progress.

## Fresh anvils instance setup

If anvil's session is running, kill it:
`tmux kill-session -t anvil;`

In scripts directory execute:
`./deploy-contracts.sh localhost clean`

You will need to export env variables (you can put them in env file and source it before script use):

`export MNEMONIC="xxx" export PRIVATE_KEY="xxx" #GM PK
export RPC_URL="xxx"`
export INDEXER_URL="http://localhost:8080/v1/graphql"

## Important

In package.json type must be set to commonjs!

## GameMaster Integration

The playbooks now automatically initialize and use a GameMaster instance for cryptographic operations. The GameMaster private key is loaded from environment variables:

- `GM_KEY` - GameMaster private key (preferred)
- `PRIVATE_KEY` - Fallback private key if GM_KEY is not set
- `RPC_URL` - RPC endpoint URL
- `INDEXER_URL` - Envio GraphQL endpoint URL (defaults to http://localhost:8080/v1/graphql)

## Architecture

The playbook system uses a simple, clean approach:

1. **`cliPlaybooks.sh`** - Main entry point that creates GameMaster and calls playbooks
2. **`initGameMaster.ts`** - Simple GameMaster initializer using environment variables
3. **`utils.ts`** - Shared utilities for command execution and logging
4. **Individual playbooks** - TypeScript files that accept GameMaster as parameter

## Usage

All playbooks are executed through the main entry point script:

```bash
./cliPlaybooks.sh <playbook_name> [args...]
```

## Available Playbooks

### demo-script

A comprehensive script that runs a full game scenario with proposals and voting.

**Usage:**

```bash
./cliPlaybooks.sh demo-script <fellowshipId> <instanceAddress>
```

**Parameters:**

- `fellowshipId`: (number) - Fellowship ID
- `instanceAddress`: (address) - Rankify instance address

**Example:**

```bash
./cliPlaybooks.sh demo-script 2 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

**What it does:**

1. Creates a new game with 5 players
2. Stores thread in API server
3. Players join the game
4. Starts the game
5. Runs through 3 turns with:
   - Turn 1: All players submit proposals, voting based on permuted proposals
   - Turn 2: Different players submit proposals with voting
   - Turn 3: Final proposals submitted
6. Uses GameMaster to decrypt permuted proposals and calculate correct vote positions

**Parameters:**

- `fellowshipId`: (number) - Fellowship ID
- `gameId`: (number) - Game ID
- `runToTurn`: (number) - Run up to this turn number (1-5)
- `finishTurn`: (boolean, optional) - Whether to finish the last turn (default: true)

**Example:**

### push-game-to-next-phase

A script that advances a game to its next phase. If no game ID is provided, it creates and starts a new game.

**Usage:**

```bash
./cliPlaybooks.sh push-game-to-next-phase <fellowshipId> <instanceAddress> [gameId]
```

**Parameters:**

- `fellowshipId`: (number) - Fellowship ID
- `instanceAddress`: (address) - Rankify instance address
- `gameId`: (number, optional) - Game ID to advance. If not provided, creates new game

**Examples:**

```bash
# Create and start a new game
./cliPlaybooks.sh push-game-to-next-phase 2 0x5FbDB2315678afecb367f032d93F642f64180aa3

# Advance existing game to next phase
./cliPlaybooks.sh push-game-to-next-phase 2 0x5FbDB2315678afecb367f032d93F642f64180aa3 16
```

**What it does:**

**Without gameId:**

1. Creates a new game with 5 players
2. Stores thread in API server with "Registration open" phase
3. Players join the game
4. Starts the game
5. Updates thread to "In progress" phase

**With gameId:**

1. Gets current game state
2. If in PROPOSING phase:
   - Submits dummy proposals for all players
   - Mines blockchain for proposing period
   - Ends proposing phase
   - Advances to VOTING phase
3. If in VOTING phase:
   - Submits dummy votes for all players (voting for first proposal)
   - Mines blockchain for voting period
   - Ends voting phase
   - Advances to next turn or ends game

**Use case:**

- Ideal for testing: create a game, then repeatedly call the script to advance through phases
- Useful for automated testing workflows
- Can be used in CI/CD pipelines to test game flow

## Make the script executable

```bash
chmod +x src/cli/playbooks/cliPlaybooks.sh
```
