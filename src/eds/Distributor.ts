import { type Address, stringToHex, Hex, PublicClient, getAddress } from "viem";
import DistributorAbi from "../abis/Distributor";
import { findContractDeploymentBlock } from "../utils";
import { EnvioGraphQLClient } from "../utils/EnvioGraphQLClient";

export class DistributorClient {
  publicClient: PublicClient;
  address: Address;
  createdAtBlock?: bigint;
  envioClient: EnvioGraphQLClient;
  constructor({
    address,
    publicClient,
    envioClient,
  }: {
    address: Address;
    publicClient: PublicClient;
    envioClient: EnvioGraphQLClient;
  }) {
    this.address = getAddress(address);
    this.publicClient = publicClient;
    this.envioClient = envioClient;
  }

  async getDistributions() {
    return this.publicClient.readContract({
      address: this.address,
      abi: DistributorAbi,
      functionName: "getDistributions",
    });
  }

  async getCreationBlock() {
    if (!this.createdAtBlock) {
      this.createdAtBlock = await findContractDeploymentBlock(this.publicClient, this.address);
    }
    return this.createdAtBlock;
  }

  async getInstances(
    distributorsId: Hex,
  ): Promise<{ newInstanceId: bigint; version: bigint; addresses: Address[] }[]> {
    if (!this.publicClient.chain?.id) throw new Error("Chain ID is not set");

    const events = await this.envioClient.queryInstances(
      {
        distributionId: distributorsId,
      },
    );

    return events.map((log) => {
      if (!log.version)
        throw new Error(`No version found for distributor ${distributorsId} and instance ${log.newInstanceId}`);
      if (!log.instances)
        throw new Error(`No instances found for distributor ${distributorsId} and instance ${log.newInstanceId}`);
      if (!log.newInstanceId)
        throw new Error(`No instanceId found for distributor ${distributorsId} and instance ${log.newInstanceId}`);
      return {
        newInstanceId: BigInt(log.newInstanceId),
        addresses: log.instances as Address[],
        version: BigInt(log.version),
      };
    });
  }

  async getInstance(distributorsId: Hex, instanceId: bigint): Promise<Address[]> {

    const events = await this.envioClient.queryInstances(
      {
        distributionId: distributorsId,
        instanceId: instanceId.toString(),
      },
    );

    if (events.length > 1) {
      throw new Error(`Multiple instances found for distributor ${distributorsId} and instance ${instanceId}`);
    } else if (events.length === 0) {
      throw new Error(`No instances found for distributor ${distributorsId} and instance ${instanceId}`);
    }

    return events[0].instances as Address[];
  }

  async getNamedDistributionInstances({ namedDistribution }: { namedDistribution: string }): Promise<Address[][]> {
    const id = stringToHex(namedDistribution, { size: 32 });
    return this.getInstances(id).then((instances) => instances.map((i) => i.addresses));
  }

  async getNamedDistributionInstance(namedDistribution: string, instanceId: bigint): Promise<Address[]> {
    const id = stringToHex(namedDistribution, { size: 32 });
    return this.getInstance(id, instanceId);
  }

  async getInstanceFromAddress(address: Address) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: DistributorAbi,
      functionName: "getInstanceId",
      args: [address],
    });
  }
}
