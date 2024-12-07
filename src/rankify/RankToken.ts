import { RankToken } from "rankify-contracts/types";

export default class RankTokenClient {
  rankToken: RankToken;

  constructor({ rankToken }: { rankToken: RankToken }) {
    this.rankToken = rankToken;
  }

  getRankTokenURI = async () => {
    return this.rankToken.contractURI();
  };

  getRankTokenBalance = async (tokenId: string, account: string) => {
    return this.rankToken.balanceOf(account, tokenId);
  };
}
