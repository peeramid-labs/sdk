import {
  Address,
  WalletClient,
  PublicClient,
  keccak256,
  encodePacked,
  Hex,
  stringToHex,
  GetAbiItemParameters,
  zeroHash,
  ContractFunctionArgs,
  zeroAddress,
} from "viem";
import { RankifyDiamondInstanceAbi } from "../abis";
import InstanceBase from "./InstanceBase";
import { gameStatusEnum } from "../types";
import { handleRPCError } from "../utils";
import { publicKeyToAddress } from "viem/accounts";
import { logger } from "../utils/log";
import { buildPoseidon } from "circomlibjs";
import aes from "crypto-js/aes";
import { GmProposalParams, VoteAttestation } from "../types/contracts";
import cryptoJs from "crypto-js";
import { CircuitZKit, Groth16Implementer } from "@solarity/zkit";
import path from "path";
import { permuteArray, reversePermutation } from "../utils/permutations";

export interface ProposalsIntegrity {
  newProposals: ContractFunctionArgs<typeof RankifyDiamondInstanceAbi, "nonpayable", "endTurn">[2];
  permutation: bigint[];
  proposalsNotPermuted: string[];
  nullifier: bigint;
}

export type PrivateProposalsIntegrity15Groth16 = {
  commitments: bigint[];
  permutedProposals: bigint[];
  permutationCommitment: bigint;
  numActive: bigint;
  permutation: bigint[];
  randomnesses: bigint[];
  permutationRandomness: bigint;
};

interface JoinGameProps {
  gameId: bigint;
  participant: Address;
  instanceAddress: Address;
  participantPubKeyHash: Hex;
}

/**
 * GameMaster class for managing game state and cryptographic operations in Rankify
 * Extends InstanceBase to provide game master specific functionality
 * @public
 */
export class GameMaster {
  walletClient: WalletClient;
  publicClient: PublicClient;
  chainId: number;
  /**
   * Creates a new GameMaster instance

   * @param walletClient - Viem wallet client for transactions
   * @param publicClient - Viem public client for reading state
   * @param chainId - Chain ID of the network
   */
  constructor({
    walletClient,
    chainId,
    publicClient,
  }: {
    walletClient: WalletClient;
    publicClient: PublicClient;
    chainId: number;
  }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  /**
   * Decrypts a proposal for a specific game turn
   * @param proposal - The encrypted proposal
   * @param turn - The turn number
   * @param instanceAddress - The address of the instance
   * @param gameId - The ID of the game
   * @param proposer - The address of the proposer
   * @returns The decrypted proposal
   */
  decryptProposal = async ({
    proposal,
    turn,
    instanceAddress,
    gameId,
    proposer,
    instance,
  }: {
    proposal: string;
    turn: bigint;
    instanceAddress: Address;
    proposer: Address;
    gameId: bigint;
    instance?: InstanceBase;
  }) => {
    const _instance =
      instance ?? new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const proposerPubKey = await _instance.getPlayerPubKey({
      instanceAddress,
      gameId,
      player: proposer,
    });
    const sharedKey = _instance.sharedSigner({
      publicKey: proposerPubKey,
      privateKey: await this.gameKey({ gameId, contractAddress: instanceAddress }),
      gameId,
      turn,
      contractAddress: instanceAddress,
      chainId: this.chainId,
    });
    logger(`Decrypting proposal ${proposal} with shared key (hashed value: ${keccak256(sharedKey)})`);
    const decryptedProposal = aes.decrypt(proposal, sharedKey).toString(cryptoJs.enc.Utf8);
    logger(`Decrypted proposal ${decryptedProposal}`);
    return decryptedProposal;
  };

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
    logger(
      `Getting proposals for instance ${instanceAddress}, game ${gameId}, turn ${turn.toString()}, proposer ${proposer}`
    );
    const evts = await this.publicClient.getContractEvents({
      abi: RankifyDiamondInstanceAbi,
      address: instanceAddress,
      eventName: "ProposalSubmitted",
      args: { gameId: gameId, turn: turn, proposer: proposer },
      fromBlock: 0n,
    });
    logger(`Found ${evts.length} proposals`);
    const instance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    if (evts.length == 0) return [];
    logger(`Decrypting ${evts.length} proposals`);
    const proposals = await Promise.all(
      evts.map(async (log) => {
        logger(`Decrypting proposal ${log.args.proposer}`);
        if (!log.args.proposer) throw new Error("No proposer");
        if (!log.args.encryptedProposal) throw new Error("No proposalEncryptedByGM");
        return {
          proposer: log.args.proposer,
          proposal: await this.decryptProposal({
            proposal: log.args.encryptedProposal,
            turn: turn,
            instanceAddress: instanceAddress,
            gameId: gameId,
            proposer: log.args.proposer,
            instance,
          }),
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
  getPermutation = async ({
    gameId,
    turn,
    size,
    verifierAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    size: number;
    verifierAddress: Address;
  }) => {
    const maxSize = 15;
    const turnSalt = await this.getTurnSalt({ gameId, turn, verifierAddress });
    // Create deterministic seed from game parameters and GM's signature

    // Use the seed to generate permutation
    const permutation: number[] = Array.from({ length: maxSize }, (_, i) => i);

    // Fisher-Yates shuffle with deterministic randomness
    for (let i = size - 1; i >= 0; i--) {
      // Generate deterministic random number for this position
      const randHash = keccak256(encodePacked(["uint256", "uint256"], [turnSalt, BigInt(i)]));
      const rand = BigInt(randHash);
      const j = Number(rand % BigInt(i + 1));

      // Swap elements
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }

    // Ensure inactive slots map to themselves
    for (let i = size; i < maxSize; i++) {
      permutation[i] = i;
    }

    return { permutation, turnSalt };
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
    // This is kept secret to generate witness

    // Create deterministic seed from game parameters and GM's signature
    const { permutation, turnSalt } = await this.getPermutation({ gameId, turn, size, verifierAddress });

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

    const commitment = BigInt(poseidon.F.toObject(poseidon([PoseidonThird, turnSalt])));

    return {
      permutation,
      secret: turnSalt,
      commitment,
    };
  };

  /**
   * Permutes an array based on a deterministic permutation
   * @param array - Array to permute
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param verifierAddress - Address of the verifier
   * @returns The permuted array
   */
  permuteArray = async <T>({
    array,
    gameId,
    turn,
    verifierAddress,
  }: {
    array: T[];
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
  }): Promise<T[]> => {
    const { permutation } = await this.getPermutation({ gameId, turn, size: array.length, verifierAddress });
    return permuteArray({ array, permutation });
  };

  /**
   * Reverses a permutation of an array
   * @param permutedArray - Array to reverse
   * @param gameId - ID of the game
   * @param turn - Turn number
   * @param verifierAddress - Address of the verifier
   * @returns The original array
   */
  reversePermutation = async <T>({
    permutedArray,
    gameId,
    turn,
    verifierAddress,
  }: {
    permutedArray: T[];
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
  }): Promise<T[]> => {
    const { permutation } = await this.getPermutation({ gameId, turn, size: permutedArray.length, verifierAddress });
    return reversePermutation({ array: permutedArray, permutation });
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
    const gameKey = await this.gameKey({ gameId, contractAddress: verifierAddress });
    const instance = new InstanceBase({
      instanceAddress: verifierAddress,
      publicClient: this.publicClient,
      chainId: this.chainId,
    });
    const seed = instance.pkdf({
      privateKey: gameKey,
      turn,
      gameId,
      contractAddress: verifierAddress,
      chainId: this.chainId,
      scope: "turnSalt",
    });
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
    logger(`Generating vote salt for player ${player} in game ${gameId}, turn ${turn}`);
    const result = await this.generateDeterministicPermutation({
      gameId,
      turn: turn - 1n,
      verifierAddress,
      size,
    }).then((perm) => {
      return keccak256(encodePacked(["address", "uint256"], [player, perm.secret]));
    });
    logger(`Generated vote salt for player ${player}`);
    return result;
  };

  getProposalsVotedUpon = async ({
    instanceAddress,
    gameId,
    turn,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    turn: bigint;
  }) => {
    const oldProposals: {
      proposer: Address;
      proposal: string;
    }[] = [];
    //Proposals sequence is directly corresponding to proposers sequence
    if (turn != 1n) {
      logger(`Getting proposals voted upon for game ${gameId.toString()}, turn ${(turn - 1n).toString()}`, 3);
      const endedEvents = await this.publicClient.getContractEvents({
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        eventName: "TurnEnded",
        args: { gameId, turn: turn - 1n },
        fromBlock: 0n,
      });
      const evt = endedEvents[0];
      logger("evt:", 3);
      logger(evt, 3);
      if (endedEvents.length > 1) throw new Error("Multiple turns ended");
      const args = evt.args;
      const decryptedProposals = await this.decryptProposals({ instanceAddress, gameId, turn: turn - 1n });
      if (args.newProposals) {
        args.newProposals.slice(0, args?.players?.length).forEach((proposal, idx) => {
          if (proposal !== "") {
            const proposer = decryptedProposals.find((p) => p.proposal === proposal)?.proposer;
            if (!proposer) throw new Error("No proposer found for proposal");
            oldProposals[idx] = {
              proposer,
              proposal: proposal,
            };
          }
        });
      } else {
        const _players = await this.publicClient.readContract({
          address: instanceAddress,
          abi: RankifyDiamondInstanceAbi,
          functionName: "getPlayers",
          args: [gameId],
        });

        // Boundary case if no-one proposed a thing
        _players.forEach((p, idx) => {
          oldProposals[idx] = {
            proposer: p,
            proposal: "",
          };
        });
      }
    }
    return oldProposals;
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
    turn,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    player: Address;
    turn?: bigint;
  }) => {
    const baseInstance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    let currentTurn: bigint = 0n;
    if (!turn) {
      const r = await baseInstance.getOngoingProposals(gameId);
      currentTurn = r.currentTurn;
      if (currentTurn == 0n) {
        console.error("No proposals in turn 0");
        return -1;
      }
    } else {
      currentTurn = turn;
    }

    const proposalsVotedUpon = await this.getProposalsVotedUpon({ instanceAddress, gameId, turn: currentTurn });
    return proposalsVotedUpon.findIndex((p) => p.proposer === player);
  };

  validateJoinGame = async (props: {
    gameId: bigint;
    participant: Address;
    instanceAddress: Address;
  }): Promise<{ result: boolean; errorMessage: string }> => {
    const { gameId, participant, instanceAddress } = props;
    try {
      const baseInstance = new InstanceBase({
        instanceAddress,
        publicClient: this.publicClient,
        chainId: this.chainId,
      });
      const gameState = await baseInstance.getGameStateDetails(gameId);
      if (gameState.gamePhase !== gameStatusEnum.open) {
        return { result: false, errorMessage: "Game is not open for registration" };
      }
      if (gameState.players.length === Number(gameState.maxPlayerCnt)) {
        return { result: false, errorMessage: "Game is already full" };
      }
      if (gameState.players.indexOf(participant) !== -1) {
        return { result: false, errorMessage: "Player already registered" };
      }

      return { result: true, errorMessage: "" };
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Signs a joining game event
   * @param gameId - ID of the game
   * @param participant - Address of the participant
   * @param instanceAddress - Address of the game instance
   * @returns Signature and gmCommitment
   */
  signJoiningGame = async (props: JoinGameProps, timeToJoin: number = 60 * 10) => {
    if (!this.walletClient.account) throw new Error("No account");
    logger(`Signing joining game..`);
    const { gameId, participant, instanceAddress, participantPubKeyHash } = props;
    const baseInstance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const eip712 = await baseInstance.getEIP712Domain();
    logger(
      {
        gameId: props.gameId,
        participant: props.participant,
        instanceAddress: props.instanceAddress,
        chainId: this.chainId,
        name: eip712.name,
        version: eip712.version,
        gameMaster: this.walletClient.account?.address,
        participantPubKeyHash,
      },
      2
    );

    const deadline = BigInt(Math.floor(Date.now() / 1000) + timeToJoin);

    //ToDo This is placeholder for now, we will need it later in staking
    const gmCommitment = stringToHex("0x123131231311", { size: 32 });

    console.log(
      {
        name: eip712.name,
        version: eip712.version,
        chainId: this.chainId,
        verifyingContract: instanceAddress,
      },
      {
        participant,
        gameId,
        gmCommitment,
        deadline,
        participantPubKeyHash,
      }
    );

    const signature = await this.walletClient.signTypedData({
      domain: {
        name: eip712.name,
        version: eip712.version,
        chainId: this.chainId,
        verifyingContract: instanceAddress,
      },
      types: {
        AttestJoiningGame: [
          { type: "address", name: "participant" },
          { type: "uint256", name: "gameId" },
          { type: "bytes32", name: "gmCommitment" },
          { type: "uint256", name: "deadline" },
          { type: "bytes32", name: "participantPubKeyHash" },
        ],
      },
      message: {
        participant,
        gameId,
        gmCommitment,
        deadline,
        participantPubKeyHash,
      },
      primaryType: "AttestJoiningGame",
      account: this.walletClient.account,
    });

    return { signature, gmCommitment, deadline };
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
    voterSignature,
    ballotHash,
    ballotId,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    vote: bigint[];
    voter: Address;
    voterSignature: Hex;
    ballotHash: Hex;
    ballotId: string;
  }) => {
    if (!gameId) throw new Error("No gameId");
    if (!vote) throw new Error("No votesHidden");
    if (!voter) throw new Error("No voter");
    const proposerIdx = await this.findPlayerOngoingProposalIndex({ instanceAddress, gameId, player: voter });
    if (proposerIdx == -1) throw new Error("You are not a proposer in this game");
    if (vote[proposerIdx] !== 0n) throw new Error("You cannot vote for your own proposal");
    if (!this.walletClient?.account?.address) throw new Error("No account address found");
    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "submitVote",
        args: [gameId, ballotId, voter, zeroHash, voterSignature, ballotHash],
      });
      return this.walletClient.writeContract(request);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  /**
   * Types for proposal submission
   */
  private proposalTypes = {
    SubmitProposal: [
      { type: "uint256", name: "gameId" },
      { type: "address", name: "proposer" },
      { type: "string", name: "encryptedProposal" },
      { type: "uint256", name: "commitment" },
    ],
  };

  private signProposal = async ({
    verifierAddress,
    proposer,
    gameId,
    encryptedProposal,
    commitment,
    eip712,
  }: {
    verifierAddress: Address;
    proposer: Address;
    gameId: bigint;
    encryptedProposal: string;
    commitment: bigint;
    eip712: {
      name: string;
      version: string;
    };
  }): Promise<`0x${string}`> => {
    // Generate typed data hash matching Solidity's keccak256(abi.encode(...))
    if (!this.walletClient.account) throw new Error("No account");
    return this.walletClient.signTypedData({
      domain: {
        name: eip712.name,
        version: eip712.version,
        chainId: this.chainId,
        verifyingContract: verifierAddress,
      },
      types: this.proposalTypes,
      message: {
        gameId,
        proposer,
        encryptedProposal,
        commitment,
      },
      primaryType: "SubmitProposal",
      account: this.walletClient.account,
    });
  };

  proposalValues = async ({
    instanceAddress,
    gameId,
    proposal,
    proposer,
    turn,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    proposal: string;
    proposer: Address;
    turn: bigint;
  }) => {
    const instance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const proposerPubKey = await instance.getPlayerPubKey({
      instanceAddress,
      gameId,
      player: proposer,
    });
    const sharedKey = instance.sharedSigner({
      publicKey: proposerPubKey,
      privateKey: await this.gameKey({ gameId, contractAddress: instanceAddress }),
      gameId,
      turn,
      contractAddress: instanceAddress,
      chainId: this.chainId,
    });
    // const poseidon = await buildPoseidon();
    const proposalValue = BigInt(keccak256(encodePacked(["string"], [proposal])));
    const randomnessValue = BigInt(keccak256(encodePacked(["string"], [sharedKey])));
    // Calculate commitment using poseidon
    return {
      proposalValue,
      randomnessValue,
      proposal,
    };
  };

  /**
   * Encrypts a proposal
   * @param proposal - Proposal to encrypt
   * @param turn - Turn number
   * @param instanceAddress - Address of the game instance
   * @param gameId - ID of the game
   * @param proposerPubKey - Public key of the proposer
   * @returns Encrypted proposal and shared key
   */
  encryptProposal = async ({
    proposal,
    turn,
    instanceAddress,
    gameId,
    proposerPubKey,
  }: {
    proposal: string;
    turn: bigint;
    instanceAddress: Address;
    gameId: bigint;
    proposerPubKey: Hex;
  }) => {
    const instance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const sharedKey = instance.sharedSigner({
      publicKey: proposerPubKey,
      privateKey: await this.gameKey({ gameId, contractAddress: instanceAddress }),
      gameId,
      turn,
      contractAddress: instanceAddress,
      chainId: this.chainId,
    });
    logger(`Encrypting proposal ${proposal} with shared key (hashed value: ${keccak256(sharedKey)})`);
    const encryptedProposal = aes.encrypt(proposal, sharedKey).toString();
    logger(`Encrypted proposal ${encryptedProposal}`);
    return { encryptedProposal, sharedKey };
  };

  /**
   * Attests a proposal
   * @param instanceAddress - Address of the game instance
   * @param gameId - ID of the game
   * @param proposal - Proposal to attest
   * @param proposerPubKey - Public key of the proposer
   * @param turn - Turn number
   * @returns The attested proposal
   */
  attestProposal = async ({
    instanceAddress,
    gameId,
    proposal,
    proposerPubKey,
    turn,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    proposal: string;
    proposerPubKey: Hex;
    turn: bigint;
  }) => {
    const proposerAddress = publicKeyToAddress(proposerPubKey);
    logger(`Creating proposal secrets for player ${proposerAddress} in game ${gameId}`);
    const poseidon = await buildPoseidon();
    const instance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const { encryptedProposal, sharedKey } = await this.encryptProposal({
      proposal,
      turn,
      instanceAddress,
      gameId,
      proposerPubKey,
    });
    const proposalValue = BigInt(keccak256(encodePacked(["string"], [proposal])));
    const randomnessValue = BigInt(keccak256(encodePacked(["string"], [sharedKey])));
    // Calculate commitment using poseidon
    const hash = poseidon([proposalValue, randomnessValue]);
    const poseidonCommitment = BigInt(poseidon.F.toObject(hash));
    const eip712 = await instance.getEIP712Domain();
    const signature = await this.signProposal({
      verifierAddress: instanceAddress,
      proposer: proposerAddress,
      gameId,
      encryptedProposal,
      commitment: poseidonCommitment,
      eip712,
    });
    const params: GmProposalParams = {
      gameId,
      encryptedProposal,
      commitment: poseidonCommitment,
      proposer: proposerAddress,
      gmSignature: signature,
    };

    logger(`Generated proposal secrets with commitment ${poseidonCommitment}`);
    return {
      submissionParams: params,
      proposal,
      proposerAddress,
      proposalValue,
      randomnessValue,
    };
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
    submissionParams,
    proposerSignature,
  }: {
    instanceAddress: Address;
    submissionParams: GmProposalParams;
    proposerSignature: Hex;
  }) => {
    // let proposalData: GetAbiItemParameters<typeof RankifyDiamondInstanceAbi, "submitProposal">["args"];
    // proposalData[0].
    const txParams: GetAbiItemParameters<typeof RankifyDiamondInstanceAbi, "submitProposal">["args"] = [
      {
        ...submissionParams,
        proposerSignature,
      },
    ];

    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: instanceAddress,
        abi: RankifyDiamondInstanceAbi,
        functionName: "submitProposal",
        args: txParams,
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
    logger(`Found ${evts.length} events`);
    if (evts.length === 0) return [];

    // Process events one by one to allow errors to propagate
    const votes = [];
    for (const event of evts) {
      if (!event.args.player) throw new Error("No player in event");
      if (!event.args.sealedBallotId) throw new Error("No sealedBallotId in event");

      const turnKey = await this.calculateSharedTurnKey({
        instanceAddress,
        gameId,
        turn,
        player: event.args.player,
      });

      const decryptedVotes = await this.decryptVote(event.args.sealedBallotId, turnKey);
      votes.push({
        player: event.args.player,
        votes: decryptedVotes,
      });
    }

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
    logger(`Ending turn for game ${gameId}`, 2);
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

      logger(`Current turn: ${turn}, Players count: ${players.length}`, 2);
      if (!Array.isArray(players)) {
        throw new Error("Expected players to be an array");
      }

      const proposerIndices: bigint[] = [];
      const oldProposals = await this.getProposalsVotedUpon({ instanceAddress, gameId, turn });

      const decryptedProposals = await this.decryptProposals({ instanceAddress, gameId, turn });
      logger(decryptedProposals);
      const proposals = players.map((player) => {
        const proposal = decryptedProposals.find((p) => p.proposer === player)?.proposal ?? "";
        return {
          proposer: player,
          proposal,
        };
      });
      const maxSize = 15;
      if (proposals.length < maxSize) {
        for (let i = proposals.length; i < maxSize; i++) {
          proposals.push({
            proposer: zeroAddress,
            proposal: "",
          });
        }
      }
      logger(proposals);
      players.forEach((player) => {
        let proposerIdx = oldProposals.findIndex((p) => player === p.proposer);
        if (proposerIdx === -1) proposerIdx = players.length; //Did not propose
        proposerIndices.push(BigInt(proposerIdx));
      });
      const voteDecrypted = await this.decryptTurnVotes({ instanceAddress, gameId, turn });

      const votes = await Promise.all(
        players.map(async (player) => {
          const vote = voteDecrypted.find((v) => v.player === player);
          if (!vote?.votes) return players.map(() => 0n);
          return vote.votes;
        })
      );

      const tableData = players.map((player, idx) => ({
        player,
        proposerIndex: proposerIndices[idx],
        proposer: oldProposals[Number(proposerIndices[idx])]?.proposer || "not-proposed",
      }));
      console.table(tableData);
      const attested = await this.getProposalsIntegrity({
        gameId,
        turn,
        verifierAddress: instanceAddress,
        size: players.length,
        proposals,
      });

      logger(`votes:`);
      logger(votes);

      const { request } = await this.publicClient.simulateContract({
        abi: RankifyDiamondInstanceAbi,
        account: this.walletClient.account,
        address: instanceAddress,
        functionName: "endTurn",
        args: [gameId, votes, attested.newProposals, attested.permutation, attested.nullifier],
      });
      return this.walletClient.writeContract(request);
    } catch (e) {
      throw await handleRPCError(e);
    }
  };

  gameKey = async ({ gameId, contractAddress }: { gameId: bigint; contractAddress: Address }): Promise<Hex> => {
    logger(`Signing game key for game ${gameId} at address ${contractAddress}`);
    const message = encodePacked(["uint256", "address", "string"], [gameId, contractAddress, "gameKey"]);
    logger(`Signing message: ${message}`, 2);
    if (!this.walletClient.account) throw new Error("No account");
    const gameKey = await this.walletClient
      .signMessage({
        message,
        account: this.walletClient.account,
      })
      .then((sig) => keccak256(sig));
    logger(`Game key: ${gameKey}`, 2);
    return gameKey;
  };

  private calculateSharedTurnKey = async ({
    instanceAddress,
    gameId,
    turn,
    player,
  }: {
    instanceAddress: Address;
    gameId: bigint;
    turn: bigint;
    player: Address;
  }) => {
    logger(`Calculating shared turn key for player ${player} in game ${gameId} at address ${instanceAddress}`);
    const instance = new InstanceBase({ instanceAddress, publicClient: this.publicClient, chainId: this.chainId });
    const playerPubKey = await instance.getPlayerPubKey({ instanceAddress, gameId, player });
    logger(`Player public key: ${playerPubKey}`, 2);

    return instance.sharedSigner({
      publicKey: playerPubKey,
      privateKey: await this.gameKey({ gameId, contractAddress: instanceAddress }),
      gameId,
      turn,
      contractAddress: instanceAddress,
      chainId: this.chainId,
    });
  };

  private decryptVote = async (vote: string, privateKey: Hex): Promise<bigint[]> => {
    const decrypted = aes.decrypt(vote, privateKey).toString(cryptoJs.enc.Utf8);
    if (!decrypted) {
      throw new Error("Failed to decrypt vote");
    }

    try {
      const parsed = JSON.parse(decrypted) as string[];
      logger(`Decrypted vote:`, 2);
      logger(parsed, 2);
      return parsed.map((v) => BigInt(v));
      // eslint-disable-next-line
    } catch (e: any) {
      throw new Error("Unexpected token");
    }
  };
  /**
   * Creates and signs a vote for testing purposes
   * @param params - Parameters including voter, game info, and vote configuration
   * @returns A complete mock vote with signatures
   */
  attestVote = async ({
    voter,
    gameId,
    turn,
    vote,
    verifierAddress,
  }: {
    gameId: bigint;
    turn: bigint;
    vote: bigint[];
    verifierAddress: Address;
    voter: Address;
  }): Promise<VoteAttestation> => {
    logger(`Attesting vote for player ${voter} in game ${gameId}, turn ${turn}`);

    const gameSize = (await this.getPlayers({ instanceAddress: verifierAddress, gameId })).length;
    const instance = new InstanceBase({
      instanceAddress: verifierAddress,
      publicClient: this.publicClient,
      chainId: this.chainId,
    });
    const eip712 = await instance.getEIP712Domain();

    const playerSalt = await this.getTurnPlayersSalt({
      gameId,
      turn,
      player: voter,
      verifierAddress,
      size: gameSize,
    });

    const ballot = {
      vote: vote,
      salt: playerSalt,
    };
    const ballotHash: string = keccak256(encodePacked(["uint256[]", "bytes32"], [vote, playerSalt]));

    const turnKey = await this.calculateSharedTurnKey({
      instanceAddress: verifierAddress,
      gameId,
      turn,
      player: voter,
    });

    const ballotId = aes.encrypt(JSON.stringify(ballot.vote.map((v) => v.toString())), turnKey).toString();
    const gmSignature = await this.signVote({
      verifierAddress,
      voter,
      gameId,
      sealedBallotId: ballotId,
      ballotHash,
      name: eip712.name,
      version: eip712.version,
    });

    logger(`Vote attested for player ${voter} by ${this.walletClient.account?.address}`);
    logger(
      {
        gameId,
        turn,
        vote,
        verifierAddress,
        gameSize,
        name: eip712.name,
        version: eip712.version,
        chainId: this.chainId,
      },
      2
    );
    return { vote, ballotHash, ballot, ballotId, gmSignature };
  };

  /**
   * Signs a vote
   * @param params - Parameters including voter, game info, and vote configuration
   * @returns The signed vote
   */
  signVote = async (params: {
    verifierAddress: Address;
    voter: Address;
    gameId: bigint;
    sealedBallotId: string;
    ballotHash: string;
    name: string;
    version: string;
  }): Promise<Hex> => {
    const { voter, gameId, verifierAddress, sealedBallotId, ballotHash, name, version } = params;
    logger(`Signing vote for player ${voter} in game ${gameId}`);

    const types = {
      SubmitVote: [
        { name: "gameId", type: "uint256" },
        { name: "voter", type: "address" },
        { name: "sealedBallotId", type: "string" },
        { name: "ballotHash", type: "bytes32" },
      ],
    };

    if (!this.walletClient.account) throw new Error("No account");

    const signature = await this.walletClient.signTypedData({
      domain: {
        name,
        version,
        chainId: this.chainId,
        verifyingContract: verifierAddress,
      },
      types,
      primaryType: "SubmitVote",
      message: {
        gameId,
        voter,
        sealedBallotId,
        ballotHash,
      },
      account: this.walletClient.account,
    });
    logger(`Vote signed for player ${voter}`);
    return signature;
  };

  /**
   * Generates integrity data for the end of a game turn
   * @param params - Parameters including game info, turn, and proposal data
   * @returns Integrity data including permutation, secret, and proof
   */
  generateEndTurnIntegrity = async ({
    gameId,
    turn,
    verifierAddress,
    size = 15,
    proposals,
  }: {
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
    size?: number;
    proposals: { proposal: string; proposer: Address }[];
  }) => {
    let _proposals = [...proposals];

    const { permutation, secret: nullifier } = await this.generateDeterministicPermutation({
      gameId,
      turn: turn - 1n,
      verifierAddress,
      size,
    });

    const values = await Promise.all(
      _proposals.map((p) =>
        p.proposal === ""
          ? {
              proposalValue: 0n,
              randomnessValue: 0n,
              proposer: p.proposer,
            }
          : this.proposalValues({
              instanceAddress: verifierAddress,
              gameId,
              proposal: p.proposal,
              turn,
              proposer: p.proposer,
            })
      )
    );

    logger("proposals with added empty proposals:", 3);
    logger(_proposals, 3);

    const inputs = await this.createInputs({
      numActive: size,
      proposals: values.map((v) => v.proposalValue),
      commitmentRandomnesses: values.map((v) => v.randomnessValue),
      gameId,
      turn,
      verifierAddress,
    });
    logger("inputs:", 3);
    logger(inputs, 3);

    // Apply permutation to proposals array
    const permutedProposals = permuteArray({ array: _proposals, permutation: inputs.permutation });

    const config = {
      circuitName: "ProposalsIntegrity15",
      circuitArtifactsPath: path.join(__dirname, "../../zk_artifacts/circuits/proposals_integrity_15.circom/"),
      verifierDirPath: path.join(__dirname, "../../zk_artifacts/verifiers"),
    };

    const implementer = new Groth16Implementer();
    const circuit = new CircuitZKit<"groth16">(config, implementer);
    const proof = await circuit.generateProof(inputs);
    logger("proof:", 3);
    logger(proof, 3);
    const callData = await circuit.generateCalldata(proof);
    logger("callData:", 3);
    logger(callData, 3);

    if (!proof) {
      throw new Error("Proof not found");
    }

    // const callData = await circuit.generateCalldata(proof);
    const a: readonly [bigint, bigint] = callData[0].map((a) => BigInt(a)) as [bigint, bigint];
    const b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]] = callData[1].map((b) =>
      b.map((b) => BigInt(b))
    ) as unknown as [readonly [bigint, bigint], readonly [bigint, bigint]];
    const c: readonly [bigint, bigint] = callData[2].map((c) => BigInt(c)) as [bigint, bigint];
    return {
      commitment: inputs.permutationCommitment,
      nullifier,
      permutation: permutation,
      permutedProposals: permutedProposals.map((proposal) => proposal.proposal),
      a,
      b,
      c,
    };
  };

  /**
   * Gets proposal integrity data for testing
   * @param params - Parameters including game info and proposal data
   * @returns Proposal integrity information including permutations and proofs
   */
  async getProposalsIntegrity({
    size,
    gameId,
    turn,
    proposals,
    verifierAddress,
  }: {
    size: number;
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
    idlers?: number[];
    proposals: { proposal: string; proposer: Address }[];
  }): Promise<ProposalsIntegrity> {
    logger(`Generating proposals integrity for game ${gameId}, turn ${turn} with ${size} players.`);

    const { commitment, nullifier, permutation, permutedProposals, a, b, c } = await this.generateEndTurnIntegrity({
      gameId,
      turn,
      verifierAddress,
      size,
      proposals,
    });

    logger(`Generated proposals integrity with commitment ${commitment}`);
    return {
      newProposals: {
        a,
        b,
        c,
        proposals: permutedProposals,
        permutationCommitment: commitment,
      },
      permutation: permutation.map((p) => BigInt(p)),
      proposalsNotPermuted: proposals.map((proposal) => proposal.proposal),
      nullifier,
    };
  }

  /**
   * Creates inputs for the proposal integrity circuit
   * @param params - Parameters including number of active proposals, proposals, commitment random numbers, game ID, turn, and verifier address
   * @returns The inputs for the proposal integrity circuit
   */
  createInputs = async ({
    numActive,
    proposals,
    commitmentRandomnesses,
    gameId,
    turn,
    verifierAddress,
  }: {
    numActive: number;
    proposals: bigint[];
    commitmentRandomnesses: bigint[];
    gameId: bigint;
    turn: bigint;
    verifierAddress: Address;
  }): Promise<PrivateProposalsIntegrity15Groth16> => {
    const poseidon = await buildPoseidon();
    const maxSize = 15;

    // Initialize arrays with zeros
    const commitments: bigint[] = Array(maxSize).fill(0n);
    const randomnesses: bigint[] = Array(maxSize).fill(0n);
    const permutedProposals: bigint[] = Array(maxSize).fill(0n);

    // Generate deterministic permutation
    const { permutation, secret, commitment } = await this.generateDeterministicPermutation({
      gameId,
      turn,
      verifierAddress,
      size: numActive,
    });

    // Fill arrays with values
    for (let i = 0; i < maxSize; i++) {
      if (i < numActive) {
        // Active slots
        const proposal = proposals[i];
        const randomness = commitmentRandomnesses[i];
        const hash = poseidon([proposal, randomness]);
        commitments[i] = BigInt(poseidon.F.toObject(hash));
        randomnesses[i] = randomness;
        // Store proposal in permuted position
        permutedProposals[permutation[i]] = proposal;
      } else {
        logger(`Inactive slot ${i}`, 3);
        // Inactive slots
        const hash = poseidon([0n, 0n]);
        commitments[i] = BigInt(poseidon.F.toObject(hash));
        randomnesses[i] = 0n;
        // permutedProposals already 0n
      }
    }
    return {
      numActive: BigInt(numActive),
      commitments,
      permutedProposals,
      permutationCommitment: commitment,
      permutation: permutation.map((p) => BigInt(p)),
      randomnesses,
      permutationRandomness: secret,
    };
  };
}

export default GameMaster;
