import { type Address, stringToHex, getContract, Hex, PublicClient, getAddress } from "viem";
import DistributorAbi from "../abis/Distributor";

export class DistributorClient {
  publicClient: PublicClient;
  address: Address;

  constructor({ address, publicClient }: { address: Address; publicClient: PublicClient }) {
    this.address = getAddress(address, publicClient?.chain?.id);
    this.publicClient = publicClient;
  }

  async getDistributions() {
    const contract = getContract({
      address: this.address,
      abi: DistributorAbi,
      client: this.publicClient,
    });
    return contract.read.getDistributions();
  }

  async getInstances(distributorsId: Hex): Promise<Address[][]> {
    const contract = getContract({
      address: this.address,
      abi: DistributorAbi,
      client: this.publicClient,
    });

    const events = await contract.getEvents.Instantiated({
      distributionId: distributorsId,
    });

    return events.map((log) => log.args.instances as Address[]);
  }

  async getInstance(distributorsId: Hex, instanceId: bigint): Promise<Address[]> {
    const contract = getContract({
      address: this.address,
      abi: DistributorAbi,
      client: this.publicClient,
    });

    const events = await contract.getEvents.Instantiated({
      distributionId: distributorsId,
      newInstanceId: instanceId,
    });

    if (events.length > 1) {
      throw new Error(`Multiple instances found for distributor ${distributorsId} and instance ${instanceId}`);
    }
    if (events.length === 0) {
      throw new Error(`No instances found for distributor ${distributorsId} and instance ${instanceId}`);
    }

    return events[0].args.instances as Address[];
  }

  async getNamedDistributionInstances({ namedDistribution }: { namedDistribution: string }): Promise<Address[][]> {
    const id = stringToHex(namedDistribution, { size: 32 });
    return this.getInstances(id);
  }

  async getNamedDistributionInstance(namedDistribution: string, instanceId: bigint): Promise<Address[]> {
    const id = stringToHex(namedDistribution, { size: 32 });
    return this.getInstance(id, instanceId);
  }
}
