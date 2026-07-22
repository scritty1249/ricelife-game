import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PK = "LOBBYID";
const ERROR_NAME = "ConditionalCheckFailedException";

export async function create (id, data) {
    try {
        return await docClient.send(new PutCommand({
            TableName: process.env.AWS_DB,
            Item: { [PK]: id, ...(data || {}) },
            ConditionExpression: "attribute_not_exists(#pk)",
            ExpressionAttributeNames: { "#pk": PK }
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function get (id) {
    const response = await docClient.send(new GetCommand({
        TableName: process.env.AWS_DB,
        Key: { [PK]: id },
    }));
    return response.Item;
}

export async function set (id, key, value) {
    try {
        return await docClient.send(new UpdateCommand({
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            UpdateExpression: "SET #attr = :value",
            ConditionExpression: "attribute_exists(#pk)", 
            ExpressionAttributeNames: { 
                "#attr": key,
                "#pk": PK
            },
            ExpressionAttributeValues: { ":value": value }
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function update (id, item) {
    try {
        const keys = Object.keys(item);
        const expression = "SET " + keys.map((key, i) => `#attr${i} = :value${i}`).join(", ");
        const itemKeys = {};
        const itemValues = {};
        keys.forEach((key, i) => {
            itemKeys[`#attr${i}`] = key;
            itemValues[`:value${i}`] = item[key];
        });
        return await docClient.send(new UpdateCommand({
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            UpdateExpression: expression,
            ConditionExpression: "attribute_exists(#pk)", 
            ExpressionAttributeNames: itemKeys,
            ExpressionAttributeValues: itemValues
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function push (id, key, value) {
    try {
        return await docClient.send(new UpdateCommand({
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            UpdateExpression: "SET #attr = list_append(if_not_exists(#attr, :empty), :value)",
            ConditionExpression: "attribute_exists(#pk)",
            ExpressionAttributeNames: { 
                "#attr": key,
                "#pk": PK
            },
            ExpressionAttributeValues: {
                ":value": [value],
                ":empty": []
            }
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function remove (id) {
    try {
        return await docClient.send(new DeleteCommand({
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            ConditionExpression: "attribute_exists(#pk)",
            ExpressionAttributeNames: { "#pk": PK }
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function exists (id) {
    const response = await docClient.send(new GetCommand({
        TableName: process.env.AWS_DB,
        Key: { [PK]: id },
        ProjectionExpression: PK
    }));
    return response.Item !== undefined;
}
