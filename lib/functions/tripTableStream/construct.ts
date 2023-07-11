import { CfnTable, ITable } from 'aws-cdk-lib/aws-dynamodb'
import { Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda'
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import path = require('path')

type TripTableStreamProps = {
	tripTable: ITable
	appName: string
	fnName: string
	environmentVars: {}
}
export const createTripTableStream = (
	scope: Construct,
	props: TripTableStreamProps
) => {
	const tripTableStream = new NodejsFunction(
		scope,
		`${props.appName}-${props.fnName}`,
		{
			functionName: `${props.appName}-${props.fnName}`,
			runtime: Runtime.NODEJS_16_X,
			handler: 'handler',
			entry: path.join(__dirname, `./main.ts`),
		}
	)

	tripTableStream.addEventSource(
		new DynamoEventSource(props.tripTable, {
			startingPosition: StartingPosition.LATEST,
		})
	)

	/* Add an inline policy to the lambda function
	 tripTableStream.addToRolePolicy(
	 	new aws_iam.PolicyStatement({
	 		actions: ['dynamodb:PutItem'],
	 		resources: [props.exampleDBARN],
	 	})
	 )
	 */
	return tripTableStream
}
