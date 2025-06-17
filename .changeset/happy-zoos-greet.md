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

This release adapts the SDK to support rankify-contracts v0.14.0 (PR peeramid-labs/rankify-contracts#183) which introduced several major architectural changes:

1. **Two-Phase Turn System**: Replaced the single `endTurn` concept with separate proposing and voting phases, each with their own duration and completion conditions.

2. **Minimum Participation Rules**: Added enforcement of minimum proposal participation and the ability to detect and resolve stale games.

3. **Governor Contract**: Integrated with the new Governor contract for MAO governance, supporting new parameters like voting delay, voting period, and quorum requirements.

4. **Multi-Game Support**: Updated player tracking to support participation in multiple games simultaneously.

5. **Enhanced Event Data**: Adapted to the new `ProposingStageEnded` and `VotingStageResults` events that provide more detailed information about game state.

Closes issues #161 (Implement support splitting endTurn for endVoting & endProposing) and #164 (Adapt SDK for Rankify Contracts Release - Two-Phase Turns, Governor, Stale Games).
