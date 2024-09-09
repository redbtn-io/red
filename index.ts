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
