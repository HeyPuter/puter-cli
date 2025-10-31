import Conf from "conf";
import { PROJECT_NAME } from "../commons.js";
import { puter } from "@heyputer/puter.js";

const config = new Conf({ projectName: PROJECT_NAME });

let puterModule;

export const initPuterModule = () => {
  const uuid = config.get("selected_profile");
  const profiles = config.get("profiles") ?? [];
  const profile = profiles.find((v) => v.uuid === uuid);
  const authToken = profile?.token;

  puter.setAuthToken(authToken);
  puterModule = puter;
};

/**
 * Get Puter object
 * @returns {puter} puter - Puter Object.
 */
export const getPuter = () => {
  if (!puterModule) {
    throw new Error("Call initPuterModule() first");
  }
  return puterModule;
};
