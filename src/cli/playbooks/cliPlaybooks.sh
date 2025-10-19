#!/bin/bash
set -e

# Path to the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Function to display usage information
usage() {
  echo "Usage: $0 <playbook_name> [args...]"
  echo "Available playbooks:"
  echo "  demo-script"
  echo "  push-game-to-next-phase"
  exit 1
}

# Check if a playbook name is provided
if [ -z "$1" ]; then
  usage
fi

PLAYBOOK_NAME=$1
shift

# Execute the corresponding playbook using the playbook runner
case $PLAYBOOK_NAME in
  demo-script)
    npx tsx "$DIR/playbookRunner.ts" "$PLAYBOOK_NAME" "$@"
    ;;
  push-game-to-next-phase)
    npx tsx "$DIR/playbookRunner.ts" "$PLAYBOOK_NAME" "$@"
    ;;
  *)
    echo "Error: Unknown playbook '$PLAYBOOK_NAME'"
    usage
    ;;
esac
