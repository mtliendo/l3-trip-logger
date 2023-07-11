import { createTripTableStream } from './functions/tripTableStream/construct'
import * as cdk from 'aws-cdk-lib'
import { createAmplifyGraphqlApi } from './api/appsync'
import { CDKContext } from '../cdk.context'
import { createCognitoPool } from './auth/cognitoPool'
import { createCognitoIdentity } from './auth/identityPool'

export class BackendStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props)
		const context: CDKContext = this.node.tryGetContext('globals')

		const cognitoAuthn = createCognitoPool(this, {
			appName: context.appName,
			poolName: context.auth.poolName,
			clientName: context.auth.clientName,
		})

		const cognitoIdentity = createCognitoIdentity(this, {
			appName: context.appName,
			identityName: context.auth.identityName,
			userpoolClient: cognitoAuthn.userPoolClient,
			userpool: cognitoAuthn.userPool,
		})

		const amplifyApi = createAmplifyGraphqlApi(this, {
			apiName: context.api.name,
			appName: context.appName,
			userpool: cognitoAuthn.userPool,
			authenticatedRole: cognitoIdentity.authenticatedRole,
			unauthenticatedRole: cognitoIdentity.unauthenticatedRole,
			identityPoolId: cognitoIdentity.identityPoolId,
		})

		const tripTableStreamFunc = createTripTableStream(this, {
			appName: context.appName,
			tripTable: amplifyApi.tripTable,
			fnName: context.functions.tripTableStream.name,
			environmentVars: {},
		})

		amplifyApi.tripTable.grantStreamRead(tripTableStreamFunc)
	}
}
