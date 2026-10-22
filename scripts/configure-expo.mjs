import fs from 'node:fs';
const file = JSON.parse(fs.readFileSync('app.json','utf8'));
const id = file.expo.extra?.eas?.projectId;
if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Link the Expo project using eas init first.');
file.expo.runtimeVersion = '1.0.1';
file.expo.updates = { url: `https://u.expo.dev/${id}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0, requestHeaders: { 'expo-channel-name': 'production-1.0.1' } };
fs.writeFileSync('app.json',JSON.stringify(file,null,2)+'\n');
console.log(`Linked updates to Expo project ${id}; runtime 1.0.1`);
