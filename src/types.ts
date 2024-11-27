import { BigNumber, Wallet, BytesLike } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
export { LibMultipass, Multipass as MultipassDiamond } from "@peeramid-labs/multipass/types/src/Multipass";

export enum SearchCriteria {
  id,
  username,
  address,
}
export interface SignerIdentity {
  name: string;
  id: string;
  wallet: Wallet | SignerWithAddress;
}
export interface RegisterMessage {
  name: BytesLike;
  id: BytesLike;
  domainName: BytesLike;
  validUntil: BigNumber;
  nonce: BigNumber;
}
