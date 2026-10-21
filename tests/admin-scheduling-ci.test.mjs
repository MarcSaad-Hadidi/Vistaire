import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
test('scheduling database runner refuses unapproved or nonlocal targets before invoking psql',()=>{
 const base={...process.env,PATH:'/nonexistent',CI:'false',VISTAIRE_ADMIN_SCHEDULING_POSTGRES_TEST:'',PGHOST:'127.0.0.1',PGDATABASE:'vistaire_scheduling_ci',PGSERVICE:'',PGSERVICEFILE:'',PGHOSTADDR:''};
 const run=(env)=>spawnSync(process.execPath,['scripts/run-admin-scheduling-postgres-tests.mjs'],{env:{...base,...env},encoding:'utf8'});
 assert.match(run({}).stderr,/Refusing/);
 assert.match(run({CI:'true',PGHOST:'production.invalid'}).stderr,/local/);
 assert.match(run({CI:'true',PGDATABASE:'production'}).stderr,/dedicated/);
 assert.match(run({CI:'true',PGDATABASE:'host=production.invalid dbname=vistaire_test'}).stderr,/dedicated/);
 assert.match(run({CI:'true',PGSERVICE:'remote'}).stderr,/service override/);
 const workflow=readFileSync('.github/workflows/app-ci.yml','utf8');
 assert.match(workflow,/createdb vistaire_scheduling_ci/);
 assert.match(workflow,/PGDATABASE=vistaire_scheduling_ci node scripts\/run-admin-scheduling-postgres-tests.mjs/);
});
