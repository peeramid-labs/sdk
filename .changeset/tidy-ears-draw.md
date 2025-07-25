---
"@peeramid-labs/sdk": patch
---

Fix getHistoricTurn function issues:

- Fixed getPreviousTurnStats to correctly retrieve previous turn data (currentTurn - 1) instead of current turn
- Added missing permutation field to VotingStageResults GraphQL query and TypeScript types
- Fixed proposal-to-player mapping in getHistoricTurn to use permutation indices for correct proposal attribution
- Enhanced EnvioGraphQLClient to include permutation data from VotingStageResults events
