# Trip Logger L3

Rene went ahead and put this as a regular CDK project. I'm curious to see how this works. I'm not seeing the helper file in here anymore.

This is going to be a test of what this construct looks like in a real (yet simple) application.

## Architecture Overview

The architecture is as follows:

![](./notes-images/trip-logger-architecture.drawio.png)

## Project Overview

The project is a trip logging app. Unauthenticated users can view trips. Signed in users can perform CRUD operations on their own trips but one else. Signed in users can batch upload trips. Lastly, user can ask chatGPT to write a description of a trip for them.

## Project Setup

I installed the packages and noticed that the resources are in a single stack contained in more or less one file. This makes sense since CDK projects tend to be opinionated in structure. My preference is to split out the various resources into their own directories, but still deploy a single stack.

My first task is to refactor the AppSync API to a `createAPI` function located in a `lib/api/appsync.ts` file.

I've done this a couple times before and settle on something similar to [this file](https://github.com/mtliendo/backend-trip-post/blob/develop/lib/api/appsync.ts) with the main part being this:

```ts
const api = new awsAppsync.GraphqlApi(scope, 'TripAPI', {
	name: `${props.appName}-${props.env}-TripAPI`,
	schema: awsAppsync.SchemaFile.fromAsset(
		path.join(__dirname, './graphql/schema.graphql')
	),
	authorizationConfig: {
		defaultAuthorization: {
			authorizationType: awsAppsync.AuthorizationType.USER_POOL,
			userPoolConfig: {
				userPool: props.userpool,
			},
		},
		additionalAuthorizationModes: [
			{ authorizationType: awsAppsync.AuthorizationType.IAM },
		],
	},
	logConfig: {
		fieldLogLevel: awsAppsync.FieldLogLevel.ALL,
	},
})
```

> 🗒️ I'll forgoe environment support for this project.

The current `AmplifyGraphQLAPI` setup is as follows:

```ts
const amplifyApi = new AmplifyGraphqlApi(this, 'AmplifyCdkGraphQlApi', {
  schema: ,
  authorizationConfig: {
    defaultAuthMode: 'API_KEY',
    apiKeyConfig: {
      expires: cdk.Duration.days(30)
    }
  },
})
```

This leads to my first issue. The API is too slightly-different than the L2 construct. This hurts adoption. Notably:

1. `apiName` instead of `name`
2. `schema` being a `string` instead of a `SchemaFile.fromAsset()`
3. `additionalAuthorizationModes` and `logConfig` not being present.
4. `authorizationType` not supporting enums like `AuthorizationType.USER_POOL`
   - update; this is supported! I installed the `AuthorizationType` from API GW by accident
5. `defaultAuthMode` string instead of `defaultAuthorization` object

I'd personally like this to be as close to the AppSync API params as possible. That way it becomes clearer what this is doing: It's letting me define my instrastructure and automate the "how". In other words, I want to leverage my GraphQL schema to define how I want my resolvers, but let `AmplifyGraphQLAPI` define how.

We have to be crystal clear on how what this is doing. Too much magic will turn away CDK users who may have been bitten by the Amplify CLI.

The semi-final result of what I have so far is this:

```ts
const api = new AmplifyGraphqlApi(scope, `${props.apiName}`, {
	apiName: `${props.appName}-${props.apiName}`,

	schema: awsAppsync.SchemaFile.fromAsset(
		path.join(__dirname, './graphql/schema.graphql')
	),
	authorizationConfig: {
		defaultAuthMode: 'AMAZON_COGNITO_USER_POOLS',
		userPoolConfig: {
			userPool: props.userpool,
		},
	},
})
```

I'll have to come back to how to add additional auth types and enable logging later.

## Schema Creation

Alright. Time to see the value. For context, the schema that I am creating is essentially going to not only replace [what I have here](https://github.com/mtliendo/backend-trip-post/blob/develop/lib/api/graphql/schema.graphql), but the promise is that it provides more functionality.

This feels weird since I've spent so much time learning the actual AppSync way of doing this. Creating something like the following feels like...cheating.

```graphql
type Trip
	@model
	@auth(
		rules: [
			{ allow: owner }
			{ allow: public, provider: iam, operations: [read] }
		]
	) {
	id: ID!
		@auth(
			rules: [
				{ allow: owner, provider: iam, operations: [read] }
				{ allow: public, operations: [read] }
			]
		)
	title: String!
	description: String!
	imgKey: String!
}
```

Ensuring that the `id` field shouldn't be changed but knowing that the generated code will create it for me is tribal knowledge. We should provide a better way of making sure our customers don't footgun themselves. That aside, it is really nice to have `createdAt`, `updatedAt` etc created for me, along with the CRUDL operations, subscriptions, input and filters. This effectively [replaces ~150 lines of code](https://github.com/mtliendo/backend-trip-post/blob/develop/lib/api/appsync.ts#L42-L198) for me(!)

> 🗒️ It's at this point that I created a `cdk.context.json` file and relevant `cdk.context.d.ts` file to store my app strings.

Hmm, so I have `provider: iam` on the schema so I need to add a userpool, identity pool, and pass that to my API.

## Authz Creation

Similar to creating an API, I'll create separate functions for the identity pool and user pool. Only because I've done this many times, I know that these two will have to be in two different files: My userpool will only be passed to my API, but the `authenticated` and `unauthenticated` roles from my identity pool are passed pretty much everywhere.

### Userpool, Web Client, and Identity Pool Creation

Creating this is pretty boilerplate. Feel free to checkout the `lib/auth/cognitoPool.ts` file and `lib/auth/identityPool.ts` file.

I like the (for some reason still alpha) L2 construct for Cognito Identity pools a lot!

Hmmm...I could go on, but at this point, I think I have enough to deploy. My backend stack currently looks like this:

```ts
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
			unauthenticatedRole: cognitoIdentity.unauthenticatedRole,
		})
	}
}
```

Hmm...am I missing something? There seems to be a helper missing from this repo. I'm going to just try and deploy and see what happens in case there was an update I wasn't aware of...

```sh
InvalidDirectiveError: @auth directive with 'iam' provider found, but the project has no IAM authentication provider configured.
```

Oh that's right, I forgot to add my `unauthenticatedRole` to my API. Back in that file I did the following:

```ts
const appSyncApi = appsync.GraphqlApi.fromGraphqlApiAttributes(scope, 'api', {
	graphqlApiId: api.resources.cfnGraphqlApi.attrApiId,
})

appSyncApi.grantQuery(props.unauthenticatedRole, 'getTrip', 'listTrips')
```

But I'm getting a type Error...Looks like a type of `IGraphqlApi` is being returned but I need a `GraphqlApi` type. I just threw in a quick `as awsAppsync.GraphqlApi` and seemed to work.

Still getting the error.

The deployment is where I got stuck last time, but for a different reason. This is frustrating.

Reasoning about this for 15 minutes led me to see that the `generate.mjs` file is missing(?) and I may need this code:

```ts
const appSyncApi = appsync.GraphqlApi.fromGraphqlApiAttributes(scope, 'api', {
	graphqlApiId: api.resources.cfnGraphqlApi.attrApiId,
})

// I'll probably add the following line later as well
// appSyncApi.grantQuery(props.unauthenticatedRole, 'getTrip', 'listTrips')
```

But that line of code expects there to be an API ID and my app isn't deployed yet. So I should remove references to these until I do an initial deploy. This is of course not ideal, but at line where I grab the API by its `attrApiId` is only there because I can't put in an Identity pool.

OMG...looking at the docs, there is in fact a way to pass in an unauthenticated role:

```ts
authorizationConfig: {
  defaultAuthMode: 'AMAZON_COGNITO_USER_POOLS',
  userPoolConfig: {
    userPool: props.userpool,
  },
  iamConfig: {
    unauthenticatedUserRole: props.unauthenticatedRole,
  }
}
```

Again, this should follow the CDK props to avoid situations like this.

Going to try and redeploy:

`Error: The following CloudFormation Parameters are missing a value: authRoleName`

This is a mapping issue since `props.unauthenticatedRole.roleName` is a thing.
Also note, that TS is not giving me errors throughout this guessing game.

After 20 minutes of looking into this, my newest hypothesis is that the role is tokenized and thus not yet created. I'm going to remove the references, deploy, and readd.

DEPLOYING...

![SUCCESSFUL DEPLOY](./notes-images/image.png)

Now let's test the theory and readd the iam config..

Still got the error.

Hold up.

![authrole error](./notes-images/image-1.png)
It's asking for an AUTHROLE omg...if this field is optional but actually required I'm gonna be pissed.

It deployed😤

Now I have to `destroy` the project and redeploy to see if it can all deploy in one go.

`npx aws-cdk destroy --profile focus-otter-sandbox`

> 🗒️ While destroying, I took this time to review the Amplify docs and saw that I incorrectly had the `owner` settins on the `id`. Fixed. I don't want to gloss over this however. The `owner`, `createdAt`, `id`, etc are fields that should be documented as auto-generated for the customer.

```graphql
owner: String @auth(rules: [{ allow: owner, operations: [read, delete] }])
```

The application is destroyed. This is also a good time to see if there are any resources that don't get cleaned up and need `Policy.DESTROY` set.

```sh
npx aws-cdk deploy --profile focus-otter-sandbox
```

Deployed Successfully 🎉

> 🗒️ This is with an SSO user on a non-default profile. Very, very nice.

## Verification

Looks like 2 stacks were deployed:
`AmplifyCdkConstructSampleStack` (my stack name) and `AmplifyCdkConstructSampleStack-Trip-TGFRB5UA3IOT`. Customers should be aware of how the resources are deployed in their account.

Looking at the stack resources, I see the following:

- `AmplifyCdkConstructSampleStack`: My project stack--including my API, but not the generated tables or resolvers.
- `AmplifyCdkConstructSampleStack-Trip-TGFRB5UA3IOT`: The DynamoDB tables and AppSync resolvers associated with my API

Also my Cognito stuff is all there--note that there are two since the previous resources were in fact not cleaned up, but this is expected default behavior. For Amplify customers this may be a shock, but for CDK customers this is how it should be (the userpool, identity pool and web client have appended unique IDs).

For AppSync, my API is called `trip-logger-trip-api-NONE`...the `NONE` part is throwing me off. Schema looks gorgeous and fully fleshed out (moreso than I bother to do!), and all of my AppSync functions and datasources are there and named appropriately.

VTL. I've gone back and forth on this being a blocker or not. At this point in time, I don't think it is. Actually, despite earlier frustration (primarily with types and documentation), I'm feeling pretty good about this construct.

What I love so far, is that as a CDK dev, I still feel like I'm in the CDK. The construct is just here to make my API development faster/easier.

## API Testing

I'll test the Cognito user flow by creating a user in Cognito:
![cognito user](./notes-images/image-2.png)

The nice thing is that AppSync supports users having to change their password:
![appsync cognito auth](./notes-images/image-3.png)

![appsync update auth ](./notes-images/image-4.png)

> 🗒️ Folks transitioning from Amplify to the CDK may notice that the default password policy in Cognito is stricter than the password policy `amplify add auth` assumes.

Once logged in, I'm able to perform all the CRUD operations you would expect
![list trips query](./notes-images/image-5.png)
![create trip mutation](./notes-images/image-6.png)

What's crazy is that I'm complaining about getting this set up and the time it's taken me to work with this construct, and yet it's still saved me hours (if not 2 days).

Alright, alright. It works...

**Now let's try to break it!**

## Enable Logging

I could've swore I reported this.

> 🗒️ update: I reported x-ray not being enabled by default, not cloudwatch logging.

With resolver code being generated on our behalf we 100% want a way to enable logging at the main level.
