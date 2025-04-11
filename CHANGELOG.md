# peeramid-labs/sdk

## 3.8.0

### Minor Changes

- [#135](https://github.com/peeramid-labs/sdk/pull/135) [`ce983d701e4b41c8c05615f105a762732c218776`](https://github.com/peeramid-labs/sdk/commit/ce983d701e4b41c8c05615f105a762732c218776) Thanks [@peersky](https://github.com/peersky)! - Refactored GameMaster.ts and historicTurn in InstanceBase.ts. Created more cli commands and created bash script playbook scenarios

### Patch Changes

- [#135](https://github.com/peeramid-labs/sdk/pull/135) [`ce983d701e4b41c8c05615f105a762732c218776`](https://github.com/peeramid-labs/sdk/commit/ce983d701e4b41c8c05615f105a762732c218776) Thanks [@peersky](https://github.com/peersky)! - fixed bug when non-proposing was not correctly parsed in getProposalsVotedUpon

- [#135](https://github.com/peeramid-labs/sdk/pull/135) [`ce983d701e4b41c8c05615f105a762732c218776`](https://github.com/peeramid-labs/sdk/commit/ce983d701e4b41c8c05615f105a762732c218776) Thanks [@peersky](https://github.com/peersky)! - cancel game cli

## 3.7.4

### Patch Changes

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - Add remove distribution method to distributor class

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - add fromBlock to getProposalScoresList

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - elaborated api error processing

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - fixed bug that caused decryptTurnVotes to not get actual vote events

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - - add fellowship parameters cli getter

  - add end-turn cli method
  - adjust create fellowship cli for new contracts version (add owner param)

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - allow specify distributor address in add distribution cli call

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - added remove distribution cli method

- [`4161570ea775334d6da4298931da597c05fdbaec`](https://github.com/peeramid-labs/sdk/commit/4161570ea775334d6da4298931da597c05fdbaec) Thanks [@peersky](https://github.com/peersky)! - add vote credits to cli print on fellowship games query

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - bumped contracts dep

- [#134](https://github.com/peeramid-labs/sdk/pull/134) [`98a1599ac152da6751006c561c70f7ebd9fba4ea`](https://github.com/peeramid-labs/sdk/commit/98a1599ac152da6751006c561c70f7ebd9fba4ea) Thanks [@peersky](https://github.com/peersky)! - bump contracts to 0.12.4

## 3.7.3

### Patch Changes

- [`699f057ddf3194bbb3ebc49b578aeedda21adca1`](https://github.com/peeramid-labs/sdk/commit/699f057ddf3194bbb3ebc49b578aeedda21adca1) Thanks [@peersky](https://github.com/peersky)! - fixed case when endTurn fails due to old Proposals not having some of proposals.

## 3.7.2

### Patch Changes

- [#127](https://github.com/peeramid-labs/sdk/pull/127) [`9aa04c8cd2ab9465d6e267cd2f941602520e3dda`](https://github.com/peeramid-labs/sdk/commit/9aa04c8cd2ab9465d6e267cd2f941602520e3dda) Thanks [@peersky](https://github.com/peersky)! - code index assumed to be deployed on any chain that has other deployments

## 3.7.1

### Patch Changes

- [#125](https://github.com/peeramid-labs/sdk/pull/125) [`bbd1537e495af2753e833aeaad6f175e1936299c`](https://github.com/peeramid-labs/sdk/commit/bbd1537e495af2753e833aeaad6f175e1936299c) Thanks [@peersky](https://github.com/peersky)! - add mpass arb sepolia package

## 3.7.0

### Minor Changes

- [#121](https://github.com/peeramid-labs/sdk/pull/121) [`5d2c459a40ded77f5eb6d361e74b62965de15709`](https://github.com/peeramid-labs/sdk/commit/5d2c459a40ded77f5eb6d361e74b62965de15709) Thanks [@peersky](https://github.com/peersky)! - add thread (game) metadata getter

- [#124](https://github.com/peeramid-labs/sdk/pull/124) [`572e5f791037b91aa1ad1c1718fc05efcc524a30`](https://github.com/peeramid-labs/sdk/commit/572e5f791037b91aa1ad1c1718fc05efcc524a30) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Added arbitrum sepolia configuration. Updated contracts version

## 3.6.0

### Minor Changes

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - adapted gm voting to 0.12 release

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - Sign joining game method for game master

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - permutation array logic

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - Game proposal signature workflows edited to accomodate 0.12 release

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - added turnSalt and playerTurnSalt methods to update for 0.12 contracts release

- [#112](https://github.com/peeramid-labs/sdk/pull/112) [`eed771cc1e6cfe6becc85c1a090763857b622450`](https://github.com/peeramid-labs/sdk/commit/eed771cc1e6cfe6becc85c1a090763857b622450) Thanks [@peersky](https://github.com/peersky)! - Added zero knowledge proof generation for end turn integrity

### Patch Changes

- [#98](https://github.com/peeramid-labs/sdk/pull/98) [`70f8a61b88762b33e9063029eb38b9ad2eb35c60`](https://github.com/peeramid-labs/sdk/commit/70f8a61b88762b33e9063029eb38b9ad2eb35c60) Thanks [@peersky](https://github.com/peersky)! - moved viem to peer deps

## 3.5.0

### Minor Changes

- [#96](https://github.com/peeramid-labs/sdk/pull/96) [`eede1543ae3264e0a482c754347198b2f9ae62af`](https://github.com/peeramid-labs/sdk/commit/eede1543ae3264e0a482c754347198b2f9ae62af) Thanks [@peersky](https://github.com/peersky)! - Added changes for contracts and eds repositories, accomodating for rename of code index in to ERC4477 and removed EDS from setting up local anvil script

## 3.4.0

### Minor Changes

- [#94](https://github.com/peeramid-labs/sdk/pull/94) [`ac2699f0039dbde2ba15b31c70723bf6232582ba`](https://github.com/peeramid-labs/sdk/commit/ac2699f0039dbde2ba15b31c70723bf6232582ba) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Fixed players bug in finished phase. added getPlayers method

## 3.3.1

### Patch Changes

- [`02e7c10b16555d30876495a2ada78e71e8e8f74a`](https://github.com/peeramid-labs/sdk/commit/02e7c10b16555d30876495a2ada78e71e8e8f74a) Thanks [@peersky](https://github.com/peersky)! - fixed bugs in game master constructor type

## 3.3.0

### Minor Changes

- [#86](https://github.com/peeramid-labs/sdk/pull/86) [`7ba5a63c5074cb25522c1813013a56f8006535c0`](https://github.com/peeramid-labs/sdk/commit/7ba5a63c5074cb25522c1813013a56f8006535c0) Thanks [@peersky](https://github.com/peersky)! - added support for 0.11 release eip712 name and version resolution

### Patch Changes

- [#87](https://github.com/peeramid-labs/sdk/pull/87) [`3c24e9a4d0e8cb20453f9e7ab57750a648d762cf`](https://github.com/peeramid-labs/sdk/commit/3c24e9a4d0e8cb20453f9e7ab57750a648d762cf) Thanks [@peersky](https://github.com/peersky)! - updated setup local script

- [#90](https://github.com/peeramid-labs/sdk/pull/90) [`743f3dae62ef265f8a4298ac9cada84283cc7b14`](https://github.com/peeramid-labs/sdk/commit/743f3dae62ef265f8a4298ac9cada84283cc7b14) Thanks [@peersky](https://github.com/peersky)! - game master now takes instance address as method arguments

- [#89](https://github.com/peeramid-labs/sdk/pull/89) [`13bdadf796bc1ca3dd785837b5a92f7447084680`](https://github.com/peeramid-labs/sdk/commit/13bdadf796bc1ca3dd785837b5a92f7447084680) Thanks [@peersky](https://github.com/peersky)! - patch fixes for cli and batch getter

## 3.2.0

### Minor Changes

- [#82](https://github.com/peeramid-labs/sdk/pull/82) [`b06e5dc66e74e4ad8b8826980ccecb5f92c083b9`](https://github.com/peeramid-labs/sdk/commit/b06e5dc66e74e4ad8b8826980ccecb5f92c083b9) Thanks [@peersky](https://github.com/peersky)! - added getGameStates and getContractState methods, modified getGameStateDetails to return more info

## 3.1.0

### Minor Changes

- [#77](https://github.com/peeramid-labs/sdk/pull/77) [`6b65cc42fbceb06d8e0d1f19ea6eef8deb2d7b57`](https://github.com/peeramid-labs/sdk/commit/6b65cc42fbceb06d8e0d1f19ea6eef8deb2d7b57) Thanks [@peersky](https://github.com/peersky)! - wrapped all contract write/read with error handler wrapper

- [#73](https://github.com/peeramid-labs/sdk/pull/73) [`8774f567e2eb5160ab90ffab7db317efed2c8e7c`](https://github.com/peeramid-labs/sdk/commit/8774f567e2eb5160ab90ffab7db317efed2c8e7c) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Update MaoDistribution to return instance id and accept input block params

### Patch Changes

- [#74](https://github.com/peeramid-labs/sdk/pull/74) [`affdcd68e43fc3584f639810300292106c97df65`](https://github.com/peeramid-labs/sdk/commit/affdcd68e43fc3584f639810300292106c97df65) Thanks [@peersky](https://github.com/peersky)! - Fixed bug when CLI was unable to submit transactions for "peeramid distribution add". Added code indexer CLI interface, fixed CLI crashing due to deployment files having empty logs array.

- [#79](https://github.com/peeramid-labs/sdk/pull/79) [`823794da4277a81db28a20eb1fdadc49026734f3`](https://github.com/peeramid-labs/sdk/commit/823794da4277a81db28a20eb1fdadc49026734f3) Thanks [@peersky](https://github.com/peersky)! - Modified createGame API (this is breaking!) to allow flag for opening right after creation

## 3.0.3

### Patch Changes

- [`96635910e6ddb8d92557e3e0e559969c3422704d`](https://github.com/peeramid-labs/sdk/commit/96635910e6ddb8d92557e3e0e559969c3422704d) Thanks [@peersky](https://github.com/peersky)! - log queries now attempt to find contract creation block to incease log filtering speed

- ora downgraded

## 3.0.2

### Patch Changes

- [`5e1248151ecf748afb46e7a6382dfe4b97367620`](https://github.com/peeramid-labs/sdk/commit/5e1248151ecf748afb46e7a6382dfe4b97367620) Thanks [@peersky](https://github.com/peersky)! - downgrade chalk

## 3.0.1

### Patch Changes

- [`fc29b359224ef92dde2b0db37e65a4476e5ab5b3`](https://github.com/peeramid-labs/sdk/commit/fc29b359224ef92dde2b0db37e65a4476e5ab5b3) Thanks [@peersky](https://github.com/peersky)! - fixed esm errors on cli when using on clean installations that have no dist build artifact

## 3.0.0

### Major Changes

- [#67](https://github.com/peeramid-labs/sdk/pull/67) [`01cb045d25980f6f0174d0c1bbd9d48902475d2a`](https://github.com/peeramid-labs/sdk/commit/01cb045d25980f6f0174d0c1bbd9d48902475d2a) Thanks [@peersky](https://github.com/peersky)! - Added CLI interface for interacting with Peeramid contracts, providing commands for managing distributions, fellowships, and instances. Enhanced distribution management with named distributions and CodeIndex integration.

  BREAKING CHANGES:

  - Changed DistributorClient.getInstances return type to include version and instance metadata
  - Modified RankTokenClient.getMetadata to require IPFS gateway parameter
  - Moved parseInstantiated utility from types to utils package
  - Updated distributor contract interface to DAODistributor

### Minor Changes

- [#65](https://github.com/peeramid-labs/sdk/pull/65) [`5d1a5676f456b3ebdcc280021a668d2a9d1143fb`](https://github.com/peeramid-labs/sdk/commit/5d1a5676f456b3ebdcc280021a668d2a9d1143fb) Thanks [@peersky](https://github.com/peersky)! - added medatata types for fellowship group contracts

## 2.1.2

### Patch Changes

- [#63](https://github.com/peeramid-labs/sdk/pull/63) [`afa73dfade1e39074217284feacb8355349ca64a`](https://github.com/peeramid-labs/sdk/commit/afa73dfade1e39074217284feacb8355349ca64a) Thanks [@peersky](https://github.com/peersky)! - added logs to receipt from get arifact

## 2.1.1

### Patch Changes

- [#61](https://github.com/peeramid-labs/sdk/pull/61) [`1f976c6bc0aedc87515331cb4918c0e71018fdf7`](https://github.com/peeramid-labs/sdk/commit/1f976c6bc0aedc87515331cb4918c0e71018fdf7) Thanks [@peersky](https://github.com/peersky)! - exported gamemaster class to index

## 2.1.0

### Minor Changes

- [#59](https://github.com/peeramid-labs/sdk/pull/59) [`8c1497e623ce1a15678e3f8195c2acebf218baba`](https://github.com/peeramid-labs/sdk/commit/8c1497e623ce1a15678e3f8195c2acebf218baba) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Fixed MaoDistributor type issues. Parameterized some event log methods

## 2.0.2

### Patch Changes

- [`c272bc9b44016c91d770c376631afc16ae04a83e`](https://github.com/peeramid-labs/sdk/commit/c272bc9b44016c91d770c376631afc16ae04a83e) Thanks [@peersky](https://github.com/peersky)! - during build copy docs to dist

## 2.0.1

### Patch Changes

- [`5628fadf748d5cd878025645722f954ef3a17b3d`](https://github.com/peeramid-labs/sdk/commit/5628fadf748d5cd878025645722f954ef3a17b3d) Thanks [@peersky](https://github.com/peersky)! - fixed docs generation to mkdocs

## 2.0.0

### Major Changes

- [#52](https://github.com/peeramid-labs/sdk/pull/52) [`25ba1dba27657da6b332d003ff0a144afc6f5833`](https://github.com/peeramid-labs/sdk/commit/25ba1dba27657da6b332d003ff0a144afc6f5833) Thanks [@peersky](https://github.com/peersky)! - adapted client library for rankify v0.10.0 release

### Minor Changes

- [#52](https://github.com/peeramid-labs/sdk/pull/52) [`25ba1dba27657da6b332d003ff0a144afc6f5833`](https://github.com/peeramid-labs/sdk/commit/25ba1dba27657da6b332d003ff0a144afc6f5833) Thanks [@peersky](https://github.com/peersky)! - added script to locally bring up development enviroment

- [#42](https://github.com/peeramid-labs/sdk/pull/42) [`ad21a6113adec0338029f24a42bc6ea58834fb97`](https://github.com/peeramid-labs/sdk/commit/ad21a6113adec0338029f24a42bc6ea58834fb97) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Migrated to fully use multipass dependency

- [#45](https://github.com/peeramid-labs/sdk/pull/45) [`82bb56c1960f81c077a302bfd4ba007d5e62aac0`](https://github.com/peeramid-labs/sdk/commit/82bb56c1960f81c077a302bfd4ba007d5e62aac0) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Update multipass to 0.3.1

### Patch Changes

- [#47](https://github.com/peeramid-labs/sdk/pull/47) [`096a138cbea989ddc1a2ea708f79b238149182d3`](https://github.com/peeramid-labs/sdk/commit/096a138cbea989ddc1a2ea708f79b238149182d3) Thanks [@peersky](https://github.com/peersky)! - changed sdk package name

## 1.1.0

### Minor Changes

- [#29](https://github.com/peeramid-labs/sdk/pull/29) [`1270766`](https://github.com/peeramid-labs/sdk/commit/1270766d47c5c10558441703d6defd8fe7b9b296) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Added changes needed to support multipass as stanadlone package

## 1.0.1

### Patch Changes

- [#25](https://github.com/rankify-it/sdk/pull/25) [`6c12af3`](https://github.com/rankify-it/sdk/commit/6c12af36a9fff400be057d068c25c4971c806acc) Thanks [@theKosmoss](https://github.com/theKosmoss)! - Fixed getContract calls in RankifyPlayers

## 1.0.0

### Major Changes

- [#22](https://github.com/rankify-it/sdk/pull/22) [`d799c77`](https://github.com/rankify-it/sdk/commit/d799c77a1a4c5c7a2e141f1b18bea451db13b036) Thanks [@theKosmoss](https://github.com/theKosmoss)! - added ability to query rankify artifacts by chain name and artifact name;

  In order to upgrade code you need to update all code places to use classes, either `RankifyBase` or `RankifyPlayer`

## 0.7.3

### Patch Changes

- [`924f73c`](https://github.com/rankify-it/sdk/commit/924f73ced5539cd801ecebd0128059b815fe02ef) Thanks [@peersky](https://github.com/peersky)! - build process fixes

## 0.7.2

### Patch Changes

- [`1ad61b4`](https://github.com/rankify-it/sdk/commit/1ad61b40180efc77dd75a90a807a03395a0fd0a9) Thanks [@peersky](https://github.com/peersky)! - bump contracts lib

## 0.7.1

### Patch Changes

- [#17](https://github.com/rankify-it/sdk/pull/17) [`41b92d3`](https://github.com/rankify-it/sdk/commit/41b92d3b768dde3f5fef391087ca1b81dd4b5771) Thanks [@peersky](https://github.com/peersky)! - contracts multipass deployments patch bump

## 0.7.0

### Minor Changes

- [#15](https://github.com/rankify-it/sdk/pull/15) [`63df9b7`](https://github.com/rankify-it/sdk/commit/63df9b7f91a1c5de37d3fdf642849fc858c59d88) Thanks [@peersky](https://github.com/peersky)! - updated contracts as dev network migrated to beta

## 0.6.0

### Minor Changes

- [`fc118c1`](https://github.com/rankify-it/sdk/commit/fc118c1c521306524e4e1eeed07b890d5505f83b) Thanks [@peersky](https://github.com/peersky)! - make ongoing proposals getter typed and remove deproxifier

## 0.5.0

### Minor Changes

- [`3523d14`](https://github.com/rankify-it/sdk/commit/3523d142485a1ef14cc4ba27cff43a1679a18f3e) Thanks [@peersky](https://github.com/peersky)! - bump contracts version to support deployments of multipass

## 0.4.0

### Minor Changes

- [`d0966ee`](https://github.com/rankify-it/sdk/commit/d0966eed7261d8332b0958366e076bcedd515f7a) Thanks [@peersky](https://github.com/peersky)! - adding multipass client library

## 0.3.0

### Minor Changes

- [`0dc0c71`](https://github.com/rankify-it/sdk/commit/0dc0c71908a382c1b21405cea509d2edeef0d6ba) Thanks [@peersky](https://github.com/peersky)! - bump contracts version

## 0.2.0

### Minor Changes

- [`408e9f7`](https://github.com/rankify-it/sdk/commit/408e9f75d5f6a718ce7614adf225447d0c060c8b) Thanks [@peersky](https://github.com/peersky)! - 0.5.0 contract version support

## 0.1.4

### Patch Changes

- [`4348f21`](https://github.com/rankify-it/sdk/commit/4348f218e891b4c8d674e4a145de8f1ec481f72f) Thanks [@peersky](https://github.com/peersky)! - remove console logs

## 0.1.3

### Patch Changes

- [`e86bcdb`](https://github.com/rankify-it/sdk/commit/e86bcdb7af0a68b694efeb8c7c92673cbe32c66d) Thanks [@peersky](https://github.com/peersky)! - removed console log

## 0.1.2

### Patch Changes

- [`9b50638`](https://github.com/rankify-it/sdk/commit/9b506380000360a551d0d44d89a1f335ad28db68) Thanks [@peersky](https://github.com/peersky)! - handle deep copy for cases when returned value is string

## 0.1.1

### Patch Changes

- [`5874d44`](https://github.com/rankify-it/sdk/commit/5874d44edea56b38cca940a5a99f6df40f89d9b6) Thanks [@peersky](https://github.com/peersky)! - fixing ci

- [`0a78f69`](https://github.com/rankify-it/sdk/commit/0a78f692bcb8b8ff5e47a581b7c81f5f0d1c4298) Thanks [@peersky](https://github.com/peersky)! - trying to get ci to work
