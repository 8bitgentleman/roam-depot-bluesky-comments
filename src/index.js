import pkg from '../package.json';
import BlueskyLoginPanel from './components/BlueskyLoginPanel';

function getExtensionAPISetting(extensionAPI, key, defaultValue) {
  const value = extensionAPI?.settings?.get(key)
  return value !== null ? value : defaultValue
}

async function onload({extensionAPI}) {
  const panelConfig = {
    tabTitle: "Bluesky Comments",
    settings: [
      {
        id: "graphTokens",
        name: "Bluesky Login",
        action: {
          type: "reactComponent",
          component: BlueskyLoginPanel(extensionAPI)
        }
      }
    ]
  };

  extensionAPI.settings.panel.create(panelConfig);

  console.log(`${pkg.name} version ${pkg.version} loaded`);
}

function onunload() {
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
}

export default {
  onload,
  onunload
};