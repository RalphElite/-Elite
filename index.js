var botArray = []

const {
  RichEmbed,
  Client
} = require('discord.js')
const ytdl = require('ytdl-core');
const search = require('youtube-search');
const ypi = require('youtube-playlist-info');
const ffmpeg = require('ffmpeg');

const settings = {
  "prefix": '#',
  "passes": 1,
  "key": 'AIzaSyBBgDH16LwLXyQ9t-VKpNbE6v6DGZ0pnKc',
  "maxQueueSize": 40,
  "embedColor": '36393e'
}

class MusicBot extends Client {
  constructor(options) {
    super(options);
    this.available = true;
    this.number = options.number,
      this.queue = {};
  }

}

async function getQueue(client, guild) {

  if (!client.queue[guild]) client.queue[guild] = {
    queue: [],
    songNames: [],
    songRequesters: [],
    loop: 0,
    volume: 0
  };

  return client.queue[guild];

}


function askPermission(message, number) {

  const Prom = new Promise(async (resolve, error) => {

    if (message.member.voiceChannel && message.member.voiceChannel.members.filter(n => n.user.bot).size == 0 && botArray.filter(n => n.available)[0] && botArray.filter(n => n.available)[0].number == number) return resolve(true)
    if (message.member.voiceChannel && message.member.voiceChannel.members.filter(n => n.user.bot).size == 0 && botArray.filter(n => n.available)[0] && botArray.filter(n => n.available)[0].number != number) return resolve(false)

    if (message.member.voiceChannel && message.member.voiceChannel.members.filter(n => n.user.bot).size != 0 && message.member.voiceChannel == message.guild.me.voiceChannel) return resolve(true)
    return resolve(false)

  });

  return Prom;

}

function createBot(token, prefix, number) {

  var client = new MusicBot({
    disableEveryone: true,
    disabledEvents: ['TYPING_START', 'TYPING_STOP'],
    number: number
  });

  botArray.push({
    token: token,
    prefix: prefix,
    number: number,
    available: true
  })

  client.on('ready', function() {
    console.log(`Bot ${number} is now ready!`);

    client.user.setPresence({
      status: "online",
      game: {
        name: `${settings.prefix}play`,
        type: 'WATCHING'
      }
    });

  });

  client.login(token)

  client.on('message', async msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;
    var bool = await askPermission(msg, number)
    if (!bool) return;

    const args = msg.content.split(' ').slice(1);
    if (commands.hasOwnProperty(msg.content.toLowerCase().slice(prefix.length).split(' ')[0])) commands[msg.content.toLowerCase().slice(prefix.length).split(' ')[0]](client, msg, settings, args);
  });

  client.on('voiceStateUpdate', (oldMember, newMember) => {

    if (oldMember.voiceChannelID == newMember.guild.me.voiceChannelID && oldMember.guild.me.voiceChannel != undefined && oldMember.voiceChannel != undefined) {
      if (newMember.guild.me.voiceChannel.members.size < 2) {
        setTimeout(() => {
          if (!oldMember.guild.me.voiceChannel) return;
          if (oldMember.guild.me.voiceChannel.members.size < 2) {
            if (newMember.guild.me.voiceChannel && newMember.guild.me.voiceChannel.connection && newMember.guild.me.voiceChannel.connection.dispatcher) {
              newMember.guild.me.voiceChannel.connection.dispatcher.end()
            } else {
              newMember.guild.me.voiceChannel.leave()
              client.user.setPresence({
                status: "online",
                game: {
                  name: `${settings.prefix}play`,
                  type: 'WATCHING'
                }
              });
              botArray[newMember.client.number].available = true;
            }
          }
        }, 10000);
      }
    }
  });

}

//Commands
const commands = {

  'playfunction': async (message, connection, server) => {

    botArray[message.client.number].available = false;

    server.dispatcher = connection.playStream(ytdl(server.queue[0], {
      filter: 'audioonly'
    }));

    message.client.user.setPresence({
      game: {
        name: server.songNames[0],
        type: 2
      },
      status: "dnd"
    })

    //Set the volume
    server.dispatcher.setVolume(parseInt(200 / 100));

    //Set the volume in the server array
    server.volume = 200

    server.dispatcher.on("end", async function() {

      //If loop is of
      if (server.loop === 0) {
        //Get rid of the just played song
        server.queue.shift();
        server.songRequesters.shift();
        server.songNames.shift();
      }

      //If there is another song
      if (server.queue[0]) {
        commands.playfunction(message, connection, server);

        if (server.loop === 1) return;
        let id = await ytdl.getVideoID(server.queue[0]);
        let embed = new RichEmbed()
          .setColor(settings.embedColor)
          .setTitle("Now Playing")
          .setDescription(`**Now Playing**: ${server.songNames[0]}.\n**Song Requester**: ${server.songRequesters[0]}.`)
          .setThumbnail(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
        message.channel.send(embed)
      }
      if (!server.queue[0]) {
        //If there isn't 
        connection.disconnect();
        message.client.user.setPresence({
          status: "online",
          game: {
            name: `${settings.prefix}play`,
            type: 'WATCHING'
          }
        });
        if (message.guild.me.voiceChannel.members.size < 2) {
          message.channel.send("💨 | Everyone left, so i stopped with playing");
          if (message.guild.me.voiceChannel) {
            message.guild.me.voiceChannel.leave()
            botArray[message.client.number].available = true;
          }
        } else {
          if (message.guild.me.voiceChannel) {
            message.guild.me.voiceChannel.leave()
            botArray[message.client.number].available = true;
          }
          message.channel.send("💨 | Queue is empty.");
        }
      }

    });
  },
  
  stop: async (client, message, settings, args) => {
    
    if (!message.member.hasPermission('ADMINISTRATOR')) return message.reply("❌ | Sorry. **You** cannot use this command.")
    
    const server = await getQueue(client, message.guild.id);
      
    if (server.queue[0] === null || !message.guild.me.voiceChannel) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Get the dispatcher
    let dispatcher = message.guild.me.voiceChannel.connection.player.dispatcher;
      
       server.queue = [];
       server.songRequesters = [];
       server.songNames = [];
    
    dispatcher.end()
      
    },

  play: async (client, message, settings, args) => {

    const server = await getQueue(client, message.guild.id);

    //Check if the member is in a voice channel
    if (!message.member.voiceChannel) return message.channel.send("❌ | Please join a Voice Channel.");

    //Check if a song is mentioned
    if (!args.join(" ")) return message.channel.send(`:bulb: Play Commands:

${settings.prefix}play <song title> - plays the first result from Youtube
${settings.prefix}play <URL> - plays the provided song, playlist, or stream
${settings.prefix}playlist <URL> - plays the provided playlist`);

    //Check if they have reached the max queue limit
    if (server.queue === settings.maxQueueSize) return message.channel.send("❌ | Sorry. You have reached the max queue size.");

    //Search for the song
    search(args.join(" "), {
      maxResults: 1,
      key: settings.key
    }, async function(err, results) {
      //Catch the error
      if (err) message.channel.send("❌ | Sorry. There was an error searching that song.") && console.log(err);

      //The first result
      let res = results[0];

      //Push to the queue
      server.queue.push(res.link);
      server.songNames.push(res.title);
      server.songRequesters.push(message.author.tag);

      //Send the message
      let id = await ytdl.getVideoID(res.link)
      let embed = new RichEmbed()
        .setColor(settings.embedColor)
        .setTitle("Added to queue")
        .setDescription(`**Added**: ${res.title}.\n**Requester**: ${message.author.tag}`)
        .setThumbnail(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
      message.channel.send(embed);

      if (!message.guild.me.voiceChannel) await message.member.voiceChannel.join().then(function(connection) {
        commands.playfunction(message, connection, server);
      });

    });
  },
  
    volume: async (client, message, settings, args) => {
      
    const server = await getQueue(client, message.guild.id);
      
    if (server.queue[0] === null || !message.guild.me.voiceChannel) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Get the dispatcher
    let dispatcher = message.guild.me.voiceChannel.connection.player.dispatcher;
      
          let volume = message.content.split(' ').slice(1)
          if (volume && volume.length > 0 && !isNaN(volume) && volume >= 0 && volume <= 100) {
            dispatcher.setVolume(volume / 50);
            message.channel.send(`Volume: ${volume}%`);
          } else message.reply('Usage: ' + settings.prefix + 'volume [0-100]')
      
    },
  
    search: async (client, message, settings, args) => {

    const server = await getQueue(client, message.guild.id);

    //Check if the member is in a voice channel
    if (!message.member.voiceChannel) return message.channel.send("❌ | Please join a Voice Channel.");

    //Check if a song is mentioned
    if (!args.join(" ")) return message.channel.send("❌ | Please specify a Search String or a URL.");

    //Check if they have reached the max queue limit
    if (server.queue === settings.maxQueueSize) return message.channel.send("❌ | Sorry. You have reached the max queue size.");

    //Search for the song
    search(args.join(" "), {
      maxResults: 5,
      key: settings.key
    }, async function(err, results) {
      //Catch the error
      if (err) message.channel.send("❌ | Sorry. There was an error searching that song.") && console.log(err);
      
        let embed = new RichEmbed()
        .setColor(settings.embedColor)
        .setTitle("Search Results")
        .setDescription(`${results.map((n, index) => `${index + 1} - ${n.title}`).join('\n')}\n\nSpecify which one you want by typing the matching number.`)
      var m = await message.channel.send(embed);
      
      const filter = m => ['0', '1', '2', '3', '4', '5'].includes(m.content) && m.author.id == message.author.id;

message.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] })
  .then(async collected => {
  
      server.queue.push(results[parseInt(collected.first().content) - 1].link);
      server.songNames.push(results[parseInt(collected.first().content) - 1].title);
      server.songRequesters.push(message.author.tag);
  
      let id = await ytdl.getVideoID(results[parseInt(collected.first().content) - 1].link)
      let embed = new RichEmbed()
        .setColor(settings.embedColor)
        .setTitle("Added to queue")
        .setDescription(`**Added**: ${results[parseInt(collected.first().content) - 1].title}.\n**Requester**: ${message.author.tag}`)
        .setThumbnail(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
      message.channel.send(embed);
  
        if (!message.guild.me.voiceChannel) await message.member.voiceChannel.join().then(function(connection) {
        commands.playfunction(message, connection, server);
      });
})
  .catch(collected => m.delete().catch());

    });
  },

  'playlist': async (client, message, settings, args) => {

    const server = await getQueue(client, message.guild.id);

    //Check if the member is in a voice channel
    if (!message.member.voiceChannel) return message.channel.send("❌ | Please join a Voice Channel.");

    //Check if a song is mentioned
    if (!args.join(" ")) return message.channel.send(`:bulb: Play Commands:

${settings.prefix}play <song title> - plays the first result from Youtube
${settings.prefix}play <URL> - plays the provided song, playlist, or stream
${settings.prefix}playlist <URL> - plays the provided playlist`);

    //Check if they have reached the max queue limit
    if (server.queue === settings.maxQueueSize) return message.channel.send("❌ | Sorry. You have reached the max queue size.");

    let url = message.content.split(' ').slice(1).toString()
    if (url == '' || url === undefined || !url.includes('list=')) return message.channel.send(`Pls send me a playlist link of youtube!`);

    var nieuwe = url.slice(url.indexOf('list='))
    if (nieuwe.includes('index')) nieuwe = nieuwe.slice(0, nieuwe.indexOf('&index'))
    if (nieuwe.includes('&t')) nieuwe = nieuwe.slice(0, nieuwe.indexOf('&t'))

    //Get the search options
    var opts = {
      maxResults: 50,
      key: settings.key
    };

    ypi(opts.key, nieuwe.slice(5), {
      maxResults: opts.maxResults
    }).then(async items => {

      for (let result of items) {

        //Push to the queue
        server.queue.push(`https://www.youtube.com/watch?v=${result.resourceId.videoId}`);
        server.songNames.push(result.title);
        server.songRequesters.push(message.author.tag);

      }

      //Send the message
      message.channel.send(`Playlist got added to my queue!`);

      if (!message.guild.me.voiceChannel) await message.member.voiceChannel.join().then(function(connection) {
        commands.playfunction(message, connection, server);
      });


    }).catch(console.error);

  },

  'help': (client, message, settings, args) => {
    const embed = new RichEmbed()
      .setColor('36393e')
      .setTimestamp()
      .setFooter(`I see that you need some help!`, client.user.displayAvatarURL)
      .addField('📒Commands', `\`${settings.prefix}Play\`\n\`${settings.prefix}Playlist\`\n\`${settings.prefix}Skip\`\n\`${settings.prefix}Pause\`\n\`${settings.prefix}Resume\`\n\`${settings.prefix}Queue\`\n\`${settings.prefix}Clear\`\n\`${settings.prefix}Loop\`\n\`${settings.prefix}Nowplaying\`\n\`${settings.prefix}Volume [+/-]\`\n\`${settings.prefix}Time\`\n\`${settings.prefix}Clean\`\n\`${settings.prefix}Help\``, true)
      .addField('📋Description', `\`Add a song to the queue.\`\n\`Add a playlist to the queue.\`\n\`Skip the current song\`\n\`Pause the queue\`\n\`Resume the queue\`\n\`Show the entire queue\`\n\`Remove all the songs from the queue\`\n\`Keep looping the song that is now playing\`\n\`Show what song is playing\`\n\`Change the volume with - or +\`\n\`Show the time of the current playing song\`\n\`Delete all the messages from the bot\`\n\`Show this beatifull help command.\``, true)
      .addBlankField(true)
    message.channel.send(embed)
  },

  'pause': async (client, message, settings, args) => {

    //Get the server 
    let server = await getQueue(client, message.guild.id);

    //Check if there is a queue
    if (server.queue[0] === null) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Get the dispatcher
    let dispatcher = message.guild.me.voiceChannel.connection.player.dispatcher;

    //Pause the song
    dispatcher.pause();

    message.channel.send("▶ | Success. I have paused the current song.");

  },

  'resume': async (client, message, settings, args) => {

    //Get the server 
    let server = await getQueue(client, message.guild.id);

    //Check if there is a queue
    if (server.queue[0] === null) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Get the dispatcher
    let dispatcher = message.guild.me.voiceChannel.connection.player.dispatcher;

    //Pause 
    dispatcher.resume();

    message.channel.send("⏸ | Success. I have resumed the current song");
  },

  'skip': async (client, message, settings, args) => {

    //Get the server 
    let server = await getQueue(client, message.guild.id);

    //Check if there is a queue
    if (server.queue[0] === null) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Get the dispatcher
    let dispatcher = message.guild.me.voiceChannel.connection.player.dispatcher;
    if (!dispatcher) return message.channel.send("❌ | Sorry. Nothing is playing at the moment.");

    //Check if the dispatcher is paused.
    if (dispatcher.paused) return message.channel.send("❌ | Sorry. Please resume the current song to skip it.");

    //Turn loop off
    server.loop = 0

    //Pause 
    dispatcher.end();

    message.channel.send("⏩ | Success. I have Skipped the current song");
  },

  'queue': async (client, message, settings, args) => {

    //Get the server 
    let server = await getQueue(client, message.guild.id);

    //Check if there is a queue
    if (server.queue[0] === null) return message.channel.send("❌ | Sorry. There is nothing in the queue.");

    if (server.queue[4]) {
      
          let embed = new RichEmbed()
      .setColor(settings.embedColor)
      .setTitle("Server Queue: " + message.guild.name)
      .setThumbnail(message.guild.iconURL)
      .setDescription(`${server.songNames.map((n, index) => `${index + 1} - ${n}`).join('\n')}\n\n**${server.songNames.length - 4}** others are not being displayed...`)
    message.channel.send(embed);
      
    } else {

    let embed = new RichEmbed()
      .setColor(settings.embedColor)
      .setTitle("Server Queue: " + message.guild.name)
      .setThumbnail(message.guild.iconURL)
      .setDescription(`${server.songNames.map((n, index) => `${index + 1} - ${n}`).join('\n')}`)
    message.channel.send(embed);
    }

  },

  'loop': async (client, message, settings, args) => {

    //Get the servers queue
    let server = await getQueue(client, message.guild.id);

    //Check if there is a queue
    if (server.queue[0] === null) return message.channel.send("❌ | Sorry. There is nothing in the queue.");

    if (server.loop === 0) {

      //Enable the loop
      server.loop = 1

      message.channel.send("🔂 | Success. Loop is now **enabled**.");

    } else if (server.loop === 1) {

      //Disable
      server.loop = 0

      message.channel.send("▶ | Success. Loop is now **disabled**.");

    }
  }

}

//Logging in
var bots = [{
  token: 'NTEzMzA4NDI0MTcyMzM5MjE5.DvJoqw.KSbJPYsi0OAZthpppiwH_Gr33Ek',
  enabled: true
}, {
  token: 'NTEzMzA4NTk3OTE3MDU3MDU0.DvJowA.hIOej3FnM8hcAE24Na2JIdCbj2A',
  enabled: true 
}, {
  token: 'NTEzMzA4NzMxOTg4MTE1NDU3.DvJpAA.lH8smI-Ni3gL1tz5lEElfyYMvbc',
  enabled: true
}, {
  token:'NTEzMzA4OTgyNDAwNTE2MTE2.DvJpDw.ctK6CW2GuwuDj9Wz7q8yuQxcxa0',
  enabled: true 
}, {
  token: 'NDgzODI4NjM3MTc1NjQ0MTYx.DmZJvw.OWcjz-zFqmsmgV-w18CteXrmPAU',
  enabled: false
}, {
  token: 'NDgzODM1MDgwNTI0MDM4MTY1.DmadWg.fPYCnyvjvS_mdE64RNpfFOTmi78',
  enabled: false
}, {
  token: 'NDgzODY3MzE4OTE3NzkxNzQ1.DmadWg.x6VtK8LVwSuR75v3_PUfC5dAuYQ',
  enabled: false
}, {
  token: 'NDgzOTE5OTg3MzY3NjA4MzIw.DmadWg.aDQSCU791wZo6TvZ2LlsnlLPsK4',
  enabled: false
}, {
  token: 'NDgzOTIwMjU2NDExMjM4NDAx.Dmadng.Bi4WVwfFqkMRflzk557ZxAvpg_I',
  enabled: false
}]


bots.forEach((x, index) => {
  if (x.enabled && x.token.length > 0) {

    createBot(x.token, settings.prefix, index)

  }
});
