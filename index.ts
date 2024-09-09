import 'dotenv/config';
import { AI } from '@redbtn/ai';
import { Client, Collection, GatewayIntentBits, Message, Partials, REST, Routes } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { PassThrough, Readable } from 'stream';


ffmpeg.setFfmpegPath("E:/Downloads/ffmpeg-2024-09-02-git-3f9ca51015-full_build/bin/ffmpeg.exe");

const { CLIENT_ID, TOKEN } = process.env;

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN as string);
const main = async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID as string), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
    const client = new Client(
      { intents: [GatewayIntentBits.Guilds,
                  GatewayIntentBits.GuildMessages,
                  GatewayIntentBits.MessageContent,
                  GatewayIntentBits.DirectMessages,
      ],
        partials: [Partials.Channel],
      }
    );

    client.on('ready', () => {
      console.log(`Logged in as ${client.user?.tag}!`);
    });

    client.on('messageCreate', async message => {
      const clientID = client.user?.id;
      if (message.author.bot) return;
      if (!(message.channel.type === 1) && !message.content.includes(clientID as string)) return;
      message.channel.sendTyping();
      const typing = setInterval(() => {
        message.channel.sendTyping();
      }, 5000);
      const channel = message.channel.id;
      let threadId: string|false = false;
      const channels = JSON.parse(fs.readFileSync('channels.json', 'utf8'));
      for (const key in channels) {
        if (key === channel) {
          threadId = channels[key].thread as string;
          let vector = channels[key].vector as string;
          if (!vector) { 
            vector = await checkVector(threadId);
            channels[key].vector = vector;
            fs.writeFileSync('channels.json', JSON.stringify(channels), 'utf8');
          }
          //await buildContext(vector, client, message);
          const fetched = (await message.channel.messages.fetch({ after:channels[key].lastMessage})).reverse();
          const messages: Array<any> = await formatMessages(fetched);
          channels[key].lastMessage = message.id;
          fs.writeFileSync('channels.json', JSON.stringify(channels), 'utf8');
          const run = await AI.runThread('asst_SpEof0Si2eHm8na4HmR2Fh8b', threadId, { additional_messages: messages.slice(-32) });
          streamThread(run, (data: any) => {
            if (typeof data !== 'string')
              if (data.object == 'thread.message') {
                console.log(data.content[0].text.value);
                sendMessage(message, data.content[0].text.value);
              } else if (data.status == 'failed') {
                sendMessage(message, `I'm sorry, I am unable to assist you at this time. ERROR: ${data.last_error.message}`);
              } else {
                console.log(data);
              }
            clearInterval(typing);
          });
        } 
      }
      if (!threadId) {
        try {
          channels[channel] = {};
          const messages = await formatMessages((await message.channel.messages.fetch({ limit: 32 })).reverse());
          const thread = await AI.createThread({
            assistant_id: 'asst_SpEof0Si2eHm8na4HmR2Fh8b',
            messages: messages,
          });
          streamThread(thread, async (data: any) => {
            if (typeof data !== 'string')
              if (data.object == 'thread') {
                channels[channel].thread = data.id;
                channels[channel].lastMessage = message.id;
                fs.writeFileSync('channels.json', JSON.stringify(channels), 'utf8');
              } else if (data.object == 'thread.message') {
                sendMessage(message, data.content[0].text.value);
              } else if (data.status == 'failed') {
                sendMessage(message, `I'm sorry, I am unable to assist you at this time. ERROR: ${data.last_error.message}`);
              } else {
                console.log(data);
              }
            clearInterval(typing);
          });
        } catch (e) {
          console.log(e);
        }
      }
    });

    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
      }
    });

    client.on('guildCreate', async guild => {
      try { 
        const botMember = await guild.members.fetch(client.user?.id as string);
        await botMember.setNickname('Red');
      } catch (e) {
        console.log(e);
      }
    });

    client.login(TOKEN);
  } catch (error) {
    console.error(error);
  }
};

main();

async function streamThread(thread: any, callback: any) {
  for await (const event of thread) {
    switch (event.event) {
      case "thread.created": {
        callback(event.data);
        break;
      }
      case "thread.message.delta": {
        const deltas = event.data.delta.content;
        deltas?.forEach((delta: any) => {
          if (delta.type == "text") callback(delta.text?.value as string);
        });
        break;
      }
      case "thread.message.completed": {
        callback(event.data);
        break;
      }
      case "thread.run.failed": {
        callback(event.data);
        break;
      }
      case "thread.run.requires_action": {
        const toolcalls = event.data.required_action.submit_tool_outputs.tool_calls;
        const runId = event.data.id;
        const threadId = event.data.thread_id;

        const results: any[] = [];
        for await (const tool of toolcalls) {
          console.log(tool);
          const toolId = tool.id;
          console.log(event)
          const args = JSON.parse(tool.function.arguments);
          //dynamically import & run function from "toolcalls" folder
          const toolcall = await import(`./toolcalls/${tool.function.name}.ts`);
          const result = await toolcall[tool.function.name](args);
          results.push({
            tool_call_id: toolId,
            output: JSON.stringify(result),
          });
        }
        console.log(results)
        const newRun = await AI.submitTools(threadId, runId, results)
        console.log(newRun);
        streamThread(newRun, callback);
        break;
      }
      default:{
        console.log(event.event);
        break;
      }
    }
  }
}

async function checkVector(threadId: string) {
  /**
   * 1. Check if the thread has a vector
   * 2. If it does, return the vector
   * 3. If it doesn't, create a vector and add it to the thread
   * 4. Return the vector
   */
  const thread = await AI.getThread(threadId);
  if (thread?.tool_resources?.file_search?.vector_store_ids) {
    return thread.tool_resources.file_search.vector_store_ids[0];
  } else {
    const vector = await AI.createVector({ name: threadId as string, file_ids:[] });
    await AI.editThread(threadId, { tool_resources: { file_search: { vector_store_ids: [vector.id] } } });
    return vector.id;
  }
}

async function buildContext(vector: string, client: Client, message: Message) {
  /**
   * 1. Fetch the last 100 messages in the channel
   * 2. Write the messages to a file
   * 3. Upload the file to OpenAI
   * 4. Delete the old file from OpenAI
   * 5. Add the new file to Vector
  */
  const last100messages = await message.channel.messages.fetch({ limit: 100 });
  const formattedMessages = await formatMessages(last100messages); 
  const filePath = `context/${vector}.json`;
  fs.writeFileSync(filePath, JSON.stringify(formattedMessages), 'utf8');
  const file = fs.createReadStream(filePath);
  const upload = await AI.uploadFile(file as unknown as File);
  const fileId = upload.id;
  const existingFiles = (await AI.listVectorFiles(vector)).data;
  existingFiles.forEach(async (file: any) => {
      await AI.deleteFile(file.id);
  });
  await AI.addVectorFile(vector, fileId);
}

async function sendMessage(message: Message, content: string) {
  /**
   * 1. Check if the message is too long
   * 2. Split the message into chunks
   * 3. Send the chunks
   * 4. If the message is a DM, send the message to the user
   * 5. If the message is a reply, reply to the message to the channel
   */
  let messageChunks: any = [];
  const MAX_CHUNK_LENGTH = 2000;
  const contentLength = content.length;

  if (contentLength <= MAX_CHUNK_LENGTH) {
    messageChunks.push(content);
  } else {
    let startIndex = 0;
    let endIndex = MAX_CHUNK_LENGTH;

    while (startIndex < contentLength) {
      const chunk = content.substring(startIndex, endIndex);
      messageChunks.push(chunk);

      startIndex = endIndex;
      endIndex += MAX_CHUNK_LENGTH;
    }
  }

  for (const chunk of messageChunks) {
    if (message.channel.type === 1) {
      message.channel.send(chunk);
    } else {
      message.reply(chunk);
    }
  }
}

async function formatMessages(messages: Collection<string, Message<boolean>>) {
  /** 
   * 1. Format the messages with author, content, and timestamp
   * 2. Retrieve user information from the author
   * 3. Return the formatted messages
   */
  const usersMap: any = {};

  const newMessages: any = [];

  for await (const [_,message] of messages) {
    if (!usersMap[message.author.id]) {
      if (message.member)
      usersMap[message.author.id] = message.member;
      else 
      usersMap[message.author.id] = await message.guild?.members.fetch(message.author.id);
      if (!usersMap[message.author.id]) usersMap[message.author.id] = message.author;
    }
    const name = usersMap[message.author.id].displayName;
    const attachments = message.attachments.map(attachment => attachment.url);
    let content = message.content;
    if (message.mentions.users.size > 0) {
      message.mentions.users.forEach((user: any) => {
        if (user.id == '1272745319586730025') {
          content = content.replace(`<@${user.id}>`, '');
        } else {
          content = content.replace(`<@${user.id}>`, `@${user.displayName}`);
        }
      });
    }
    const messageObject: any = {
      role: message.author.username == 'redbtn' ? 'assistant' : 'user',
      content: `(${name} @ ${message.createdTimestamp}): ${content}`,
    }
    if (attachments.length > 0) {
      messageObject.content = [{type: 'text', text: messageObject.content}];
      attachments.forEach(async (attachment: string) => {
        const endsWith = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        console.log(attachment);
        if (endsWith.some((ending) => (attachment.includes('.'+ending+'?') || attachment.endsWith('.'+ending)))) {
          console.log(attachment);
          messageObject.content.push({type: 'image_url', image_url:{url: attachment}});
        } else {
          //! fetch attachment & save to local filesystem
          const file = await fetch(attachment);
          let upload;
          if (file.headers.get('content-type') === 'video/quicktime') {
            const converted = await convertAndUpload(attachment);
            upload = await AI.uploadFile(converted as unknown as File);
          } else {
            upload = await AI.uploadFile(file as unknown as File);
          }
          console.log(upload);
          messageObject.content.push({type: 'text', text: messageObject.content + `\n ${attachment}`});
        }
      })
    }
    console.log(messageObject);
    newMessages.push(messageObject);
  }
  return newMessages;
}



async function readStream(stream: any): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let done = false;

  while (!done) {
    const { value, done: doneReading } = await reader.read();
    done = doneReading;
    if (value) {
      result += decoder.decode(value, { stream: !done });
    }
  }

  return result;
}

async function convertAndUpload(url: string): Promise<Buffer> {
  // Fetch the video from the URL
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch video');

  // Manually convert the web stream to a Node.js Readable stream
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Failed to create reader');

  const videoStream = new Readable({
    read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      }).catch(err => {
        this.destroy(err);
      });
    }
  });

  // Create a pass-through stream for the output
  const outputStream = new PassThrough();

  ffmpeg(videoStream)
    .format('webp')
    .on('error', err => {
      console.error('Error during conversion:', err.message);
    })
    .pipe(outputStream);

  // Upload the output stream to OpenAI (or any other service)
  return await streamToBuffer(outputStream);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', err => reject(err));
  });
}