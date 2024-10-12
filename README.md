# Red (by redbtn)

![a red button](https://redbtn.io/src/assets/redbutton-glossy.png)

**Red** is a Discord bot powered by AI designed to manage conversations, handle user interactions, and assist in managing messages, users, and channels. Additionally, it provides AI-powered conversation threads, a vector store for context management, and several useful slash commands.

## Installation

You can install Red via npm. The package is named `@redbtn/red`.

```bash
npm install @redbtn/red
```

## Usage

To use Red in your Discord bot:

1. Create a `.env` file with the following variables:

    ```
    CLIENT_ID=<Your_Discord_Client_ID>
    TOKEN=<Your_Discord_Bot_Token>
    ```

2. Import and initialize the bot:

```typescript
import 'dotenv/config';
import { AI } from '@redbtn/ai';
import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

ffmpeg.setFfmpegPath("path/to/ffmpeg");

const { CLIENT_ID, TOKEN } = process.env;

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  }, {
    name: 'reset',
    description: 'Resets the conversation',
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);
const main = async () => {
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('Successfully reloaded application (/) commands.');

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel],
  });

  client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
  });

  // Additional bot logic...
};

main();
```

## Features

### AI-Powered Conversations
Red can handle conversations using AI-generated threads, automatically creating and maintaining context across channels.

### Slash Commands
- **`/ping`**: Replies with "Pong!" to verify bot responsiveness.
- **`/reset`**: Resets the conversation in the current channel, deleting the conversation thread and its context.

### Message Handling
- Automatic message formatting and management for better interaction with users.
- Typing indicators to simulate natural conversation flow.
- Supports both direct messages and channel replies.

### Vector Store Management
Red integrates an AI-powered vector store to store and manage conversation contexts. The bot checks and creates vectors for each conversation thread, allowing it to maintain and refer back to context as needed.

## Future Plans

We plan to enhance **Red** with the following features:

1. **Exported Callable Actions**:
   - **Message management**: Functions to manage, edit, and delete Discord messages.
   - **User management**: Actions to handle users, such as kicking, banning, and user role assignments.
   - **Channel management**: Tools to create, modify, and delete channels.

2. **AI Knowledge & Vector Store**:
   - Functions to dynamically add and modify AI knowledge bases.
   - Improvements to vector store integration, allowing more robust and contextually aware conversations.

3. **Expanded Slash Commands**:
   - **Utility Commands**: Additional commands for moderators and users for faster interaction with the bot.
   - **Custom AI Actions**: Slash commands that trigger AI-powered tools for specific tasks, such as information retrieval or conversation summarization.

## License

This project is licensed under the MIT License.

For any questions or contributions, feel free to open an issue on GitHub or contact the maintainers.
