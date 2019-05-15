# SAR-AutoDeploy-Layer

SAR app for automatically deploying Lambda layer to all functions in a region.

## Deploying to your account (via the console)

Go to this [page](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:374852340823:applications~autodeploy-layer) and click the `Deploy` button.

## Deploying via SAM/Serverless framework/CloudFormation

To deploy this via SAM, you need something like this in the CloudFormation template:

```yml
AutoDeployMyAwesomeLambdaLayer:
  Type: AWS::Serverless::Application
  Properties:
    Location:
      ApplicationId: arn:aws:serverlessrepo:us-east-1:374852340823:applications/autodeploy-layer
      SemanticVersion: <enter latest version>
    Parameters:
      LayerArn: <ARN for the layer to install>
      # IncludeTag: give-me-layer # optional
      # ExcludeTag: dont-give-me-layer #optional
```

To do the same via CloudFormation or the Serverless framework, you need to first add the following `Transform`:

```yml
Transform: AWS::Serverless-2016-10-31
```

For more details, read this [post](https://theburningmonk.com/2019/05/how-to-include-serverless-repository-apps-in-serverless-yml/).

## Parameters

`LayerArn`: The ARN of the Lambda layer to install.

`IncludeTag`: (Optional) if specified, only the functions with this tag would be given the Layer.

`ExcludeTag`: (Optional) if specified, the functions with this tag would not be given the layer.
