import fs from 'node:fs';
import crypto from 'node:crypto';
const {expo}=JSON.parse(fs.readFileSync('app.json','utf8'));
const config=structuredClone(expo);
delete config.version;
if(config.android) delete config.android.versionCode;
if(config.ios) delete config.ios.buildNumber;
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const fingerprint=crypto.createHash('sha256').update(JSON.stringify({ config, dependencies:pkg.dependencies, lock:fs.readFileSync('package-lock.json','utf8') })).digest('hex');
const path='.native-baseline.json';
if(process.argv.includes('--record')) {
  fs.writeFileSync(path,JSON.stringify({runtimeVersion:'1.0.1',fingerprint,channel:'production-1.0.1'},null,2)+'\n');
} else {
  if(!fs.existsSync(path)) throw new Error('No APK baseline. Compile a new APK before publishing updates.');
  if(JSON.parse(fs.readFileSync(path,'utf8')).fingerprint!==fingerprint) throw new Error('Native dependencies, assets configuration or Expo configuration changed. Use [build-apk] to compile before publishing OTA. Runtime stays 1.0.1.');
  console.log('Native configuration matches the compiled APK.');
}
