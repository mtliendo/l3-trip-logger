import { Construct } from 'constructs'
import * as awsAppsync from 'aws-cdk-lib/aws-appsync'
import * as path from 'path'
import { UserPool } from 'aws-cdk-lib/aws-cognito'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { AmplifyGraphqlApi } from 'agqlac'

type AppSyncAPIProps = {
	apiName: string
	appName: string
	authenticatedRole: IRole
	unauthenticatedRole: IRole
	userpool: UserPool
	identityPoolId: string
}

export function createAmplifyGraphqlApi(
	scope: Construct,
	props: AppSyncAPIProps
) {
	const api = new AmplifyGraphqlApi(
		scope,
		`${props.appName}-${props.apiName}`,
		{
			apiName: `${props.appName}-${props.apiName}`,
			schema: awsAppsync.SchemaFile.fromAsset(
				path.join(__dirname, './graphql/schema.graphql')
			),
			authorizationConfig: {
				defaultAuthMode: awsAppsync.AuthorizationType.USER_POOL,
				userPoolConfig: {
					userPool: props.userpool,
				},
				iamConfig: {
					unauthenticatedUserRole: props.unauthenticatedRole,
					authenticatedUserRole: props.authenticatedRole,
				},
			},
		}
	)

	return api
}
