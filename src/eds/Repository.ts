import { type Address, Hex, PublicClient, getAddress, WalletClient, toHex } from "viem";
import RepositoryAbi from "../abis/Repository";

export class RepositoryClient {
  publicClient: PublicClient;
  walletClient: WalletClient;
  address: Address;
  createdAtBlock?: bigint;
  constructor({
    address,
    publicClient,
    walletClient,
  }: {
    address: Address;
    publicClient: PublicClient;
    walletClient: WalletClient;
  }) {
    this.address = getAddress(address);
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  async newRelease(distHash: Hex, metadata: string, version: { major: number; minor: number; patch: number }) {
    if (!this.walletClient.account) {
      throw new Error("Wallet client not found");
    }
    const hash = await this.walletClient.writeContract({
      address: this.address,
      abi: RepositoryAbi,
      functionName: "newRelease",
      args: [
        distHash,
        toHex(metadata),
        { major: BigInt(version.major), minor: BigInt(version.minor), patch: BigInt(version.patch) },
      ],
      chain: this.publicClient.chain,
      account: this.walletClient.account,
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.status) {
      throw new Error("Distribution addition failed");
    }
    return receipt;
  }

  async getLatestRelease() {
    return this.publicClient.readContract({
      address: this.address,
      abi: RepositoryAbi,
      functionName: "getLatest",
    });
  }

  async getName() {
    return this.publicClient.readContract({
      address: this.address,
      abi: RepositoryAbi,
      functionName: "repositoryName",
    });
  }

  async getUri() {
    return this.publicClient.readContract({
      address: this.address,
      abi: RepositoryAbi,
      functionName: "contractURI",
    });
  }
}
