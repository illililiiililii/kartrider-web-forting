// SQLite's online snapshot includes committed WAL contents; never copy just
// the live .sqlite file while its -wal file contains recent accounts/progress.
import {DatabaseSync} from 'node:sqlite';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.argv[2]||join(root,'local-data/accounts-4174.sqlite'));
if(!existsSync(source))throw new Error('User database does not exist: '+source);
const target=join(root,'local-data/backups','accounts-4174-'+Date.now()+'.sqlite');
mkdirSync(dirname(target),{recursive:true});
const database=new DatabaseSync(source,{readOnly:true});
try{database.prepare('VACUUM INTO ?').run(target);}finally{database.close();}
console.log('Consistent user database backup: '+target);
