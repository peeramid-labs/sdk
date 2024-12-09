import { Address, PublicClient } from "viem";
import { getContract } from "../utils";

export default class RankTokenClient {
  chainId: number;
  publicClient: PublicClient;

  constructor({ chainId, publicClient }: { chainId: number; publicClient: PublicClient }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
  }

  getRankTokenURI = async () => {
    const rankToken = getContract(this.chainId, "Rankify", this.publicClient) as any;
    return rankToken.read.contractURI();
  };

  getRankTokenBalance = async (tokenId: bigint, account: Address) => {
    const rankToken = getContract(this.chainId, "Rankify", this.publicClient) as any;
    return rankToken.read.balanceOf([account, tokenId]);
  };
}
