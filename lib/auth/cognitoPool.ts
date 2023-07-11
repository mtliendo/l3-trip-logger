import { StackProps } from 'aws-cdk-lib'
import {
	AccountRecovery,
	UserPool,
	UserPoolClient,
	VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

type CognitoPoolProps = StackProps & {
	poolName: string
	clientName: string
	appName: string
}

export function createCognitoPool(scope: Construct, props: CognitoPoolProps) {
	const userPool = new UserPool(scope, `${props.appName}-${props.poolName}`, {
		selfSignUpEnabled: true,
		accountRecovery: AccountRecovery.PHONE_AND_EMAIL,
		userVerification: {
			emailStyle: VerificationEmailStyle.CODE,
		},
		autoVerify: {
			email: true,
		},
		standardAttributes: {
			email: {
				required: true,
				mutable: true,
			},
		},
	})

	const userPoolClient = new UserPoolClient(
		scope,
		`${props.appName}-${props.clientName}`,
		{
			userPool,
		}
	)

	return {
		userPool,
		userPoolClient,
	}
}
