import { Address, PublicClient } from "viem";
import { getContract, SupportedChains } from "../utils";

export default class RankTokenClient {
  chain: SupportedChains;
  publicClient: PublicClient;

  constructor({ chain, publicClient }: { chain: SupportedChains; publicClient: PublicClient }) {
    this.chain = chain;
    this.publicClient = publicClient;
  }

  getRankTokenURI = async () => {
    const rankToken = getContract(this.chain, "RankToken", this.publicClient);
    return rankToken.read.contractURI();
  };

  getRankTokenBalance = async (tokenId: bigint, account: Address) => {
    const rankToken = getContract(this.chain, "RankToken", this.publicClient);
    return rankToken.read.balanceOf([account, tokenId]);
  };
}
