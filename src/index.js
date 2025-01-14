// src/index.js
import pkg from '../package.json';
import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import getUidsFromButton from "roamjs-components/dom/getUidsFromButton";
import BlueskyLoginPanel from './components/BlueskyLoginPanel';
import BlueskyPost from './components/BlueskyPost'; 
import { createComponentRender } from "roamjs-components/components/ComponentContainer";
import getBlockUidFromTarget from 'roamjs-components/dom/getBlockUidFromTarget';

// Store observers globally for cleanup
var runners = {
    observers: [],
};

function getExtensionAPISetting(extensionAPI, key, defaultValue) {
  const value = extensionAPI?.settings?.get(key)
  return value !== null ? value : defaultValue
}

const getBlockContent = (uid) => {
  const result = window.roamAlphaAPI.data.pull("[:block/string]", [":block/uid", uid]);
  return result?.[":block/string"] || "";
};

const renderBlueskyPost = (button, extensionAPI) => {
  // Stop event propagation
  button.parentElement.onmousedown = (e) => e.stopPropagation();

  const { blockUid } = getUidsFromButton(button);
  const blockContent = getBlockContent(blockUid);
  const url = blockContent.match(/{{bluesky:(.*?)}}/)?.[1];

  if (!url) {
    console.error("No URL found in block content:", blockContent);
    return;
  }

  // Create wrapper div to mount React component
  const wrapper = document.createElement("div");
  button.parentElement?.insertBefore(wrapper, button.nextSibling);

  // Render React component with extensionAPI
  ReactDOM.render(<BlueskyPost url={url} extensionAPI={extensionAPI} />, wrapper);

  // Hide original button
  button.style.display = "none";
};

async function onload({extensionAPI}) {
  // Create settings panel
  const panelConfig = {
    tabTitle: "Bluesky Comments",
    settings: [
      {
        id: "blueskyCredentials",
        name: "Bluesky Login",
        action: {
          type: "reactComponent",
          component: BlueskyLoginPanel(extensionAPI)
        }
      }
    ]
  };
  extensionAPI.settings.panel.create(panelConfig);

  // Setup button observer and store it
  const observer = createButtonObserver({
    attribute: "bluesky",
    render: (b) => renderBlueskyPost(b, extensionAPI),
  });
  runners.observers.push(observer);

  console.log(`${pkg.name} version ${pkg.version} loaded`);
}

function onunload() {
  // Disconnect all observers
  runners.observers.forEach(obs => obs.disconnect());
  console.log(`${pkg.name} version ${pkg.version} unloaded`);
}

export default {
  onload,
  onunload
};