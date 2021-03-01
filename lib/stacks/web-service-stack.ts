import path from "path";

import { Construct, Duration, Stack, StackProps } from "@aws-cdk/core";
import { Port, Vpc } from "@aws-cdk/aws-ec2";
import { SubnetType } from "@aws-cdk/aws-ec2";

import {
  AuroraCapacityUnit,
  AuroraPostgresEngineVersion,
  ServerlessCluster,
  DatabaseClusterEngine,
  SubnetGroup
} from "@aws-cdk/aws-rds";

import {
  Cluster as EcsCluster,
  ContainerImage,
  Secret as EcsSecret
} from "@aws-cdk/aws-ecs";

import {
  ApplicationLoadBalancedFargateService
} from "@aws-cdk/aws-ecs-patterns";

export default class WebServiceStack extends Stack {
  public readonly databaseCluster: ServerlessCluster;
  private readonly assetPath = path.join(__dirname, "..", "..", "assets",
    "ecs");

  private rdsSecret = (name: string) => EcsSecret.fromSecretsManager(
    this.databaseCluster.secret!,
    name
  );

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "Vpc", { isDefault: true });

    const subnetGroup = new SubnetGroup(this, "SubnetGroup", {
      vpc,
      description: "Subnet Group for ThreeTierWebApp",
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: SubnetType.PRIVATE
      })
    });

    this.databaseCluster = new ServerlessCluster(this, "DatabaseCluster", {
      vpc,
      subnetGroup,
      enableDataApi: true,
      clusterIdentifier: "StartupSnack-WebService",
      backupRetention: Duration.days(1),
      scaling: {
        minCapacity: AuroraCapacityUnit.ACU_2,
        maxCapacity: AuroraCapacityUnit.ACU_2
      },
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_10_12
      })
    });

    const service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cpu: 512,
      memoryLimitMiB: 1024,
      cluster: new EcsCluster(this, "Cluster", {
        vpc,
        clusterName: "StartupSnack-WebService"
      }),
      taskImageOptions: {
        enableLogging: true,
        containerPort: 3000,
        image: ContainerImage.fromAsset(path.join(this.assetPath, "rails")),
        secrets: {
          DATABASE_HOST: this.rdsSecret("host"),
          DATABASE_PASSWORD: this.rdsSecret("password")
        }
      }
    });

    this.databaseCluster.connections.allowFrom(
      service.service,
      Port.tcp(this.databaseCluster.clusterEndpoint.port)
    );
  }
}
