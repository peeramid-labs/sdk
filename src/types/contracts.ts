import { Address, Hex } from "viem";

/**
 * Interface representing the contract addresses for a MAO instance
 * @public
 */
export interface MAOInstances {
  /** Address of the governance token contract */
  govToken: string;
  /** Address of the governance token access manager contract */
  govTokenAccessManager: string;
  /** Address of the ACID instance contract */
  ACIDInstance: string;
  /** Address of the ACID access manager contract */
  ACIDAccessManager: string;
  /** Address of the rank token contract */
  rankToken: string;
}

export interface GmProposalParams {
  gameId: bigint;
  encryptedProposal: string;
  commitment: bigint;
  proposer: Address;
  gmSignature: Hex;
}

export interface VoteAttestation {
  vote: bigint[];
  ballotHash: string;
  ballot: {
    vote: bigint[];
    salt: Hex;
  };
  ballotId: string;
  gmSignature: Hex;
}
