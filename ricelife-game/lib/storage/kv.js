import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PK = "LOBBYID";
const PK_EXISTS_CONDITION = "attribute_exists(#pk)";
const PK_EXPRESSION_NAME = {"#pk": PK};
const ERROR_NAME = "ConditionalCheckFailedException";

export async function create (id, data) {
    try {
        return await docClient.send(new PutCommand({
            TableName: process.env.AWS_DB,
            Item: { [PK]: id, ...(data || {}) },
            ConditionExpression: "attribute_not_exists(#pk)",
            ExpressionAttributeNames: PK_EXPRESSION_NAME
        }));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function get (id, ...keys) {
    const command = {
        TableName: process.env.AWS_DB,
        Key: { [PK]: id },
    };
    if (keys?.length) {
        let i = 0;
        let attributes = {};
        const expressions = [];
        for (const key of keys) {
            const { names, expression } = parseNestedKey(key, i);
            if (expression) {
                expressions.push(expression);
                attributes = {...attributes, ...names};
            }
            i++;
        }
        if (expressions.length) {
            command.ProjectionExpression = expressions.join(", ");
            command.ExpressionAttributeNames = attributes;
        }
    }
    const response = await docClient.send(new GetCommand(command));
    return response?.Item;
}

export async function set (id, ...kwargs) {
    if (kwargs.length % 2 !== 0)
        throw new Error("Missing value for key parameter: ", kwargs?.at?.(-1));
    try {
        let names = {};
        const values = {};
        const expressions = [];
        for (let i = 0; i < kwargs.length; i += 2) {
            const { names: n, expression } = parseNestedKey(kwargs[i], i / 2);
            const value = kwargs[i+1];
            const idx = i / 2;
            names = {...names, ...n};
            values[`:val${idx}`] = value;
            expressions.push(expression);
        }
        const expression = "SET " + expressions.map((e, i) => `${e} = :val${i}`);
        const command = {
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            UpdateExpression: expression,
            ConditionExpression: PK_EXISTS_CONDITION, 
            ExpressionAttributeNames: {...names, PK_EXPRESSION_NAME},
            ExpressionAttributeValues: values
        };
        return await docClient.send(new GetCommand(command));
    } catch (error) {
        if (error.name === ERROR_NAME) return null;
        else throw error;
    }
}

export async function update (id, ...kwargs) {
    if (kwargs.length % 2 !== 0)
        throw new Error("Missing value for key parameter: ", kwargs?.at?.(-1));
    try {
        let names = {};
        const values = {};
        const expressions = [];
        for (let i = 0; i < kwargs.length; i += 2) {
            const { names: n, expression } = parseNestedKey(kwargs[i], i / 2);
            const value = kwargs[i+1];
            const idx = i / 2;
            names = {...names, ...n};
            values[`:val${idx}`] = value;
            expressions.push(expression);
        }
        const expression = "SET " + expressions.map((e, i) => `${e} = :val${i}`);
        const condition = PK_EXISTS_CONDITION
            + " AND "
            + expressions.map((e) => `attribute_exists(${e})`).join(" AND ");
        const command = {
            TableName: process.env.AWS_DB,
            Key: { [PK]: id },
            UpdateExpression: expression,
            ConditionExpression: condition, 
            ExpressionAttributeNames: {...names, PK_EXPRESSION_NAME},
            ExpressionAttributeValues: values
        };
        return await docClient.send(new GetCommand(command));
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

export async function exists (id, key = ".") {
    const command = {
        TableName: process.env.AWS_DB,
        Key: { [PK]: id },
        ConsistentRead: false
    };
    const { names, expression } = parseNestedKey(key);
    if (expression) {
        command.ProjectionExpression = expression;
        command.ExpressionAttributeNames = names;
    }
    const response = await docClient.send(new GetCommand(command));
    const compare = expression
        // recurse through the returned item
        ? keys.split(".").reduce((acc, curr) =>
            acc && acc[curr] !== undefined ? acc[curr] : undefined,
            response.Item)
        : response.Item;
    return compare !== undefined;
}

function parseNestedKey (key, indexOffset = 0, attributeName = "attr") {
    const keys = key?.split?.(".") || [];
    const names = Object.fromEntries(
        Array.from(keys, (k, i) =>
            [`#${attributeName}${i + indexOffset}`, k]));
    const expression = keys.length
        ? keys.map((k, i) => `#${attributeName}${i + indexOffset}`).join(".")
        : "";
    return { names: names, expression: expression };
}