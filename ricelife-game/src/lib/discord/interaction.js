export const INTERACTION = {
    TYPE: { // https://docs.discord.com/developers/interactions/receiving-and-responding#interaction-object-interaction-type
        PING: 1,
        APPLICATION_COMMAND: 2,
        MESSAGE_COMPONENT: 3,
        APPLICATION_COMMAND_AUTOCOMPLETE: 4,
        MODAL_SUBMIT: 5
    },
    CONTEXT: { // https://docs.discord.com/developers/interactions/receiving-and-responding#interaction-object-interaction-context-types
        GUILD: 0, // server
        BOT_DM: 1, // DMing the bot directly
        PRIVATE_CHANNEL: 2, // any DM or Group DM that does not have the bot in it
    },
    COMMAND: { // https://docs.discord.com/developers/interactions/application-commands#application-command-object-application-command-types
        CHAT_INPUT: 1, // slash "/" commands
        USER: 2,
        MESSAGE: 3,
        PRIMARY_ENTRY_POINT: 4 // launch command
    }
};
