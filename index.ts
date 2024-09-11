import 'dotenv/config';
import { AI } from '@redbtn/ai';
import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { formatMessages, sendMessage, streamThread } from './ai/threads';
import { checkVector } from './ai/vectors';

//! Horrible idea to hardcode the path to ffmpeg
ffmpeg.setFfmpegPath("E:/Downloads/ffmpeg-2024-09-02-git-3f9ca51015-full_build/bin/ffmpeg.exe");

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
      receivedMessage(client, message);
    });

    client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      switch (interaction.commandName) {
        case 'ping': {
          await interaction.reply('Pong!');
          break;
        }
        case 'reset': {
          //get the channel id
          const channel = interaction.channelId;
          //get the thread id
          const channels = JSON.parse(fs.readFileSync('channels.json', 'utf8'));
          const threadId = channels[channel].thread;
          //delete the thread
          await AI.deleteThread(threadId);
          //delete the channel from the channels.json file
          delete channels[channel];
          fs.writeFileSync('channels.json', JSON.stringify(channels), 'utf8');
          await interaction.reply('Conversation reset.');
          break;
        }
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


async function receivedMessage(client: Client, message: any) {
  const clientID = client.user?.id;
  if (message.author.bot) return;
  const isReply = await (async () => {
    if (message.channel.type === 1) return false;
    if (message.reference) {
      const reply = await message.channel.messages.fetch(message.reference.messageId as string);
      return reply.author.id === clientID;
    }
    return false;
  })();
  const isMentioned = message.channel.type === 1 || message.mentions.has(clientID as string);
  if (!isReply && !isMentioned) return;
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
      const run = await AI.runThread(
        'asst_SpEof0Si2eHm8na4HmR2Fh8b', 
        threadId, 
        { additional_messages: messages.slice(-32),
          additional_instructions: `Current Timestamp: ${new Date().toISOString()}. \n 
          Don't start your response with a (Red @ XXXXXXXXXXXXX) prefix.`,
         });
      streamThread(run, (data: any) => {
        if (typeof data !== 'string')
          if (data.object == 'thread.message') {
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
  //! New Thread
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

}