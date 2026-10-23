import {join} from 'node:path';
import {existsSync} from 'node:fs';
export function dockerBinary(){if(process.env.DOCKER_BIN)return process.env.DOCKER_BIN;const candidate=join(process.env.LOCALAPPDATA||'','Programs','DockerDesktop','resources','bin','docker.exe');return process.platform==='win32'&&existsSync(candidate)?candidate:'docker';}
