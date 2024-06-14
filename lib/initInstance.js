/*
 This program and the accompanying materials are
 made available under the terms of the Eclipse Public License v2.0 which accompanies
 this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

 SPDX-License-Identifier: EPL-2.0

 Copyright Contributors to the Zowe Project.
*/

const fs = require('fs');
const path = require('path');
const argParser = require('../../zlux-server-framework/utils/argumentParser');
const mergeUtils = require('../../zlux-server-framework/utils/mergeUtils');
const yamlConfig = require('../../zlux-server-framework/utils/yamlConfig');
const initUtils = require('./initUtils');
const os = require('os');
const ncp = require('ncp').ncp;
const { execSync } = require('child_process');
const mkdirp = require('mkdirp');


const haInstanceId = yamlConfig.getCurrentHaInstanceId();
let config = {};
if (process.env.CONFIG_FILE) {
  config = yamlConfig.parseZoweDotYaml(process.env.CONFIG_FILE, haInstanceId);
}

const envConfig = argParser.environmentVarsToObject("ZWED_");
if (Object.keys(envConfig).length > 0) {
  config = mergeUtils.deepAssign(config, envConfig);
}

const workspaceLocation = config.zowe && config.zowe.workspaceDirectory
  ? config.zowe.workspaceDirectory
  : process.env.ZWE_zowe_workspaceDirectory;
const destination = path.join(workspaceLocation, 'app-server');

config.productDir = path.join(__dirname, '..', 'defaults');

//Begin generate any missing folders
mkdirp.sync(destination, {mode: initUtils.FOLDER_MODE});

if (!config.siteDir) {
  config.siteDir = path.join(destination, 'site');
}
const sitePluginStorage = path.join(config.siteDir, 'ZLUX', 'pluginStorage');
mkdirp.sync(sitePluginStorage, {mode: initUtils.FOLDER_MODE});

if (!config.instanceDir) {
  config.instanceDir = destination;
}
const instancePluginStorage = path.join(config.instanceDir, 'ZLUX', 'pluginStorage');
mkdirp.sync(instancePluginStorage, {mode: initUtils.FOLDER_MODE});
const recognizersPluginStorage = path.join(config.instanceDir, 'ZLUX/pluginStorage', 'org.zowe.zlux.ng2desktop/recognizers');
mkdirp.sync(recognizersPluginStorage, {mode: initUtils.FOLDER_MODE});
const actionsPluginStorage = path.join(config.instanceDir, 'ZLUX/pluginStorage/org.zowe.zlux.ng2desktop', 'actions');
mkdirp.sync(actionsPluginStorage, {mode: initUtils.FOLDER_MODE});

const instanceConfig = path.join(config.instanceDir, 'serverConfig');
//750 specifically, to keep server config secure
mkdirp.sync(instanceConfig, {mode: 0o0750});

if (!config.groupsDir) {
  config.groupsDir = path.join(config.instanceDir, 'groups');
}
mkdirp.sync(config.groupsDir, {mode: initUtils.FOLDER_MODE});

if (!config.usersDir) {
  config.usersDir = path.join(config.instanceDir, 'users');
}
mkdirp.sync(config.usersDir, {mode: initUtils.FOLDER_MODE});

if (!config.pluginsDir) {
  config.pluginsDir = path.join(destination, 'plugins');
}

mkdirp.sync(config.pluginsDir, {mode: initUtils.FOLDER_MODE});


function getPluginJsonNames() {
  try {
    return fs.readdirSync(config.pluginsDir);
  } catch (e) {
    console.warn("ZWED5003W - Warning: couldn't read plugin directory",e);
  }
  return [];
}

let instanceItems = getPluginJsonNames();
//Copy default plugins if could not find zlux-server - implies something wrong with environment.
if (instanceItems.indexOf('org.zowe.zlux.json') == -1) {
  initUtils.registerBundledPlugins(config.pluginsDir, instancePluginStorage, instanceItems, initUtils.FILE_MODE);
  instanceItems = getPluginJsonNames();
  if (instanceItems.indexOf('org.zowe.zlux.json') == -1) {
    console.warn('ZWED0156E - Could not register default plugins into app-server');
    process.exit(1);
  }
}

initUtils.setTerminalDefaults(instancePluginStorage, instanceItems);
  
let siteStorage = [];
let instanceStorage = [];
try {
  siteStorage = fs.readdirSync(sitePluginStorage);
  instanceStorage = fs.readdirSync(instancePluginStorage);
} catch (e) {
  console.warn("ZWED5004W - Warning: couldn't read site or instance storage",e);
  //couldnt read, treat as empty
}
if (siteStorage.length == 0 && instanceStorage.length == 0) {
  console.log("ZWED5012I - Copying default plugin preferences into instance");
  if (os.platform() == 'win32') {
    ncp(path.join(config.productDir, 'ZLUX', 'pluginStorage'), instancePluginStorage, function(err){
      if (err) {
        console.warn('ZWED5005W - Warning: error while copying plugin preferences into instance',err);
        process.exit(1);
      }
      process.exit(0);
    });
  } else {
    execSync("cp -r "+path.join(config.productDir, 'ZLUX', 'pluginStorage')+" "+path.join(config.instanceDir, 'ZLUX'));
    execSync("chmod -R 770 "+instancePluginStorage);
    process.exit(0);
  }
}
