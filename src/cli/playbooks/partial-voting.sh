#!/bin/bash
export INDEXER_URL=http://localhost:8080/v1/graphql
# Check if required parameters are provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <fellowshipId> <gameId> <runToTurn> [finishTurn]"
    echo "  fellowshipId: number - fellowship ID"
    echo "  gameId: number - game ID"
    echo "  runToTurn: number - run up to this turn number"
    echo "  finishTurn: boolean - whether to finish the last turn (default: true)"
    exit 1
fi

# Parse parameters
fellowshipId=$1
gameId=$2
runToTurn=$3
finishTurn=${4:-true}

# Initialize domain and setup
pnpm cli distributions add -i 1 -y
sleep 2
pnpm cli fellowship create -i 1 -y
sleep 2

pnpm cli fellowship game create $fellowshipId -i 1 --time-to-join 3000 --time-per-turn 3000 --vote-credits 1

pnpm cli fellowship game join $fellowshipId $gameId -i 0
pnpm cli fellowship game join $fellowshipId $gameId -i 1
pnpm cli fellowship game join $fellowshipId $gameId -i 2
pnpm cli fellowship game join $fellowshipId $gameId -i 3
pnpm cli fellowship game join $fellowshipId $gameId -i 4
pnpm cli fellowship game start $fellowshipId $gameId -i 1 --auto-mine

# Turn 1: proposes #1 and #3
pnpm cli fellowship game propose $fellowshipId $gameId -i 0 -t "title for p=0 t=1" -b "body"
pnpm cli fellowship game propose $fellowshipId $gameId -i 3 -t "title for p=3 t=1" -b "body"
pnpm cli blockchain mine -t 1500
pnpm cli fellowship game end-proposing $fellowshipId $gameId


pnpm cli fellowship game vote $fellowshipId $gameId "0,1,0,0,0" -i 1
if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 1 ]; then
    pnpm cli blockchain mine -t 1500
    pnpm cli fellowship game end-voting $fellowshipId $gameId
    exit 0
fi

#Turn 2: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game propose $fellowshipId $gameId -i 0 -t "title for p=0 t=2" -b "body"
pnpm cli fellowship game propose $fellowshipId $gameId -i 3 -t "title for p=3 t=2" -b "body"
pnpm cli blockchain mine -t 1500
pnpm cli fellowship game end-proposing $fellowshipId $gameId

pnpm cli fellowship game vote $fellowshipId $gameId "0,1,0,0,0" -i 1
if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 2 ]; then
    pnpm cli blockchain mine -t 1500
    pnpm cli fellowship game end-voting $fellowshipId $gameId
    exit 0
fi

# Turn 3: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game propose $fellowshipId $gameId -i 0 -t "title for p=0 t=3" -b "body"
pnpm cli fellowship game propose $fellowshipId $gameId -i 3 -t "title for p=3 t=3" -b "body"

pnpm cli blockchain mine -t 1500
pnpm cli fellowship game end-proposing $fellowshipId $gameId

pnpm cli fellowship game vote $fellowshipId $gameId "0,1,0,0,0" -i 1
if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 2 ]; then
    pnpm cli blockchain mine -t 1500
    pnpm cli fellowship game end-voting $fellowshipId $gameId
    exit 0
fi

# Turn 4: proposes #1 and #3, vote #1 for #3
pnpm cli fellowship game propose $fellowshipId $gameId -i 0 -t "title for p=0 t=4" -b "body"
pnpm cli fellowship game propose $fellowshipId $gameId -i 3 -t "title for p=3 t=4" -b "body"

pnpm cli blockchain mine -t 1500
pnpm cli fellowship game end-proposing $fellowshipId $gameId

pnpm cli fellowship game vote $fellowshipId $gameId "0,0,0,1,0" -i 1
if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 3 ]; then
    pnpm cli blockchain mine -t 1500
    pnpm cli fellowship game end-voting $fellowshipId $gameId
fi


# Turn 5: proposes #1 and #3, vote #1 for #3 (note: in turn 5, vote is for #3 instead of #1)
pnpm cli fellowship game propose $fellowshipId $gameId -i 0 -t "title for p=0 t=5" -b "body"
pnpm cli fellowship game propose $fellowshipId $gameId -i 3 -t "title for p=3 t=5" -b "body"

pnpm cli blockchain mine -t 1500
pnpm cli fellowship game end-proposing $fellowshipId $gameId

pnpm cli fellowship game vote $fellowshipId $gameId "0,0,0,1,0" -i 1
if [ "$finishTurn" = "true" ] || [ "$runToTurn" -gt 4 ]; then
    pnpm cli blockchain mine -t 1500
    pnpm cli fellowship game end-voting $fellowshipId $gameId
fi