import * as AWS from 'aws-sdk'
import { DynamoDBStreamEvent } from 'aws-lambda'

exports.handler = async (event: DynamoDBStreamEvent) => {
	event.Records.forEach((record) => {
		console.log('Processing record: ', JSON.stringify(record))
		const obj = record.dynamodb?.NewImage
		console.log('id: ', obj?.id.S)
		console.log('name: ', obj?.name.S)
	})
}
