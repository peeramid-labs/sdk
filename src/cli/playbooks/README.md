# Playbooks

This directory contains various scripts to automate common testing and development scenarios. For now these playbooks will work correctly on fresh anvil instance, to match the state of the permutations while upgrade to dynamic voting according to permutation is in progress.

## Fresh anvils instance setup
If anvil's session is running, kill it:
`tmux kill-session -t anvil;`

In scripts directory execute:
`./deploy-contracts.sh localhost clean`

You will need to export env variables (you can put them in env file and source it before script use):

`export MNEMONIC="xxx" export PRIVATE_KEY="xxx" #GM PK
export RPC_URL="xxx"`

## Important
In package.json type must be set to commonjs!

## Available Playbooks

### partial-voting.sh

A script that simulates a fellowship game with partial voting patterns across multiple turns.

**Usage:**
```bash
./partial-voting.sh <runToTurn> [finishTurn]
```

**Parameters:**
- `runToTurn`: (number) - Run up to this turn number (1-5)
- `finishTurn`: (boolean, optional) - Whether to finish the last turn (default: true)

**Example:**
```bash
# Run through turn 3 and complete the turn
./partial-voting.sh 3 true

# Run through turn 2 but don't end the turn
./partial-voting.sh 2 false
```

**What it does:**
1. Initializes a domain
2. Creates a distribution and fellowship
3. Creates a game with 5 players
4. Runs through up to 5 turns with specific proposal and voting patterns:
   - Turn 1: Players 0 and 3 propose, no votes
   - Turn 2-4: Players 0 and 3 propose, Player 1 votes for Player 0
   - Turn 5: Players 0 and 3 propose, Player 1 votes for Player 3

   # Make the script executable
   `chmod +x src/cli/playbooks/partial-voting.sh`
