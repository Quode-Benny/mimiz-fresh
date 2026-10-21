import {defineConfig} from 'tsup';
import {copyFile,mkdir} from 'node:fs/promises';
export default defineConfig({entry:['src/main.ts'],format:['cjs'],platform:'node',target:'node22',outDir:'dist',clean:true,noExternal:[/^@mimiz\//],async onSuccess(){await mkdir('dist',{recursive:true});await copyFile('src/database/001_initial.sql','dist/001_initial.sql');}});
