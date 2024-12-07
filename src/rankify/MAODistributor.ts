import { DistributorClient } from "../eds/Distributor";
import { getArtifact } from "../utils";
import { SupportedChains } from "../utils";
import { MAOInstances, parseInstantiated } from "rankify-contracts/scripts/parseInstantiated";
import instanceAbi from "../abis/RankifyDiamondInstance";
import rankTokenAbi from "../abis/RankToken";
import govtTokenAbi from "../abis/DistributableGovernanceERC20";
import govtAccessManagerAbi from "../abis/SimpleAccessManager";
import {
  getAddress,
  getContract,
  GetContractReturnType,
  isAddress,
  Chain,
  Hex,
  encodeAbiParameters,
  GetAbiItemParameters,
  getAbiItem,
  stringToHex,
  PublicClient,
  WalletClient,
  parseEventLogs,
} from "viem";
import MaoDistributionAbi from "../abis/MAODistribution";
import distributorAbi from "../abis/IDistributor";

export type TokenArgumentsStructOutput = {
  tokenName: string;
  tokenSymbol: string;
};

export type UserRankifySettingsStructOutput = {
  principalCost: bigint;
  principalTimeConstant: bigint;
  metadata: string;
  rankTokenURI: string;
  rankTokenContractURI: string;
};

export type DistributorArgumentsStruct = {
  tokenSettings: TokenArgumentsStructOutput;
  rankifySettings: UserRankifySettingsStructOutput;
};

export interface MAOInstanceContracts {
  rankToken: GetContractReturnType<typeof rankTokenAbi>;
  instance: GetContractReturnType<typeof instanceAbi>;
  govtToken: GetContractReturnType<typeof govtTokenAbi>;
  govtAccessManager: GetContractReturnType<typeof govtAccessManagerAbi>;
  ACIDAccessManager: GetContractReturnType<typeof govtAccessManagerAbi>;
}

export class MAODistributorClient extends DistributorClient {
  private static readonly DEFAULT_NAME = "MAO Distribution";
  walletClient: WalletClient;

  constructor(chainName: SupportedChains, client: { publicClient: PublicClient; walletClient: WalletClient }) {
    const { address } = getArtifact(chainName, "DAODistributor");
    super({ address: getAddress(address), publicClient: client.publicClient });
    this.walletClient = client.walletClient;
  }

  /**
   * Converts MAOInstances addresses to their respective contract instances
   * @param addresses Object containing contract addresses for MAO distribution components
   * @returns Object containing initialized contract instances
   * @throws Error if any of the addresses are invalid
   */
  addressesToContracts(addresses: MAOInstances): MAOInstanceContracts {
    if (
      !isAddress(addresses.ACIDInstance) ||
      !isAddress(addresses.rankToken) ||
      !isAddress(addresses.govToken) ||
      !isAddress(addresses.govTokenAccessManager) ||
      !isAddress(addresses.ACIDAccessManager)
    ) {
      throw new Error("Invalid address provided to addressesToContracts");
    }

    const instance = getContract({
      address: addresses.ACIDInstance,
      abi: instanceAbi,
      client: this.walletClient,
    });

    const rankToken = getContract({
      address: addresses.rankToken,
      abi: rankTokenAbi,
      client: this.walletClient,
    });

    const govtToken = getContract({
      address: addresses.govToken,
      abi: govtTokenAbi,
      client: this.walletClient,
    });

    const govtAccessManager = getContract({
      address: addresses.govTokenAccessManager,
      abi: govtAccessManagerAbi,
      client: this.walletClient,
    });

    const ACIDAccessManager = getContract({
      address: addresses.ACIDAccessManager,
      abi: govtAccessManagerAbi,
      client: this.walletClient,
    });

    return { rankToken, instance, govtToken, govtAccessManager, ACIDAccessManager };
  }

  /**
   * Get MAOInstances instances by distribution name
   * @param namedDistribution Distribution name (defaults to "MAO Distribution")
   * @returns Array of MAOInstances contract instances
   */
  async getNamedMAODistributionInstances(namedDistribution: string): Promise<MAOInstanceContracts[]> {
    const logs = await this.publicClient.getContractEvents({
      address: this.address,
      abi: distributorAbi,
      eventName: "Instantiated",
      args: {
        distributionId: stringToHex(namedDistribution, { size: 32 }),
      },
    });

    const instances = logs
      .map((l) => parseInstantiated(l.args.instances as string[]))
      .map((ip) => this.addressesToContracts(ip));

    if (instances.length === 0) {
      console.error("No instances found");
      throw new Error(`No instances found for distribution ${namedDistribution}`);
    }

    return instances;
  }

  async getMAOInstance(
    name: string = MAODistributorClient.DEFAULT_NAME,
    instanceId: bigint,
  ): Promise<MAOInstanceContracts> {
    const logs = await this.publicClient.getContractEvents({
      address: this.address,
      abi: distributorAbi,
      eventName: "Instantiated",
      args: {
        distributionId: stringToHex(name, { size: 32 }),
        newInstanceId: instanceId,
      },
    });

    if (logs.length === 0) {
      console.error("No instance found");
      throw new Error(`No instance found for distribution ${name} and id ${instanceId}`);
    }

    if (logs.length > 1) {
      console.error("Multiple instances found");
      throw new Error(`Multiple instances found for distribution ${name} and id ${instanceId}`);
    }

    const { instances } = logs[0].args;
    if (!instances) throw new Error(`No instances found for distribution ${name} and id ${instanceId}`);
    return this.addressesToContracts(parseInstantiated(instances as string[]));
  }

  /**
   * Create a new MAODistribution instance
   * @param args Distribution arguments (encoded as bytes)
   * @returns Array of created contract addresses
   */
  async instantiate(
    args: GetAbiItemParameters<typeof MaoDistributionAbi, "distributionSchema">["args"],
    name: string = MAODistributorClient.DEFAULT_NAME,
    chain: Chain,
  ): Promise<MAOInstanceContracts> {
    if (!args) throw new Error("args is required");
    const abiItem = getAbiItem({ abi: MaoDistributionAbi, name: "distributionSchema" });
    const encodedParams = encodeAbiParameters(abiItem.inputs, args);
    const encodedName = stringToHex(name, { size: 32 });
    if (!this.walletClient.account?.address) throw new Error("No account address found");
    const { request } = await this.publicClient.simulateContract({
      abi: distributorAbi,
      address: this.address,
      functionName: "instantiate",
      args: [encodedName, encodedParams],
      account: this.walletClient.account?.address,
      chain: chain,
    });

    const receipt = await this.walletClient
      .writeContract(request)
      .then((h) => this.publicClient.waitForTransactionReceipt({ hash: h }));

    const instantiatedEvent = parseEventLogs({
      abi: distributorAbi,
      logs: receipt.logs,
      eventName: "Instantiated",
    });

    if (instantiatedEvent.length == 0) {
      console.error("Transaction receipt:", receipt);
      throw new Error("Instantiated event not found in transaction receipt");
    }
    if (instantiatedEvent.length > 1) {
      console.error("Transaction receipt:", receipt);
      throw new Error("Multiple Instantiated events found in transaction receipt");
    }

    const addresses = parseInstantiated(instantiatedEvent[0].args.instances as string[]);
    return this.addressesToContracts(addresses);
  }
}
