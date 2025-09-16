---
"@peeramid-labs/sdk": patch
---

Implement overrideArtifact method for unsupported chains in CLIUtils

- Added overrideArtifact method to create an override artifact for unsupported chains by fetching the payment token from the instance contract.
- Updated create command to check chain support and prepare the override artifact for token approval if necessary.
- Modified createAndOpenGame method in RankifyPlayer to accept an optional overrideArtifact parameter for token approval on unsupported chains.
- Enhanced error handling in getChainPath to throw an error for unsupported chain IDs.
