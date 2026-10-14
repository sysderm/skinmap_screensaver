"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const script=html.split('<script>')[1].split('</script>')[0].split('document.addEventListener("visibilitychange"')[0];
(async()=>{
  for(const response of [{type:'opaqueredirect',status:0},{type:'basic',status:401},{type:'basic',status:403}]){
    let redirected=null,options=null;
    const context=vm.createContext({location:{href:'https://sm2.navarini.com/',search:'',replace:url=>{redirected=url}},URLSearchParams,URL,AbortController,AbortSignal,setTimeout,clearTimeout,
      fetch:async(url,opts)=>{options=opts;return response}});
    vm.runInContext(script,context);
    vm.runInContext(`meineAnsicht='meta';aktuellerPlatz=123;angezeigt={eintrag:{id:'r1'},index:1};`,context);
    await vm.runInContext('syncTraining()',context);
    assert.equal(redirected,'https://auth.navarini.com/login?rd=https%3A%2F%2Fsm2.navarini.com%2F');
    assert.equal(options.redirect,'manual');assert.equal(options.credentials,'same-origin');
    assert.equal(vm.runInContext('trainingRevealAt',context),null);
    assert.equal(vm.runInContext('trainingBusy',context),false);
  }
  console.log('Training-Auth: Login-Umleitung und 401/403 führen zur Anmeldung; Diagnose wird nicht vorzeitig freigegeben.');
})().catch(e=>{console.error(e);process.exitCode=1});
