---
"@peeramid-labs/sdk": minor
---

Migrated to the new contract structure using proposingStage and votingStage phases:
- Implemented two-phase turn system with distinct proposing and voting stages
- Added new methods `endProposing` and `endVoting` to replace the deprecated `endTurn` function
- Updated game creation parameters to support `proposingPhaseDuration` and `votePhaseDuration`
- Added new CLI commands to manage game phases separately
- Updated event handling to use `ProposingStageEnded` and `VotingStageResults` events
- Added helper methods for phase detection: `isProposingStage`, `isVotingStage`, `canEndProposingStage`, `canEndVotingStage`
- Enhanced vote validation to ensure all voting points are used if possible
- Removed `permutationCommitment` from `startGame`
- Added support for stale game detection and force-ending
