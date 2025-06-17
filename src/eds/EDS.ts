import { type Address, PublicClient, stringToHex, WalletClient } from "viem";
import { EnvioGraphQLClient } from "../utils/EnvioGraphQLClient";
import { bytecode } from "@peeramid-labs/eds/artifacts/src/repositories/OwnableRepository.sol/OwnableRepository.json";
import { RepositoryClient } from "./Repository";
import { OwnableRepositoryAbi } from "../abis";

export class EDSClient {
  publicClient: PublicClient;
  walletClient: WalletClient;
  envioClient: EnvioGraphQLClient;
  constructor({
    publicClient,
    walletClient,
    envioClient,
  }: {
    publicClient: PublicClient;
    walletClient: WalletClient;
    envioClient: EnvioGraphQLClient;
  }) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.envioClient = envioClient;
  }

  async newRepository(owner: Address, name: string, uri: string): Promise<RepositoryClient> {
    if (!this.walletClient.account) {
      throw new Error("Wallet client not found");
    }
    const hash = await this.walletClient.deployContract({
      abi: OwnableRepositoryAbi,
      bytecode: bytecode as `0x${string}`,
      args: [owner, stringToHex(name, { size: 32 }), uri],
      account: this.walletClient.account,
      chain: this.publicClient.chain,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error("Repository deployment failed");
    }
    return new RepositoryClient({
      address: receipt.contractAddress,
      publicClient: this.publicClient,
      walletClient: this.walletClient,
    });
  }
}
