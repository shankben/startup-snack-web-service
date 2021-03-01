import path from "path";

import { Construct, Stack, StackProps } from "@aws-cdk/core";
import { Port, Vpc } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  Secret as EcsSecret
} from "@aws-cdk/aws-ecs";

import {
  ApplicationLoadBalancedFargateService
} from "@aws-cdk/aws-ecs-patterns";

import DatabaseStack from "./database-stack";

export default class WebServiceStack extends Stack {
  private readonly databaseStack: DatabaseStack;
  private readonly assetPath = path.join(__dirname, "..", "..", "assets",
    "ecs");

  private rdsSecret = (name: string) => EcsSecret.fromSecretsManager(
    this.databaseStack.cluster.secret!,
    name
  );

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, "Vpc", { isDefault: true });

    const cluster = new Cluster(this, "Cluster", {
      vpc,
      clusterName: "StartupSnack-WebService"
    });

    this.databaseStack = new DatabaseStack(this, "DatabaseStack", { vpc });

    const service = new ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
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

    this.databaseStack.cluster.connections.allowFrom(
      service.service,
      Port.tcp(this.databaseStack.cluster.clusterEndpoint.port)
    );
  }
}
