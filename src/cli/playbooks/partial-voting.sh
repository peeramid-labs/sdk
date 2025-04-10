#!/bin/bash

# Check if required parameters are provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <runToTurn> [finishTurn] [useraddress]"
    echo "  runToTurn: number - run up to this turn number"
    echo "  finishTurn: boolean - whether to finish the last turn (default: true)"
    echo "  useraddress: string - Ethereum address to use (default: 0x520E00225C4a43B6c55474Db44a4a44199b4c3eE)"
    exit 1
fi

# Parse parameters
runToTurn=$1
finishTurn=${2:-true}
userAddress=${3:-0x520E00225C4a43B6c55474Db44a4a44199b4c3eE}

# Initialize domain and setup
pnpm cli distributions add -i 1 -y
pnpm cli fellowship create -i 1 -y
pnpm cli fellowship game create 1 -i 1 --time-to-join 3000 --time-per-turn 3000 --vote-credits 1 --open-now
pnpm cli fellowship game join 1 1 -i 0
pnpm cli fellowship game join 1 1 -i 1
pnpm cli fellowship game join 1 1 -i 2
pnpm cli fellowship game join 1 1 -i 3
pnpm cli fellowship game join 1 1 -i 4
pnpm cli fellowship game start 1 1 -i 1 --auto-mine

# Turn 1: proposes #1 and #3
pnpm cli fellowship game propose 1 1 -i 0 -t "title for p=0 t=1" -b "body"
pnpm cli fellowship game propose 1 1 -i 3 -t "title for p=3 t=1" -b "body"
pnpm cli blockchain mine -t 3000

if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 1 ]; then
    pnpm cli fellowship game end-turn 1 1
fi

if [ "$runToTurn" -eq 1 ]; then
    exit 0
fi

# Turn 2: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game vote 1 1 "0,1,0,0,0" -i 1
pnpm cli fellowship game propose 1 1 -i 0 -t "title for p=0 t=2" -b "body"
pnpm cli fellowship game propose 1 1 -i 3 -t "title for p=3 t=2" -b "body"
pnpm cli blockchain mine -t 3000

if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 2 ]; then
    pnpm cli fellowship game end-turn 1 1
fi

if [ "$runToTurn" -eq 2 ]; then
    exit 0
fi

# Turn 3: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game vote 1 1 "0,1,0,0,0" -i 1
pnpm cli fellowship game propose 1 1 -i 0 -t "title for p=0 t=3" -b "body"
pnpm cli fellowship game propose 1 1 -i 3 -t "title for p=3 t=3" -b "body"
pnpm cli blockchain mine -t 3000

if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 3 ]; then
    pnpm cli fellowship game end-turn 1 1
fi

if [ "$runToTurn" -eq 3 ]; then
    exit 0
fi

# Turn 4: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game vote 1 1 "0,1,0,0,0" -i 1
pnpm cli fellowship game propose 1 1 -i 0 -t "title for p=0 t=4" -b "body"
pnpm cli fellowship game propose 1 1 -i 3 -t "title for p=3 t=4" -b "body"
pnpm cli blockchain mine -t 3000

if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 4 ]; then
    pnpm cli fellowship game end-turn 1 1
fi

if [ "$runToTurn" -eq 4 ]; then
    exit 0
fi

# Turn 5: proposes #1 and #3, vote #1 for #3 (note: in turn 5, vote is for #3 instead of #1)
pnpm cli fellowship game vote 1 1 "0,0,0,1,0" -i 1
pnpm cli fellowship game propose 1 1 -i 0 -t "title for p=0 t=5" -b "body"
pnpm cli fellowship game propose 1 1 -i 3 -t "title for p=3 t=5" -b "body"
pnpm cli blockchain mine -t 3000

if [ "$finishTurn" = "true" ]; then
    pnpm cli fellowship game end-turn 1 1
fi
