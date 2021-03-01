import { Construct, NestedStack, NestedStackProps } from "@aws-cdk/core";

import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  SubnetType
} from "@aws-cdk/aws-ec2";

import {
  AuroraCapacityUnit,
  AuroraPostgresEngineVersion,
  ServerlessCluster,
  DatabaseClusterEngine,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion,
  PostgresEngineVersion,
  SubnetGroup
} from "@aws-cdk/aws-rds";


export interface DatabaseStackProps extends NestedStackProps {
  vpc: IVpc;
}

export default class DatabaseStack extends NestedStack {
  public readonly cluster: ServerlessCluster;
  // public readonly database: DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const subnetGroup = new SubnetGroup(this, "SubnetGroup", {
      vpc,
      description: "Subnet Group for ThreeTierWebApp",
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: SubnetType.PRIVATE
      })
    });

    this.cluster = new ServerlessCluster(this, "DatabaseCluster", {
      vpc,
      subnetGroup,
      enableDataApi: true,
      clusterIdentifier: "StartupSnack-WebService",
      scaling: {
        minCapacity: AuroraCapacityUnit.ACU_2,
        maxCapacity: AuroraCapacityUnit.ACU_2
      },
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_12
      })
    });

    // this.database = new DatabaseInstance(this, "DatabaseInstance", {
    //   vpc,
    //   subnetGroup,
    //   allocatedStorage: 10,
    //   databaseName: "app",
    //   deleteAutomatedBackups: true,
    //   instanceIdentifier: "StartupSnack-WebService",
    //   instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
    //   maxAllocatedStorage: 20,
    //   engine: DatabaseInstanceEngine.postgres({
    //     version: PostgresEngineVersion.VER_12_5
    //   })
    // });
  }
}
