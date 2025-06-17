---
"@peeramid-labs/sdk": patch
---

Refactored end turn returned data:
- Updated data structures to handle the new two-phase system return values
- Modified decryption and processing of vote data to match contract changes
- Improved handling of voting matrices and player activity status
- Enhanced turn progress calculations to reflect the separate proposing and voting phases
- Updated GameState interface to use phaseStartedAt instead of turnStartedAt
- Fixed bugs in vote description when processing empty votes
