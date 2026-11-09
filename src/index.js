
import { GladysIntegration, logger } from "@gladysassistant/integration-sdk";
import { createText2SpeakClient } from "./text2speak.js";

const gladys = new GladysIntegration();
const text2speak = createText2SpeakClient();

async function getConfig() {
  const config = (await gladys.getConfig()) || {};

  return {
    base_url: config.base_url,
    timeout_seconds: Number(config.timeout_seconds ?? 5)
  };
}

gladys.onConfigUpdated((config) => {
  logger.info("Configuration Text2Speak mise à jour", {
    base_url: config.base_url || "(non configurée)",
    timeout_seconds: config.timeout_seconds ?? 5
  });
});

gladys.onAction("test_connection", async () => {
  const config = await getConfig();
  const result = await text2speak.testConnection(config);

  const message =
    `${result.pieceCount} pièce(s), ${result.zoneCount} zone(s). ` +
    `Cible(s) par défaut : ${result.defaultTargets.join(", ") || "non définie(s)"}.`;

  logger.info("Test de connexion Text2Speak réussi", result);

  return {
    fr: `Connexion réussie. ${message}`,
    en: `Connection successful. ${message}`
  };
});

gladys.onSceneAction("tts_speak", async (fields) => {
  const config = await getConfig();
  const result = await text2speak.sendMessage(config, fields);

  logger.info("Message envoyé à Text2Speak", {
    job_id: result.job_id,
    queue_position: result.queue_position,
    accepted_targets: result.accepted_targets
  });

  return {
    job_id: result.job_id,
    queue_position: result.queue_position
  };
});

gladys.handleShutdown();

await gladys.connect();
