import { Distributor } from "@peeramid-labs/eds/types";
import { BigNumberish, Contract, ContractInterface, ethers, Signer } from "ethers";
import { providers } from "ethers";

export class DistributorClient {
  private contract: Distributor;

  constructor(address: string, abi: ContractInterface, signerOrProvider: Signer | providers.Provider) {
    this.contract = new Contract(address, abi, signerOrProvider) as Distributor;
  }

  // Get the underlying contract instance
  public getContract(): Distributor {
    return this.contract;
  }

  // Connect with a new signer
  public connect(signer: Signer): DistributorClient {
    return new DistributorClient(this.contract.address, this.contract.interface, signer);
  }

  getDistributions() {
    return this.contract.getDistributions();
  }

  async getInstances(distributorsId: BigNumberish): Promise<string[][]> {
    const filter = this.contract.filters.Instantiated(ethers.utils.hexlify(distributorsId));
    const evts = await this.contract.queryFilter(filter);
    return evts.map((evt) => evt.args.instances);
  }

  async getInstance(distributorsId: BigNumberish, instanceId: BigNumberish): Promise<string[]> {
    const filter = this.contract.filters.Instantiated(ethers.utils.hexlify(distributorsId), instanceId);
    const evts = await this.contract.queryFilter(filter);
    const evt = evts[0];
    if (evts.length > 1) {
      throw new Error(`Multiple instances found for distributor ${distributorsId} and instance ${instanceId}`);
    }
    if (evts.length === 0) {
      throw new Error(`No instances found for distributor ${distributorsId} and instance ${instanceId}`);
    }
    return evt.args.instances;
  }
  async getNamedDistributionInstances({ namedDistribution }: { namedDistribution: string }): Promise<string[][]> {
    const id = ethers.utils.parseBytes32String(namedDistribution);
    return await this.getInstances(id);
  }

  async getNamedDistributionInstance(namedDistribution: string, instanceId: BigNumberish): Promise<string[]> {
    const id = ethers.utils.parseBytes32String(namedDistribution);
    return this.getInstance(id, instanceId);
  }
}
