#!/bin/bash
export INDEXER_URL=http://localhost:8080/v1/graphql
# Check if required parameters are provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <part>"
    echo "which part of the demo script to run: 1, 2, 3, 4"
    exit 1
fi

# Parse parameters
part=$1
echo "on on $part"


if [ "$part" = 1 ] || [ "$part" = 0 ]; then
  # Initialize domain and setup
  pnpm cli distributions add -i 1 -y
  sleep 5
  #move to contracts folder and run the script, then move back to sdk folder
  cd ../contracts && pnpm hardhat --network localhost makeDemoSubjects && cd ../sdk || exit 1

  sleep 5

  #rankify inner disscussion game
  pnpm cli fellowship game create 2 -i 1 --turns 3 --time-to-join 3000 --time-per-turn 3000 --vote-credits 1 --open-now --metadata ipfs://QmZuHWcCaSKBrbquCFwhWMTZ5qmxQGxzQhy8NJgaKsY1J8
  pnpm cli fellowship game join 2 1 -i 0
  pnpm cli fellowship game join 2 1 -i 1
  pnpm cli fellowship game join 2 1 -i 2
  pnpm cli fellowship game join 2 1 -i 3
  pnpm cli fellowship game join 2 1 -i 4
  pnpm cli fellowship game start 2 1 -i 1 --auto-mine
  pnpm cli fellowship game propose 2 1 -i 1 -t "Everything was clear to me" -b "<p>I understood everything without any problems. Made proposal successfully.</p>"
  pnpm cli fellowship game propose 2 1 -i 2 -t "Couldn't login with Telegram" -b "<p>I tried to login with Telegram but it didn't work. Invalid Domain name error pops out.</p>"
  pnpm cli fellowship game propose 2 1 -i 3 -t "Make a move button is visible even if I made a move" -b "<p>I made a move in 1st turn but make a move button is still active and and blinking calling my attention to it.</p>"
  pnpm cli fellowship game propose 2 1 -i 4 -t "Found no bugs - everything is fine" -b "<p>Really do not know what to say</p>"
  pnpm cli blockchain mine -t 3000
  pnpm cli fellowship game end-turn 2 1

  pnpm cli fellowship game vote 2 1 "0,0,1,0,0" -i 0
  pnpm cli fellowship game vote 2 1 "0,0,0,1,0" -i 1
  pnpm cli fellowship game vote 2 1 "0,0,1,0,0" -i 2
  pnpm cli fellowship game vote 2 1 "0,0,0,1,0" -i 3
  pnpm cli fellowship game vote 2 1 "0,0,0,1,0" -i 4
  pnpm cli fellowship game propose 2 1 -i 0 -t "There is bug in Thread creation modal" -b "<p>ETA is not calculated correctly. 1 hour is not shown as 1 hour but as 1:00</p>"
  pnpm cli fellowship game propose 2 1 -i 2 -t "Couldn't create a game" -b "<p>I tried to create a game but it didn't work. I got an error message. xs233</p>"
  pnpm cli fellowship game propose 2 1 -i 3 -t "Vote interface was hard to understand" -b "<p>I would make it more intuitive. For example, add a tooltip or a hint. Or even better change it to tab view - to look same as historical turn.</p>"
  pnpm cli fellowship game propose 2 1 -i 4 -t "Found no bugs - everything is fine" -b "<p>Really do not know what to say</p>"
  pnpm cli blockchain mine -t 3000
  pnpm cli fellowship game end-turn 2 1

  pnpm cli fellowship game vote 2 1 "1,0,0,0,0" -i 0
  pnpm cli fellowship game vote 2 1 "1,0,0,0,0" -i 1
  pnpm cli fellowship game vote 2 1 "1,0,0,0,0" -i 2  
  pnpm cli fellowship game vote 2 1 "0,0,1,0,0" -i 3
  pnpm cli fellowship game vote 2 1 "1,0,0,0,0" -i 4
  pnpm cli fellowship game propose 2 1 -i 0 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game propose 2 1 -i 2 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game propose 2 1 -i 3 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game propose 2 1 -i 4 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli blockchain mine -t 3000
  pnpm cli fellowship game end-turn 2 1

  #music game
  pnpm cli fellowship game create 6 -i 1 --turns 3 --time-to-join 3000 --time-per-turn 3000 --vote-credits 1 --open-now --metadata ipfs://QmRBKKqc7BMVqiNJX5UxPZ12iLJsMQXThGxKUGLgDNxpPF
  pnpm cli fellowship game join 6 1 -i 0
  pnpm cli fellowship game join 6 1 -i 1
  pnpm cli fellowship game join 6 1 -i 2
  pnpm cli fellowship game join 6 1 -i 3
  pnpm cli fellowship game join 6 1 -i 4
  pnpm cli fellowship game start 6 1 -i 1 --auto-mine

  #EIP discussion fun
  pnpm cli fellowship game create 1 -i 1 --turns 3 --time-to-join 3000 --time-per-turn 3000 --vote-credits 1 --open-now --metadata ipfs://QmTwvKzQg7M1Ra27wH39jVaavB8TgQBPuuq99t94zJR3MM
  pnpm cli fellowship game join 1 1 -i 0
  pnpm cli fellowship game join 1 1 -i 1
  pnpm cli fellowship game join 1 1 -i 2
  pnpm cli fellowship game join 1 1 -i 3
  pnpm cli fellowship game join 1 1 -i 4
  pnpm cli fellowship game start 1 1 -i 1 --auto-mine
fi

if [ "$part" = 2 ] || [ "$part" = 0 ]; then
  #if [ "$part" = 0 ]; then
    pnpm cli fellowship game create 2 -i 1 --turns 4 --time-to-join 3600 --time-per-turn 86400 --vote-credits 5 --open-now --metadata ipfs://QmUcVP49QEzWcm133N2JwjhpT3bEt1aRPsGAFqaPcpD71a
    pnpm cli fellowship game join 2 2 -i 1
    sleep 3
  #fi

  pnpm cli fellowship game join 2 2 -i 0
  pnpm cli fellowship game join 2 2 -i 2
  pnpm cli fellowship game join 2 2 -i 3
  pnpm cli fellowship game join 2 2 -i 4
  pnpm cli fellowship game start 2 2 -i 1 --auto-mine
  pnpm cli fellowship game propose 2 2 -i 0 -t "Dashboard UX: User-Centered Design with Orbiting Fellowships" -b "<p>Let's continue evolving the dashboard UX by making the user card the central focus, placed at the heart of the screen — visually anchoring the experience. Around it, fellowships orbit like planets, each representing a connection or group the user is part of.</p>"
  pnpm cli fellowship game propose 2 2 -i 2 -t "Switch Voting UI to Tabs (Like Historic Turn View)" -b "<p>To improve clarity and navigation, I suggest changing the current voting interface from a vertical list to a tabbed layout — similar to the one used in the Historic Turn view. This would make it easier for users to quickly switch between proposals and create a more consistent experience across the app.</p>"
fi

if [ "$part" = 3 ] || [ "$part" = 0 ]; then
  if [ "$part" = 0 ]; then
    pnpm cli fellowship game propose 2 2 -i 1 -t "Switch Voting UI to Tabs (Like Historic Turn View)" -b "<p>To improve clarity and navigation,I suggest changing the current voting interface from a vertical list to a tabbed layout — similar to the one used in the Historic Turn view. This would make it easier for users to quickly switch between proposals and create a more consistent experience across the app.</p>"
  fi

  pnpm cli fellowship game propose 2 2 -i 3 -t "Please finish AI summary tab for turn" -b "<p>Please finish AI summary tab for turn it would give more information to the users.</p>"
  pnpm cli fellowship game propose 2 2 -i 4 -t "User profile page" -b "<p>Create a user profile page to see the user's profile information.</p>"
  pnpm cli blockchain mine -t 86400
  pnpm cli fellowship game end-turn 2 2

  pnpm cli fellowship game propose 2 2 -i 0 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game propose 2 2 -i 2 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game vote 2 2 "0,0,2,1,0" -i 0
  pnpm cli fellowship game vote 2 2 "0,2,0,0,1" -i 2
fi

if [ "$part" = 4 ] || [ "$part" = 0 ]; then
  #if [ "$part" = 0 ]; then
    #pnpm cli fellowship game vote 2 2 "0,2,0,1,0" -i 1
    pnpm cli fellowship game propose 2 2 -i 1 -t "Switch Voting UI to Tabs small update" -b "<p>Also add some animation to the voting interface.</p>"
  #fi

  pnpm cli fellowship game vote 2 2 "0,0,2,1,0" -i 0
  pnpm cli fellowship game vote 2 2 "0,2,0,1,0" -i 2
  pnpm cli fellowship game propose 2 2 -i 3 -t "Dummy data" -b "<p>Dummy data</p>"
  pnpm cli fellowship game propose 2 2 -i 4 -t "Dummy data" -b "<p>Dummy data</p>"

  pnpm cli blockchain mine -t 86400
  pnpm cli fellowship game end-turn 2 2
fi
