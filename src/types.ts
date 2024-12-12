import { Hex, WalletClient } from "viem";
export { LibMultipass, Multipass as MultipassDiamond } from "@peeramid-labs/multipass/types/src/Multipass";

export enum SearchCriteria {
  id,
  username,
  address,
}
export interface SignerIdentity {
  name: string;
  id: string;
  wallet: WalletClient;
}
export interface RegisterMessage {
  name: Hex;
  id: Hex;
  domainName: Hex;
  validUntil: bigint;
  nonce: bigint;
}
