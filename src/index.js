import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { loadConfig } from "./config.js";
import { createBattleMetricsClient } from "./services/battlemetrics.js";
import { loadServerRegistry } from "./services/serverRegistry.js";
import { executeWipe, handleWipeAutocomplete } from "./commands/wipe.js";

const config = loadConfig();
const registry = await loadServerRegistry();
const battlemetricsClient = createBattleMetricsClient({ apiKey: config.apiKey });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(
    `[bot] logged in as ${readyClient.user.tag}, monitoring ${registry.servers.length} server(s) in ${registry.networks().length} network(s)`
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName !== "wipe") {
      return;
    }
    try {
      await handleWipeAutocomplete(interaction, registry);
    } catch (error) {
      console.error('[bot] autocomplete for "wipe" failed', error);
      try {
        await interaction.respond([]);
      } catch {
        console.error("[bot] failed to respond to autocomplete");
      }
    }
    return;
  }
  if (!interaction.isChatInputCommand() || interaction.commandName !== "wipe") {
    return;
  }
  try {
    await executeWipe(interaction, {
      battlemetricsClient,
      registry,
      timezone: config.timezone,
      thresholdHours: config.thresholdHours,
    });
  } catch (error) {
    console.error('[bot] command "wipe" failed', error);
    await replyWithError(interaction);
  }
});

async function replyWithError(interaction) {
  const content = "Не удалось получить информацию о вайпе. Попробуйте позже.";
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (replyError) {
    console.error("[bot] failed to send error reply", replyError);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[bot] unhandled rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[bot] uncaught exception", error);
});

client.login(config.discordToken);
