// src/index.js
import pkg from '../package.json';
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import BlueskyLoginPanel from './components/BlueskyLoginPanel';
import BlueskyPost from './components/BlueskyPost'; 

function getExtensionAPISetting(extensionAPI, key, defaultValue) {
  const value = extensionAPI?.settings?.get(key)
  return value !== null ? value : defaultValue
}

const getBlockContent = (uid) => {
  const result = window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uid]);
  return result?.[":block/string"] || "";
};

const renderBlueskyPost = (button) => {
  const { blockUid } = getUidsFromButton(button);
  const blockContent = getBlockContent(blockUid);
  console.log("Block content:", blockContent);

  // Extract URL from block content
  // Expected format: {{bluesky:URL}}
  const url = blockContent.match(/{{bluesky:(.*?)}}/)?.[1];
  console.log("Extracted URL:", url);

  if (!url) {
    console.error("No URL found in block content:", blockContent);
    return;
  }

  // Create wrapper div to mount React component
  const wrapper = document.createElement("div");
  button.parentElement?.insertBefore(wrapper, button.nextSibling);

  // Render React component
  ReactDOM.render(<BlueskyPost url={url} />, wrapper);

  // Hide original button
  button.style.display = "none";
};

async function onload({extensionAPI}) {
  // Create settings panel
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

  // Setup button observer
  const observer = createButtonObserver({
    attribute: "bluesky",
    render: renderBlueskyPost,
  });

  console.log(`${pkg.name} version ${pkg.version} loaded`);
  
  return () => observer.disconnect();
}

function onunload() {
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
}

export default {
  onload,
  onunload
};