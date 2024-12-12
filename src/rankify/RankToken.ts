import { Address, PublicClient, getContract } from "viem";
import RankTokenAbi from "../abis/RankToken";

export default class RankTokenClient {
  chainId: number;
  publicClient: PublicClient;
  rankTokenAddress: Address;

  constructor({ address, chainId, publicClient }: { address: Address; chainId: number; publicClient: PublicClient }) {
    this.chainId = chainId;
    this.publicClient = publicClient;
    this.rankTokenAddress = address;
  }

  getRankTokenURI = () => {
    const rankToken = getContract({
      address: this.rankTokenAddress,
      abi: RankTokenAbi,
      client: this.publicClient,
    });
    return rankToken.read.contractURI();
  };

  getRankTokenBalance = async (tokenId: bigint, account: Address) => {
    const rankToken = getContract({
      address: this.rankTokenAddress,
      abi: RankTokenAbi,
      client: this.publicClient,
    });
    return rankToken.read.balanceOf([account, tokenId]);
  };
}
