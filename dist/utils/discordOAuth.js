"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscordAuthUrl = exports.linkDiscordAccount = exports.addUserToChannel = void 0;
// utils/discordOAuth.ts
const axios_1 = __importDefault(require("axios"));
const userModel_1 = __importDefault(require("../models/userModel"));
const discordBot_1 = __importDefault(require("./discordBot"));
// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
/**
 * Add a user to a Discord channel using their Discord ID
 */
const addUserToChannel = async (discordUserId, channelId) => {
    try {
        console.log(`Adding Discord user ${discordUserId} to channel ${channelId}`);
        // Fetch the channel
        const channel = await discordBot_1.default.channels.fetch(channelId);
        if (!channel) {
            console.error(`Channel not found: ${channelId}`);
            return false;
        }
        const guild = channel.guild;
        // Check if user is in the guild
        let member;
        try {
            member = await guild.members.fetch(discordUserId);
        }
        catch (error) {
            console.log(`User ${discordUserId} is not in the guild, inviting them...`);
            // Create an invite to the guild if the user isn't a member
            const invite = await guild.invites.create(channel, {
                maxUses: 1,
                unique: true,
                reason: `Inviting user ${discordUserId} to join for channel access`
            });
            console.log(`Created guild invite: ${invite.url}`);
            return false; // We need the user to join the guild first
        }
        // Add permission overwrite for this user
        await channel.permissionOverwrites.create(member, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });
        console.log(`Successfully added user ${discordUserId} to channel ${channelId}`);
        return true;
    }
    catch (error) {
        console.error('Error adding user to channel:', error);
        return false;
    }
};
exports.addUserToChannel = addUserToChannel;
/**
 * Link a user's platform account with their Discord account
 */
const linkDiscordAccount = async (userId, discordCode) => {
    try {
        console.log(`Linking Discord account for user ${userId} with code ${discordCode.substring(0, 10)}...`);
        // Exchange the authorization code for an access token
        const tokenResponse = await axios_1.default.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: discordCode,
            redirect_uri: DISCORD_REDIRECT_URI
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const { access_token } = tokenResponse.data;
        // Get the user's Discord information
        const userResponse = await axios_1.default.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`
            }
        });
        const { id: discordId, username } = userResponse.data;
        console.log(`Got Discord user info: ${username} (${discordId})`);
        // Update your user model to store the Discord ID
        await userModel_1.default.findByIdAndUpdate(userId, {
            discordId,
            discordUsername: username
        });
        console.log(`Successfully linked Discord account for user ${userId}`);
        return { discordId, username };
    }
    catch (error) {
        console.error('Error linking Discord account:', error);
        return null;
    }
};
exports.linkDiscordAccount = linkDiscordAccount;
/**
 * Get an invite URL for the Discord OAuth flow
 */
const getDiscordAuthUrl = (projectId, state) => {
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.append('client_id', DISCORD_CLIENT_ID);
    url.searchParams.append('redirect_uri', DISCORD_REDIRECT_URI);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', 'identify');
    url.searchParams.append('state', state); // State includes projectId and other info
    return url.toString();
};
exports.getDiscordAuthUrl = getDiscordAuthUrl;
