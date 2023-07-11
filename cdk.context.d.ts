export type CDKContext = {
	appName: string
	api: {
		name: string
	}
	auth: {
		poolName: string
		clientName: string
		identityName: string
	}
}
