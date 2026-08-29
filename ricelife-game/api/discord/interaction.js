import { verify } from "@server/lib/discord/verify.js";
import { INTERACTION } from "@server/lib/discord/interaction.js";
import * as commands from "@server/lib/discord/commands.js";
import { closeLobby } from "@server/lib/lobby/manage.js";

const ADMINS = [
    "644947703821762560",
    "1056031947257815140"
];

function isUserAdmin (id) {
    return ADMINS.includes(id);
}

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
            switch (commandName) {
                case "api":
                    await parseApiCommand(interaction);
                    return commands.defer(false);
                case "amiadmin":
                    return commands.message(
                        isUserAdmin(interaction.user?.id ?? interaction.member?.user?.id)
                            ? "Yes"
                            : "No"
                        );
            };
        default:
            console.warn("Invalid Slash Command Interaction");
            console.dir(interaction, { depth: null });
    };
}

async function parseApiCommand (interaction) {
    const { token } = interaction;
    const user = interaction.user ?? interaction.member?.user;
    console.info("API command invoked from discord");
    waitUntil(
        promiseTimeout(3000) // [!] unga bunga solution to ensuring waitUntil fires after the response...
        .then(() => {
            if (isUserAdmin(user?.id))
                return executeApiCommand(interaction);
            else
                return commands.response("Invalid context to use this command.", token);
        }).then(() => console.debug("Queue execution finished.")
        ).catch(async (error) => {
            console.error(error);
            await commands.response("Something went wrong on our side.", token);
        })
    );
}

async function executeApiCommand (interaction) {
    // api subcommand interactions should include an option field
    const command = interaction.data?.options?.[0];
    const commandName = command?.name?.toLowerCase();
    const { token } = interaction;
    switch (commandName) {
        case "close-lobby":
            const lobbyid = command?.options?.[0]?.value;
            if (lobbyid) {
                const success = await closeLobby(lobbyid);
                if (success) {
                    commands.response(`Closed lobby ${lobbyid}`, token);
                } else {
                    commands.response(`Failed to close lobby ${lobbyid}`, token);
                }
            } else {
                commands.response(`Missing lobbyid parameter`, token);
            }
            console.info("Invoked: close-lobby")
        break;
        default:
            await commands.response(`Command '${commandName}' not recognized!`, token);
    };
}
