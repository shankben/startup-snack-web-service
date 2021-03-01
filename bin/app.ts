import "source-map-support/register";
import { App } from "@aws-cdk/core";
import WebServiceStack from "../lib/stacks/web-service-stack";

async function main() {
  const app = new App();
  const props = {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.AWS_REGION ??
        process.env.CDK_DEPLOY_REGION ??
        process.env.CDK_DEFAULT_REGION ??
        "us-east-2"
    }
  };
  new WebServiceStack(app, "StartupSnack-WebService", props);
}

main().catch(console.error);
