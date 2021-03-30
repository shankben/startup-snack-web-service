import { Construct, StackProps, SecretValue } from "@aws-cdk/core";
import { App, GitHubSourceCodeProvider } from "@aws-cdk/aws-amplify";
import { BuildSpec } from "@aws-cdk/aws-codebuild";


export default class SinglePageApp extends Construct {
  public readonly appId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id);

    const app = new App(this, "StartupSnack-WebService-SinglePageApp-App", {
      sourceCodeProvider: new GitHubSourceCodeProvider({
        oauthToken: SecretValue.plainText(process.env.O_AUTH_TOKEN!),
        owner: process.env.SOURCE_CODE_OWNER ?? "shankben",
        repository: process.env.REPOSITORY ?? "startup-snack-web-service"
      }),
      environmentVariables: {
        NODE_ENV: process.env.ENV ?? "",
        VUE_APP_COLOR: process.env.COLOR ?? "",
      },
      buildSpec: BuildSpec.fromObject({
        version: "1.0",
        frontend: {
          phases: {
            preBuild: {
              commands: [
                "cd assets/just-a-react-app",
                "yarn"
              ]
            },
            build: {
              commands: [
                "npm run build"
              ]
            }
          },
          artifacts: {
            baseDirectory: "build",
            files: ["**/*"]
          },
          cache: {
            paths: ["build/**/*"]
          }
        }
      })
    });

    const branchName = process.env.BRANCH ?? "single-page-app";

    app.addBranch(branchName, {
      autoBuild: true,
      branchName
    });

    this.appId = app.appId;
  }
}
