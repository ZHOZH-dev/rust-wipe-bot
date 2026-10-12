import "dotenv/config";
import { REST, Routes } from "discord.js";
import { buildWipeCommandData } from "./commands/wipe.js";
import { loadServerRegistry } from "./services/serverRegistry.js";

async function main() {
  const token = process.env.DISCORD_TOKEN?.trim();
  const clientId = process.env.CLIENT_ID?.trim();
  const guildId = process.env.GUILD_ID?.trim();
  if (!token) {
    throw new Error("Missing required environment variable DISCORD_TOKEN");
  }
  if (!clientId) {
    throw new Error("Missing required environment variable CLIENT_ID");
  }
  const registry = await loadServerRegistry();
  const commands = [buildWipeCommandData(registry.networks())];
  const rest = new REST().setToken(token);
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(
      `[deploy] registered ${commands.length} command(s) for guild ${guildId} with ${registry.networks().length} network choice(s)`
    );
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(
      `[deploy] registered ${commands.length} command(s) globally with ${registry.networks().length} network choice(s)`
    );
  }
}

main().catch((error) => {
  console.error("[deploy] failed to register slash commands", error);
  process.exitCode = 1;
});
