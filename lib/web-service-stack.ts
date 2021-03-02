import path from "path";

import { DockerImageAsset } from "@aws-cdk/aws-ecr-assets";
import { LogGroup, RetentionDays } from "@aws-cdk/aws-logs";

import {
  Port,
  Vpc,
  SubnetType,
  InstanceType,
  InstanceClass,
  InstanceSize
} from "@aws-cdk/aws-ec2";

import {
  Construct,
  Duration,
  Stack,
  StackProps,
  RemovalPolicy
} from "@aws-cdk/core";

import {
  AuroraCapacityUnit,
  AuroraPostgresEngineVersion,
  ServerlessCluster,
  DatabaseInstance,
  DatabaseClusterEngine,
  DatabaseInstanceEngine,
  PostgresEngineVersion,
  SubnetGroup
} from "@aws-cdk/aws-rds";

import {
  AwsLogDriver,
  Cluster as EcsCluster,
  ContainerImage,
  Secret as EcsSecret
} from "@aws-cdk/aws-ecs";

import {
  ApplicationLoadBalancedFargateService
} from "@aws-cdk/aws-ecs-patterns";


export default class WebServiceStack extends Stack {
  public readonly databaseCluster: ServerlessCluster | DatabaseInstance;

  private readonly assetPath = path.join(__dirname, "..", "assets", "ecs");

  private rdsSecretFor = (name: string) => EcsSecret.fromSecretsManager(
    this.databaseCluster.secret!,
    name
  );

  get databaseEndpoint() {
    const instance = this.databaseCluster instanceof ServerlessCluster ?
      (this.databaseCluster as ServerlessCluster).clusterEndpoint :
      this.databaseCluster instanceof DatabaseInstance ?
      (this.databaseCluster as DatabaseInstance).instanceEndpoint :
      undefined;
    if (!instance) throw new Error("Unknown RDS type");
    return instance;
  }

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
    * Create a new VPC or use the default VPC. If using the default VPC, ensure
    * there are at least two availability zones configured, each with private
    * and public subnets.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.Vpc.html
    */
    // const vpc = new Vpc(this, "Vpc", {
    //   maxAzs: 2
    // });
    const vpc = Vpc.fromLookup(this, "Vpc", {
      isDefault: true
    });

    /**
    * Select a private subnet group for RDS.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-rds.SubnetGroup.html
    */
    const subnetGroup = new SubnetGroup(this, "SubnetGroup", {
      vpc,
      description: "Subnet Group for StartupSnack-WebService",
      vpcSubnets: vpc.selectSubnets({
        onePerAz: true,
        subnetType: SubnetType.PRIVATE
      })
    });

    /**
    * Construct an RDS Aurora Serverless for PostegreSQL cluster. See below for
    * how to use managed RDS for PostegreSQL.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-rds.ServerlessCluster.html
    * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html
    */
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

    /**
    * Alternatively construct a maanged RDS for PostegreSQL instance.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-rds.DatabaseInstance.html
    */
    // this.databaseCluster = new DatabaseInstance(this, "DatabaseCluster", {
    //   vpc,
    //   subnetGroup,
    //   databaseName: "app",
    //   deleteAutomatedBackups: true,
    //   instanceIdentifier: "StartupSnack-WebService",
    //   instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
    //   allocatedStorage: 10,
    //   maxAllocatedStorage: 20,
    //   engine: DatabaseInstanceEngine.postgres({
    //     version: PostgresEngineVersion.VER_10_12
    //   })
    // });

    /**
    * Build and push to ECR the container image for our Fargate service.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecr-assets.DockerImageAsset.html
    */
    const imageAsset = new DockerImageAsset(this, "Image", {
      directory: path.join(this.assetPath, "rails")
    });

    /**
    * Construct a new ECS Cluster to house our Fargate service.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.Cluster.html
    */
    const ecsCluster = new EcsCluster(this, "Cluster", {
      vpc,
      clusterName: "StartupSnack-WebService"
    });

    /**
    * Construct a new ECS Fargate service, load balanced by an ALB.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs-patterns.ApplicationLoadBalancedFargateService.html
    */
    const service = new ApplicationLoadBalancedFargateService(this, "Service", {
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      cpu: 512,
      memoryLimitMiB: 1024,
      serviceName: "StartupSnack-WebService",
      cluster: ecsCluster,
      taskImageOptions: {
        enableLogging: true,
        containerPort: 3000,
        image: ContainerImage.fromDockerImageAsset(imageAsset),
        logDriver: new AwsLogDriver({
          streamPrefix: "StartupSnack-WebService",
          logGroup: new LogGroup(this, "LogGroup", {
            logGroupName: "/aws/ecs/StartupSnack-WebService",
            retention: RetentionDays.ONE_DAY,
            removalPolicy: RemovalPolicy.DESTROY
          })
        }),
        secrets: {
          DATABASE_HOST: this.rdsSecretFor("host"),
          DATABASE_PASSWORD: this.rdsSecretFor("password")
        }
      }
    });

    /**
    * Set security groups for the database to allow incoming connections from
    * the Fargate service.
    *
    * @see: https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ec2.Connections.html
    */
    this.databaseCluster.connections.allowFrom(
      service.service,
      Port.tcp(this.databaseEndpoint.port)
    );
  }
}
