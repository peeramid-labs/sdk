import {
  DistributableGovernanceERC20,
  MAODistribution,
  RankifyDiamondInstance,
  RankToken,
  SimpleAccessManager,
} from "rankify-contracts/types";
import { ethers, Signer } from "ethers";
import { providers } from "ethers";
import { DistributorClient } from "../eds/Distributor";
import { getArtifact } from "../utils";
import { SupportedChains } from "../utils";
import { MAOInstances, parseInstantiated, generateDistributorData } from "rankify-contracts/scripts/";
import instanceAbi from "rankify-contracts/abi/hardhat-diamond-abi/HardhatDiamondABI.sol/RankifyDiamondInstance.json";
import rankTokenAbi from "rankify-contracts/abi/src/tokens/RankToken.sol/RankToken.json";
import govtTokenAbi from "rankify-contracts/abi/src/tokens/DistributableGovernanceERC20.sol/DistributableGovernanceERC20.json";

export interface MAOInstanceContracts {
  rankToken: RankToken;
  instance: RankifyDiamondInstance;
  govtToken: DistributableGovernanceERC20;
  govtAccessManager: SimpleAccessManager;
  ACIDAccessManager: SimpleAccessManager;
}

export class MAODistributorClient extends DistributorClient {
  private static readonly DEFAULT_NAME = "MAO Distribution";
  private _signerOrProvider: Signer | providers.Provider;
  private govtAccessManagerAbi;

  constructor(chainName: SupportedChains, signerOrProvider: Signer | providers.Provider) {
    const { address, abi } = getArtifact(chainName, "Distributor");
    super(address, abi, signerOrProvider);
    this.govtAccessManagerAbi = getArtifact(chainName, "SimpleAccessManager").abi;

    this._signerOrProvider = signerOrProvider;
  }

  /**
   * Converts MAOInstances addresses to their respective contract instances
   * @param addresses Object containing contract addresses for MAO distribution components
   * @returns Object containing initialized contract instances
   * @throws Error if any of the addresses are invalid
   */
  addressesToContracts(addresses: MAOInstances): MAOInstanceContracts {
    if (
      !ethers.utils.isAddress(addresses.ACIDInstance) ||
      !ethers.utils.isAddress(addresses.rankToken) ||
      !ethers.utils.isAddress(addresses.govToken) ||
      !ethers.utils.isAddress(addresses.govTokenAccessManager) ||
      !ethers.utils.isAddress(addresses.ACIDAccessManager)
    ) {
      throw new Error("Invalid address provided to addressesToContracts");
    }

    const instance = new ethers.Contract(
      addresses.ACIDInstance,
      instanceAbi,
      this._signerOrProvider,
    ) as RankifyDiamondInstance;

    const rankToken = new ethers.Contract(addresses.rankToken, rankTokenAbi, this._signerOrProvider) as RankToken;

    const govtToken = new ethers.Contract(
      addresses.govToken,
      govtTokenAbi,
      this._signerOrProvider,
    ) as DistributableGovernanceERC20;

    const govtAccessManager = new ethers.Contract(
      addresses.govTokenAccessManager,
      this.govtAccessManagerAbi,
      this._signerOrProvider,
    ) as SimpleAccessManager;

    const ACIDAccessManager = new ethers.Contract(
      addresses.ACIDAccessManager,
      this.govtAccessManagerAbi,
      this._signerOrProvider,
    ) as SimpleAccessManager;

    return { rankToken, instance, govtToken, govtAccessManager, ACIDAccessManager };
  }

  /**
   * Get MAOInstances instances by distribution name
   * @param name Distribution name (defaults to "MAO Distribution")
   * @returns Array of MAOInstances contract instances
   */
  async getMAOInstances(name: string = MAODistributorClient.DEFAULT_NAME): Promise<MAOInstanceContracts[]> {
    const distributionId = ethers.utils.formatBytes32String(name);

    const instances = await this.getNamedDistributionInstances({ namedDistribution: distributionId });

    return instances.map((i) => parseInstantiated(i)).map((ip) => this.addressesToContracts(ip));
  }

  async getMAOInstance(
    name: string = MAODistributorClient.DEFAULT_NAME,
    instanceId: number,
  ): Promise<MAOInstanceContracts> {
    const distributionId = ethers.utils.formatBytes32String(name);
    return this.getInstance(distributionId, instanceId)
      .then((i) => parseInstantiated(i))
      .then((ip) => this.addressesToContracts(ip));
  }

  /**
   * Create a new MAODistribution instance
   * @param args Distribution arguments (encoded as bytes)
   * @returns Array of created contract addresses
   */
  async instantiate(
    args: MAODistribution.DistributorArgumentsStruct,
    name: string = MAODistributorClient.DEFAULT_NAME,
  ): Promise<MAOInstanceContracts> {
    const tx = await this.getContract().instantiate(
      ethers.utils.formatBytes32String(name),
      generateDistributorData(args),
    );
    const receipt = await tx.wait();

    const instantiatedEvent = receipt.events?.find((e) => e.event === "Instantiated");
    if (!instantiatedEvent) {
      console.error(receipt);
      throw new Error("Failed to instantiate MAO Distribution");
    }
    const addresses = parseInstantiated(instantiatedEvent.args.instances);

    return this.addressesToContracts(addresses);
  }
}
