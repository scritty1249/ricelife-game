import { verify } from "@server/lib/discord/verify.js";
import { INTERACTION } from "@server/lib/discord/interaction.js";
import * as commands from "@server/lib/discord/commands.js";
export async function POST (request) {
    try {
        // verify interaction
        const body = await request.text();
        const headers = request.headers;
        if (!verify(headers, body))
            return commands.invalid();
        const interaction = JSON.parse(body); // body should be JSON, so this should never fail...
        return await parseInteraction(interaction);
    } catch (err) {
        console.error("Execution error:", err);
        return Response.json({error: err.message}, {status: 500, statusText: "Internal server error"});
    }
}

async function parseInteraction (interaction) {
    switch (interaction.type) {
        case INTERACTION.TYPE.APPLICATION_COMMAND:
            return await parseCommandInteraction(interaction);
        case INTERACTION.TYPE.MESSAGE_COMPONENT:
            return await parseComponentInteraction(interaction);
        case INTERACTION.TYPE.PING:
        default:
            return commands.acknowledge();
    };
}

async function parseCommandInteraction (interaction) {
    switch (interaction.data?.type) {
        case INTERACTION.COMMAND.CHAT_INPUT:
            return await parseSlashCommand(interaction);
        case INTERACTION.COMMAND.PRIMARY_ENTRY_POINT:
            return commands.launch();;
        default:
            console.warn("Unknown Application Command Interaction");
            console.dir(interaction, { depth: null });
    };
}

async function parseComponentInteraction (interaction) {
    const customID = interaction.data?.custom_id || "";
    if (customID.startsWith("LOBBY_")) {
        return commands.launch();
    } else {
        console.warn("Unknown Message Component Interaction");
        console.dir(interaction, { depth: null });
    }
}


async function parseSlashCommand (interaction) {
    const commandName = interaction.data?.name?.toLowerCase();
    switch (interaction.context) {
        case INTERACTION.CONTEXT.BOT_DM:
            break;
        case INTERACTION.CONTEXT.GUILD:
        case INTERACTION.CONTEXT.PRIVATE_CHANNEL:
            break;
        default:
            console.warn("Invalid Slash Command Interaction");
            console.dir(interaction, { depth: null });
    };
}
