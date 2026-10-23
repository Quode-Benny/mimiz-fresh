import {defineConfig} from 'tsup';
import {copyFile,mkdir} from 'node:fs/promises';
export default defineConfig({entry:['src/main.ts'],format:['cjs'],platform:'node',target:'node22',outDir:'dist',clean:true,noExternal:[/^@mimiz\//],async onSuccess(){await mkdir('dist',{recursive:true});for(const name of ['001_initial','002_operations','003_workspace_security','004_notifications','005_chat','006_staff_security','007_company_settings','008_photo_deletions','009_assistant','010_delivery_chat'])await copyFile('src/database/'+name+'.sql','dist/'+name+'.sql');}});
