import { Address, WalletClient, PublicClient, keccak256, encodePacked, Hex } from "viem";
import { RankifyDiamondInstanceAbi } from "../abis";
import InstanceBase from "./InstanceBase";
import { handleRPCError } from "../utils";

/**
 * GameMaster class for managing game state and cryptographic operations in Rankify
 * Extends InstanceBase to provide game master specific functionality
 * @public
 */
export class GameMaster {
  walletClient: WalletClient;
  publicClient: PublicClient;
  encryptionCallback: (data: string) => Promise<string>;
  decryptionCallback: (data: string) => Promise<string>;
  randomnessCallback: () => Promise<number>;
  turnSaltCallback: ({ gameId, turn }: { gameId: bigint; turn: bigint }) => Promise<Hex>;
  chainId: number;
  /**
   * Creates a new GameMaster instance

   * @param walletClient - Viem wallet client for transactions
   * @param publicClient - Viem public client for reading state
   * @param chainId - Chain ID of the network
   * @param encryptionCallback - Callback function for encrypting data
   * @param decryptionCallback - Callback function for decrypting data
   * @param randomnessCallback - Callback function for generating random numbers
   * @param turnSaltCallback - Callback function for generating turn salts
   */
  constructor({
    walletClient,
    chainId,
    publicClient,
    encryptionCallback,
    decryptionCallback,
    randomnessCallback,
    turnSaltCallback,
  }: {
    walletClient: WalletClient;
    publicClient: PublicClient;
    chainId: number;
    encryptionCallback: (data: string) => Promise<string>;
    decryptionCallback: (data: string) => Promise<string>;
    randomnessCallback: () => Promise<number>;
    turnSaltCallback: ({ gameId, turn }: { gameId: bigint; turn: bigint }) => Promise<Hex>;
  }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.encryptionCallback = encryptionCallback;
    this.decryptionCallback = decryptionCallback;
    this.randomnessCallback = randomnessCallback;
    this.turnSaltCallback = turnSaltCallback;
  }

  /**
   * Decrypts proposals for a specific game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param proposer - Optional proposer address to filter proposals
   * @returns Array of decrypted proposals with proposer addresses
   */
  decryptProposals = async ({
    instanceAddress,
    gameId,
    turn,
    proposer,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    turn: bigint;
    proposer?: Address;
  }) => {
    const evts = await this.publicClient.getContractEvents({
      abi: RankifyDiamondInstanceAbi,
      address: instanceAddress,
      eventName: "ProposalSubmitted",
      args: { gameId: gameId, turn: turn, proposer: proposer },
    });

    if (evts.length == 0) return [];

    const proposals = await Promise.all(
      evts.map(async (log) => {
        if (!log.args.proposalEncryptedByGM) throw new Error("No proposalEncryptedByGM");
        return {
          proposer: log.args.proposer,
          proposal: await this.decryptionCallback(log.args.proposalEncryptedByGM),
        };
      })
    );

    return proposals;
  };

  /**
   * Generates a deterministic permutation for a specific game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param size - Size of the permutation
   * @param verifierAddress - Address of the verifier
   * @returns The generated permutation, secret, and commitment
   */
  generateDeterministicPermutation = async ({
    gameId,
    turn,
    size = 15,
    verifierAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    size?: number;
    verifierAddress: Address;
  }): Promise<{
    permutation: number[];
    secret: bigint;
    commitment: bigint;
  }> => {
    const maxSize = 15;
    // Create deterministic seed from game parameters and GM's signature

    // Use the seed to generate permutation
    const permutation: number[] = Array.from({ length: maxSize }, (_, i) => i);

    // This is kept secret to generate witness
    const secret = await this.getTurnSalt({ gameId, turn, verifierAddress });

    // Fisher-Yates shuffle with deterministic randomness
    for (let i = size - 1; i >= 0; i--) {
      // Generate deterministic random number for this position
      const randHash = keccak256(encodePacked(["uint256", "uint256"], [secret, BigInt(i)]));
      const rand = BigInt(randHash);
      const j = Number(rand % BigInt(i + 1));

      // Swap elements
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Ensure inactive slots map to themselves
    for (let i = size; i < maxSize; i++) {
      permutation[i] = i;
    }

    // Generate commitment
    const poseidon = await buildPoseidon();
    const PoseidonFirst = BigInt(
      poseidon.F.toObject(poseidon([permutation[0], permutation[1], permutation[2], permutation[3], permutation[4]]))
    );
    const PoseidonSecond = BigInt(
      poseidon.F.toObject(
        poseidon([PoseidonFirst, permutation[5], permutation[6], permutation[7], permutation[8], permutation[9]])
      )
    );
    const PoseidonThird = BigInt(
      poseidon.F.toObject(
        poseidon([PoseidonSecond, permutation[10], permutation[11], permutation[12], permutation[13], permutation[14]])
      )
    );

    const commitment = BigInt(poseidon.F.toObject(poseidon([PoseidonThird, secret])));

    return {
      permutation,
      secret,
      commitment,
    };
  };
  /**
   * Generates a salt for a specific game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param verifierAddress - Address of the verifier
   * @returns Generated salt as Hex
   */
  getTurnSalt = async ({
    gameId,
    turn,
    verifierAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
  }): Promise<bigint> => {
    const message = keccak256(
      encodePacked(["uint256", "uint256", "address", "uint256"], [gameId, turn, verifierAddress, BigInt(this.chainId)])
    );
    if (!this.walletClient.account) throw new Error("No account found");
    const signature = await this.walletClient.signMessage({ message, account: this.walletClient.account });
    const seed = keccak256(signature);
    return BigInt(seed);
  };

  /**
   * Generates a salt for a specific player in a game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param player - Address of the player
   * @param verifierAddress - Address of the verifier
   * @param size - Size of the permutation
   * @returns Generated salt as Hex
   */
  getTurnPlayersSalt = async ({
    gameId,
    turn,
    player,
    verifierAddress,
    size,
  }: {
    gameId: bigint;
    turn: bigint;
    player: Address;
    verifierAddress: Address;
    size: number;
  }) => {
    log(`Generating vote salt for player ${player} in game ${gameId}, turn ${turn}`);
    const result = await this.generateDeterministicPermutation({
      gameId,
      turn: turn - 1n,
      verifierAddress,
      size,
    }).then((perm) => {
      return keccak256(encodePacked(["address", "uint256"], [player, perm.secret]));
    });
    log(`Generated vote salt for player ${player}`);
    return result;
  };

  /**
   * Finds the index of a player's ongoing proposal
   * @param gameId - ID of the game
   * @param player - Address of the player
   * @returns Index of the player's proposal, -1 if not found
   */
  findPlayerOngoingProposalIndex = async ({
    instanceAddress,
    gameId,
    player,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    player: Address;
  }) => {
    const baseInstance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const { currentTurn, proposals } = await baseInstance.getOngoingProposals(gameId);
    if (currentTurn == 0n) {
      console.error("No proposals in turn 0");
      return -1;
    }

    const turn = currentTurn - 1n;
    const playersProposal = await this.decryptProposals({ instanceAddress, gameId, turn, proposer: player }).then(
      (ps) => (ps.length > 0 ? ps[0].proposal : undefined)
    );
    return playersProposal ? proposals.findIndex((p) => p === playersProposal) : -1;
  };

  /**
   * Submits a vote for proposals
   * @param gameId - ID of the game
   * @param vote - Array of vote values
   * @param voter - Address of the voter
   * @returns Transaction hash
   */
  submitVote = async ({
    instanceAddress,
    gameId,
    vote,
    voter,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    vote: bigint[];
    voter: Address;
  }) => {
    if (!gameId) throw new Error("No gameId");
    if (!vote) throw new Error("No votesHidden");
    if (!voter) throw new Error("No voter");
    const proposerIdx = await this.findPlayerOngoingProposalIndex({ instanceAddress, gameId, player: voter });
    if (proposerIdx != -1 && vote[proposerIdx] !== 0n) throw new Error("You cannot vote for your own proposal");
    const votesHidden = await this.encryptionCallback(JSON.stringify(vote.map((vi) => vi.toString())));
    if (!this.walletClient?.account?.address) throw new Error("No account address found");
    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "submitVote",
        args: [gameId, votesHidden, voter],
      });
      return this.walletClient.writeContract(request);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the hidden proposer hash for a specific game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param proposer - Address of the proposer
   * @returns Hidden proposer hash
   */
  proposerHidden = ({ gameId, turn, proposer }: { gameId: bigint; turn: bigint; proposer: Address }) => {
    return this.getTurnPlayersSalt({ gameId, turn, proposer }).then((salt) =>
      keccak256(encodePacked(["address", "bytes32"], [proposer, salt]))
    );
  };

  /**
   * Submits a proposal to the game
   * @param gameId - ID of the game
   * @param commitmentHash - Hash of the proposal commitment
   * @param encryptedProposal - Encrypted proposal data
   * @param proposer - Address of the proposer
   * @returns Transaction hash
   */
  submitProposal = async ({
    instanceAddress,
    gameId,
    commitmentHash,
    proposal,
    proposer,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    commitmentHash: Hex;
    proposal: string;
    proposer: Address;
  }) => {
    // let proposalData: GetAbiItemParameters<typeof RankifyDiamondInstanceAbi, "submitProposal">["args"];
    // proposalData[0].
    const encryptedProposal = await this.encryptionCallback(proposal);
    console.log("submitting proposal tx..", gameId, commitmentHash, proposal, proposer);

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "submitProposal",
        args: [{ gameId, commitmentHash, encryptedProposal, proposer }],
      });
      return this.walletClient.writeContract(request);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Decrypts votes for a specific game turn
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @returns Array of decrypted votes with player addresses
   */
  decryptTurnVotes = async ({
    instanceAddress,
    gameId,
    turn,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    turn: bigint;
  }) => {
    const evts = await this.publicClient.getContractEvents({
      address: instanceAddress,
      abi: RankifyDiamondInstanceAbi,
      eventName: "VoteSubmitted",
      args: { gameId, turn },
    });

    const votes = await Promise.all(
      evts.map(async (event) => {
        if (!event.args.player) throw new Error("No player found in event data, that is unexpected");
        if (!event.args.votesHidden) throw new Error("No votesHidden found in event data, that is unexpected");
        const decryptedVote = await this.decryptionCallback(event.args.votesHidden);
        const parsedVotes = JSON.parse(decryptedVote) as string[];
        return {
          player: event.args.player,
          votes: parsedVotes.map((v) => BigInt(v)),
        };
      })
    );

    return votes;
  };

  /**
   * Decrypts all votes for the current game turn
   * @param gameId - ID of the game
   * @returns Array of decrypted votes with player addresses
   */
  decryptVotes = async ({ instanceAddress, gameId }: { instanceAddress: Address; gameId: bigint }) => {
    const currentTurn = await this.publicClient.readContract({
      address: instanceAddress,
      abi: RankifyDiamondInstanceAbi,
      functionName: "getTurn",
      args: [gameId],
    });
    if (currentTurn === 0n) {
      console.error("No proposals in turn 0");
      return -1;
    }
    const votes = await this.decryptTurnVotes({ instanceAddress, gameId, turn: currentTurn });
    return votes.length === 0 ? -1 : votes;
  };

  /**
   * Checks if the current turn can be ended
   * @param gameId - ID of the game
   * @returns Boolean indicating if turn can be ended
   */
  canEndTurn = async ({ instanceAddress, gameId }: { instanceAddress: Address; gameId: bigint }) => {
    return this.publicClient.readContract({
      address: instanceAddress,
      abi: RankifyDiamondInstanceAbi,
      functionName: "canEndTurn",
      args: [gameId],
    });
  };

  /**
   * Gets the current turn number
   * @param gameId - ID of the game
   * @returns Current turn number
   */
  currentTurn = async ({ instanceAddress, gameId }: { instanceAddress: Address; gameId: bigint }) => {
    try {
      return this.publicClient.readContract({
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Gets the list of players in the game
   * @param gameId - ID of the game
   * @returns Array of player addresses
   */
  getPlayers = async ({ instanceAddress, gameId }: { instanceAddress: Address; gameId: bigint }) => {
    try {
      return this.publicClient.readContract({
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getPlayers",
        args: [gameId],
      });
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Ends the current turn and processes votes
   * @param gameId - ID of the game
   * @returns Transaction hash
   */
  endTurn = async ({ instanceAddress, gameId }: { instanceAddress: Address; gameId: bigint }) => {
    try {
      const turn = await this.publicClient.readContract({
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getTurn",
        args: [gameId],
      });

      const players = (await this.publicClient.readContract({
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "getPlayers",
        args: [gameId],
      })) as Address[];

      if (!Array.isArray(players)) {
        throw new Error("Expected players to be an array");
      }

      const oldProposals: {
        proposer: Address;
        proposal: string;
      }[] = [];
      const proposerIndices: bigint[] = [];
      let votes: { player: Address; votes: bigint[] }[] = [];
      //Proposals sequence is directly corresponding to proposers sequence
      if (turn != 1n) {
        const endedEvents = await this.publicClient.getContractEvents({
          address: instanceAddress,
          abi: RankifyDiamondInstanceAbi,
          eventName: "TurnEnded",
          args: { gameId, turn: turn - 1n },
        });
        const evt = endedEvents[0];
        if (endedEvents.length > 1) throw new Error("Multiple turns ended");
        const args = evt.args;
        const decryptedProposals = await this.decryptProposals({ instanceAddress, gameId, turn: turn - 1n });
        if (args.newProposals) {
          args.newProposals.forEach((proposal, idx) => {
            const proposer = decryptedProposals.find((p) => p.proposal === proposal)?.proposer;
            if (!proposer) throw new Error("No proposer found for proposal");
            oldProposals[idx] = {
              proposer,
              proposal: proposal,
            };
          });
        } else {
          // Boundary case if no-one proposed a thing
          players.forEach((p, idx) => {
            oldProposals[idx] = {
              proposer: p,
              proposal: "",
            };
          });
        }
        votes = await this.decryptTurnVotes({ instanceAddress, gameId, turn }).then((voteSubmissions) => {
          const orderedVotes: { player: Address; votes: bigint[] }[] = players.map((player) => ({
            player,
            votes: new Array(players.length).fill(0n) as bigint[],
          }));
          players.forEach((player, playerIdx) => {
            const vote = voteSubmissions.find((v) => v.player === player);
            if (vote) orderedVotes[playerIdx] = vote;
            else
              orderedVotes[playerIdx] = {
                player,
                votes: new Array(players.length).fill(0n) as bigint[],
              };
          });
          return orderedVotes;
        });
      }

      const newProposals = await this.decryptProposals({ instanceAddress, gameId, turn });
      players.forEach((player) => {
        let proposerIdx = oldProposals.findIndex((p) => player === p.proposer);
        if (proposerIdx === -1) proposerIdx = players.length; //Did not propose
        proposerIndices.push(BigInt(proposerIdx));
      });
      const tableData = players.map((player, idx) => ({
        player,
        proposerIndex: proposerIndices[idx],
        proposer: oldProposals[Number(proposerIndices[idx])].proposer,
      }));
      console.table(tableData);
      const shuffled = await this.shuffle(newProposals.map((x) => x.proposal));
      console.log(votes.map((v) => v.votes));

      const { request } = await this.publicClient.simulateContract({
        abi: RankifyDiamondInstanceAbi,
        account: this.walletClient.account,
        address: instanceAddress,
        functionName: "endTurn",
        args: [gameId, votes.map((v) => v.votes), shuffled, proposerIndices],
      });
      return this.walletClient.writeContract(request);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };
}
