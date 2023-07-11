import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
	IdentityPool,
	UserPoolAuthenticationProvider,
} from '@aws-cdk/aws-cognito-identitypool-alpha'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito'

type CognitoIdentityProps = StackProps & {
	appName: string
	identityName: string
	userpool: UserPool
	userpoolClient: UserPoolClient
}

export function createCognitoIdentity(
	scope: Construct,
	props: CognitoIdentityProps
) {
	const identityPool = new IdentityPool(
		scope,
		`${props.appName}-${props.identityName}`,
		{
			identityPoolName: `${props.appName}-${props.identityName}`,
			allowUnauthenticatedIdentities: true,
			authenticationProviders: {
				userPools: [
					new UserPoolAuthenticationProvider({
						userPool: props.userpool,
						userPoolClient: props.userpoolClient,
					}),
				],
			},
		}
	)

	return identityPool
}
