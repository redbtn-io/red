# Red (by redbtn)

<img src="https://redbtn.io/src/assets/redbutton-glossy.png" width="256" align="right"/>

**Red** is a Discord bot powered by AI designed to manage conversations, handle user interactions, and assist in managing messages, users, and channels. Additionally, it provides AI-powered conversation threads, a vector store for context management, and several useful slash commands.

<h3>Installation</h3>

You can install Red via npm. The package is named `@redbtn/red`.

```bash
npm install @redbtn/red
```

Make sure you also install the required `@redbtn/ai` package, which Red depends on for its functionality:

```bash
npm install @redbtn/ai
```

This will ensure both packages are correctly set up for your project.

## Usage

To use Red in your Discord bot:

1. Create a `.env` file with the following variables:

    ```
    CLIENT_ID=<Your_Discord_Client_ID>
    TOKEN=<Your_Discord_Bot_Token>
    OPENAI_API_KEY=<Your_OpenAI_API_Key>
    ```

2. Run the bot:

    ```bash
    npm run start
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
