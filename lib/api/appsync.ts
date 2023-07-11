import { Construct } from 'constructs'
import * as awsAppsync from 'aws-cdk-lib/aws-appsync'
import * as path from 'path'
import { UserPool } from 'aws-cdk-lib/aws-cognito'
import { IRole } from 'aws-cdk-lib/aws-iam'
import { AmplifyGraphqlApi } from 'agqlac'
import { RemovalPolicy } from 'aws-cdk-lib'
import { StreamViewType, Table } from 'aws-cdk-lib/aws-dynamodb'

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

	const appSyncApi = awsAppsync.GraphqlApi.fromGraphqlApiAttributes(
		scope,
		'api',
		{
			graphqlApiId: api.resources.cfnGraphqlApi.attrApiId,
		}
	)
	const L1TripTable = api.resources.cfnTables['TripTable']
	console.log('the table ', L1TripTable)
	console.log('the table stream arn l1', L1TripTable.attrStreamArn)
	const tripTable = Table.fromTableArn(scope, 'TripTable', L1TripTable.attrArn)

	console.log('the stream arn', tripTable.tableStreamArn)
	const tripTableDS = appSyncApi.addDynamoDbDataSource(
		'TripTableExtended',
		tripTable
	)

	const createRecipeFunction = new awsAppsync.AppsyncFunction(
		scope,
		'createRecipeFunction',
		{
			name: 'createRecipeFunction',
			api: appSyncApi,
			dataSource: tripTableDS,
			runtime: awsAppsync.FunctionRuntime.JS_1_0_0,
			code: awsAppsync.Code.fromInline(`
			export function request(ctx) {
				console.log(ctx.args)
				return {}
			}

			export function response(ctx) {
				return ctx.prev.result
			}
			`),
		}
	)

	appSyncApi.createResolver('BatchUploadPipeline', {
		runtime: awsAppsync.FunctionRuntime.JS_1_0_0,
		typeName: 'Mutation',
		code: awsAppsync.Code.fromInline(`
	// The before step.
	//This runs before ALL the AppSync functions in this pipeline.
	export function request(ctx) {
		console.log(ctx.args)
		ctx.stash.tableName = "${tripTable.tableName}"
		return {}
	}

	// The AFTER step. This runs after ALL the AppSync functions in this pipeline.
	export function response(ctx) {
		return ctx.prev.result
	}
	`),
		fieldName: 'batchUploadPipeline',
		pipelineConfig: [createRecipeFunction],
	})

	L1TripTable.applyRemovalPolicy(RemovalPolicy.DESTROY)

	return { api, tripTable }
}
