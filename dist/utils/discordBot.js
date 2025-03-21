"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshInviteLink = exports.createProjectChannel = void 0;
// utils/discordBot.ts
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID; // Your server ID
const DISCORD_CATEGORY_ID = process.env.DISCORD_CATEGORY_ID; // Category for project channels
const DISCORD_ADMIN_ROLE_ID = process.env.DISCORD_ADMIN_ROLE_ID; // Admin role ID
if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
    console.error('Discord bot configuration missing. Check your environment variables.');
    process.exit(1);
}
// Create a new client instance
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildInvites,
    ]
});
// Initialize Discord client
let isReady = false;
client.once('ready', () => {
    console.log('Discord bot is ready!');
    isReady = true;
});
// Login to Discord
if (DISCORD_BOT_TOKEN) {
    client.login(DISCORD_BOT_TOKEN).catch(err => {
        console.error('Discord bot login failed:', err);
    });
}
// Create a new Discord channel for a project
const createProjectChannel = async (projectId, projectTitle) => {
    try {
        if (!isReady) {
            console.log('Discord bot is not ready yet. Waiting...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for bot to connect
            if (!isReady) {
                throw new Error('Discord bot is not connected');
            }
        }
        // Get the guild
        const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
        if (!guild) {
            throw new Error('Guild not found');
        }
        // Sanitize project title for channel name (Discord channel names must be lowercase, no spaces)
        const channelName = `project-${projectId.substring(0, 8)}-${projectTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)}`;
        // Check if channel already exists
        const existingChannel = guild.channels.cache.find(ch => ch.name === channelName && ch.type === discord_js_1.ChannelType.GuildText);
        let channel;
        if (existingChannel) {
            console.log(`Channel ${channelName} already exists, using existing channel`);
            channel = existingChannel;
        }
        else {
            // Create channel with simplified permission structure
            channel = await guild.channels.create({
                name: channelName,
                type: discord_js_1.ChannelType.GuildText,
                parent: DISCORD_CATEGORY_ID, // Optional: Place in a category
                topic: `Collaboration channel for project: ${projectTitle} (ID: ${projectId})`,
                // Set initial permissions - SIMPLIFIED VERSION
                permissionOverwrites: [
                    // By default, @everyone can't see the channel
                    {
                        id: guild.roles.everyone.id,
                        deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
                        type: discord_js_1.OverwriteType.Role
                    },
                    // Bot needs all permissions to manage the channel
                    {
                        id: client.user?.id || '',
                        allow: [
                            discord_js_1.PermissionFlagsBits.ViewChannel,
                            discord_js_1.PermissionFlagsBits.SendMessages,
                            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                            discord_js_1.PermissionFlagsBits.ManageChannels,
                            discord_js_1.PermissionFlagsBits.ManageMessages,
                            discord_js_1.PermissionFlagsBits.CreateInstantInvite
                        ],
                        type: discord_js_1.OverwriteType.Member
                    }
                ]
            });
            // Send welcome message
            await channel.send({
                content: `# Welcome to the ${projectTitle} Project Channel!

This is a private channel for collaborators on the ${projectTitle} project. 

**Important Information:**
- This channel is private and only visible to invited project members
- All team members can send messages and read history in this channel
- Please be respectful and follow project communication guidelines

Happy collaborating! 🚀`
            });
            console.log(`Created new private channel: ${channel.name}`);
        }
        // Delete existing invites for this channel to avoid clutter
        const existingInvites = await channel.fetchInvites();
        await Promise.all(existingInvites.map(invite => invite.delete('Creating fresh permanent invite')));
        // Create an invite link that doesn't expire, has unlimited uses, and GRANTS the right permissions
        const invite = await channel.createInvite({
            maxAge: 0, // 0 = never expires
            maxUses: 0, // 0 = unlimited uses
            unique: true,
            temporary: false, // IMPORTANT: This must be false so permissions remain after disconnect
            reason: `Project collaboration channel for ${projectTitle}`
        });
        console.log(`Created invite link: https://discord.gg/${invite.code}`);
        // Return channel ID and invite link
        return {
            channelId: channel.id,
            inviteLink: `https://discord.gg/${invite.code}`
        };
    }
    catch (error) {
        console.error('Error creating Discord channel:', error);
        return null;
    }
};
exports.createProjectChannel = createProjectChannel;
// Get a new invite link for an existing channel
const refreshInviteLink = async (channelId, projectTitle) => {
    try {
        if (!isReady) {
            throw new Error('Discord bot is not connected');
        }
        const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
        if (!guild) {
            throw new Error('Guild not found');
        }
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }
        // Delete existing invites for this channel
        const existingInvites = await channel.fetchInvites();
        await Promise.all(existingInvites.map(invite => invite.delete('Creating fresh permanent invite')));
        // Create a new invite that doesn't expire
        // Remove problematic targetType parameter
        const invite = await channel.createInvite({
            maxAge: 0, // 0 = never expires
            maxUses: 0, // 0 = unlimited uses
            unique: true,
            temporary: false, // Don't kick after disconnect
            reason: `Refreshed invite for project: ${projectTitle}`
        });
        console.log(`Refreshed invite link: https://discord.gg/${invite.code}`);
        return `https://discord.gg/${invite.code}`;
    }
    catch (error) {
        console.error('Error refreshing invite link:', error);
        return null;
    }
};
exports.refreshInviteLink = refreshInviteLink;
exports.default = client;
