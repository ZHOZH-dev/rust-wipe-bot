import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { calculateNextWipe, shouldShowLastWipe } from "../services/wipeSchedule.js";
import { formatDuration } from "../utils/formatDuration.js";

const EMBED_COLOR = 0xce422b;
const NETWORK_FIELD_LIMIT = 25;

export function buildWipeCommandData(networks) {
  return new SlashCommandBuilder()
    .setName("wipe")
    .setDescription("Информация о вайпах серверов")
    .addStringOption((option) =>
      option
        .setName("network")
        .setDescription("Показать серверы одной сети")
        .addChoices(...networks.map((network) => ({ name: capitalize(network), value: network })))
    )
    .addStringOption((option) =>
      option.setName("server").setDescription("Название сервера").setAutocomplete(true)
    )
    .toJSON();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function handleWipeAutocomplete(interaction, registry) {
  const focused = interaction.options.getFocused();
  const matches = registry.autocomplete(focused);
  await interaction.respond(
    matches.map((entry) => ({ name: entry.label.slice(0, 100), value: String(entry.id) }))
  );
}

export async function executeWipe(interaction, dependencies) {
  await interaction.deferReply();
  const now = Date.now();
  const serverId = interaction.options.getString("server");
  const network = interaction.options.getString("network");
  if (serverId) {
    await replySingleServer(interaction, dependencies, Number(serverId), now);
    return;
  }
  if (network) {
    await replyNetwork(interaction, dependencies, network.toLowerCase(), now);
    return;
  }
  await replyOverview(interaction, dependencies, now);
}

async function replySingleServer(interaction, dependencies, serverId, now) {
  const entry = dependencies.registry.byId.get(serverId);
  if (!entry) {
    await interaction.editReply({ content: "Сервер не найден. Выберите название из подсказки." });
    return;
  }
  const liveServers = await fetchLiveServers(dependencies, entry.network);
  const live = liveServers.find((server) => server.id === serverId) ?? null;
  const embed = buildSingleServerEmbed(entry, live, dependencies.timezone, dependencies.thresholdHours, now);
  await interaction.editReply({ embeds: [embed] });
}

async function replyNetwork(interaction, dependencies, network, now) {
  const entries = dependencies.registry.byNetwork(network);
  if (entries.length === 0) {
    await interaction.editReply({ content: "Сеть серверов не найдена." });
    return;
  }
  const liveServers = await fetchLiveServers(dependencies, network);
  const fields = buildNetworkFields(entries, liveServers, dependencies.timezone, dependencies.thresholdHours, now);
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(capitalize(network))
    .addFields(fields);
  await interaction.editReply({ embeds: [embed] });
}

async function replyOverview(interaction, dependencies, now) {
  const summaries = await Promise.all(
    dependencies.registry.networks().map(async (network) => ({
      network,
      entries: dependencies.registry.byNetwork(network),
      liveServers: await fetchLiveServers(dependencies, network),
    }))
  );
  const embed = buildOverviewEmbed(summaries, dependencies.timezone, dependencies.thresholdHours, now);
  await interaction.editReply({ embeds: [embed] });
}

async function fetchLiveServers(dependencies, network) {
  try {
    return await dependencies.battlemetricsClient.searchServers(network);
  } catch (error) {
    console.error(`[wipe] failed to load live data for network "${network}"`, error);
    return [];
  }
}

export function buildOverviewEmbed(summaries, timezone, thresholdHours, now) {
  const fields = summaries.map(({ network, entries, liveServers }) =>
    buildOverviewField(network, entries, liveServers, timezone, thresholdHours, now)
  );
  return new EmbedBuilder().setColor(EMBED_COLOR).setTitle("Вайпы по сетям").addFields(fields);
}

export function buildOverviewField(
  network,
  entries,
  liveServers,
  timezone,
  thresholdHours,
  now
) {
  const lines = [];
  const earliest = earliestNextWipeEntry(entries, timezone, now);
  if (earliest) {
    lines.push(formatNextWipe(earliest.date, now));
    lines.push(earliest.entry.label.slice(0, 256));
    const live = liveServers.find((server) => server.id === earliest.entry.id);
    if (live?.address) {
      lines.push(codeBlockConnectLine(live.address));
    }
  } else {
    lines.push("Ближайший вайп: расписание неизвестно");
  }
  const recentLine = lastWipeLine(mostRecentLastWipe(liveServers), thresholdHours, now);
  if (recentLine) {
    lines.push(recentLine);
  }
  lines.push(`Серверов: ${entries.length}`);
  return { name: capitalize(network), value: lines.join("\n") };
}

function earliestNextWipeEntry(entries, timezone, now) {
  let earliest = null;
  for (const entry of entries) {
    if (!entry.schedule) {
      continue;
    }
    const next = calculateNextWipe(entry.schedule, timezone, now);
    if (next.isPast) {
      continue;
    }
    if (!earliest || next.date < earliest.date) {
      earliest = { entry, date: next.date };
    }
  }
  return earliest;
}

function mostRecentLastWipe(liveServers) {
  let latest = null;
  for (const server of liveServers) {
    if (!server.lastWipe) {
      continue;
    }
    if (!latest || server.lastWipe > latest) {
      latest = server.lastWipe;
    }
  }
  return latest;
}

function formatNextWipe(date, now) {
  const unix = toUnixSeconds(date);
  return `Ближайший вайп: через ${formatDuration(date.getTime() - now)} — <t:${unix}:F> (<t:${unix}:R>)`;
}

export function buildNetworkFields(entries, liveServers, timezone, thresholdHours, now) {
  const liveById = new Map(liveServers.map((server) => [server.id, server]));
  const ranked = entries
    .map((entry) => ({ entry, players: liveById.get(entry.id)?.players ?? -1 }))
    .sort((a, b) => b.players - a.players)
    .slice(0, NETWORK_FIELD_LIMIT);
  return ranked.map(({ entry }) => ({
    name: entry.label.slice(0, 256),
    value: buildServerValue(entry, liveById.get(entry.id) ?? null, timezone, thresholdHours, now),
  }));
}

function buildServerValue(entry, live, timezone, thresholdHours, now) {
  const lines = [nextWipeLine(entry.schedule, timezone, now)];
  const sinceLine = lastWipeLine(live?.lastWipe ?? null, thresholdHours, now);
  if (sinceLine) {
    lines.push(sinceLine);
  }
  if (live?.address) {
    lines.push(codeBlockConnectLine(live.address));
  }
  return lines.join("\n");
}

function nextWipeLine(schedule, timezone, now) {
  if (!schedule) {
    return "Следующий вайп: расписание неизвестно";
  }
  const next = calculateNextWipe(schedule, timezone, now);
  if (next.isPast) {
    return "Следующий вайп: дата по расписанию уже прошла";
  }
  const unix = toUnixSeconds(next.date);
  return `Следующий вайп: через ${formatDuration(next.date.getTime() - now)} — <t:${unix}:F> (<t:${unix}:R>)`;
}

function codeBlockConnectLine(address) {
  return `\`\`\`connect ${address}\`\`\``;
}

function lastWipeLine(lastWipe, thresholdHours, now) {
  if (!shouldShowLastWipe(lastWipe, now, thresholdHours)) {
    return null;
  }
  const unix = toUnixSeconds(lastWipe);
  return `С последнего вайпа прошло: ${formatDuration(now - lastWipe.getTime())} — <t:${unix}:F> (<t:${unix}:R>)`;
}

export function buildSingleServerEmbed(entry, live, timezone, thresholdHours, now) {
  const embed = new EmbedBuilder().setColor(EMBED_COLOR).setTitle(entry.label.slice(0, 256));
  embed.addFields({ name: "Следующий вайп", value: nextWipeLine(entry.schedule, timezone, now) });
  const sinceLine = lastWipeLine(live?.lastWipe ?? null, thresholdHours, now);
  if (sinceLine) {
    embed.addFields({ name: "Последний вайп", value: sinceLine });
  }
  if (live?.address) {
    embed.addFields({ name: "Подключение", value: codeBlockConnectLine(live.address) });
  }
  if (live) {
    const players = live.players != null ? `${live.players}/${live.maxPlayers ?? "?"}` : "н/д";
    const map = live.map ? ` — ${live.map}` : "";
    embed.addFields({ name: "Онлайн", value: `${players}${map}`.slice(0, 1024) });
  }
  return embed;
}

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}
