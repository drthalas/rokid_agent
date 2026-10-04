import {compareAixBuildInfo} from './build-info.mjs';

const [localAix, activeAix, nativeVersion] = process.argv.slice(2);
if (!localAix || !activeAix || !nativeVersion) throw new Error('Usage: node tools/verify-active-build.mjs LOCAL_AIX DOWNLOADED_ACTIVE_AIX NATIVE_VERSION');
console.log(JSON.stringify(compareAixBuildInfo(localAix,activeAix,nativeVersion)));
