const test=require('node:test');
const assert=require('node:assert/strict');
const createSidebar=require('../公路之王/src/sidebar');

test('sidebar checks availability and navigates only after explicit user action',()=>{
 let calls=0,request;
 const sidebar=createSidebar({checkScene(o){assert.equal(o.scene,'sidebar');o.success({isExist:true});},navigateToScene(o){calls++;request=o;}});
 assert.equal(sidebar.state.supported,true);assert.equal(calls,0);
 let result;sidebar.open(message=>result=message);sidebar.open();
 assert.equal(calls,1);assert.equal(request.scene,'sidebar');assert.equal(sidebar.state.busy,true);
 request.success({});assert.equal(result,'');assert.equal(sidebar.state.busy,false);
 assert.equal(sidebar.state.fromSidebar,false,'navigation alone is not a return visit');
});
test('unsupported, failed and absent sidebar APIs hide entry without crashing',()=>{
 for(const api of [{},{checkScene(){throw Error('unsupported')},navigateToScene(){}},{checkScene(o){o.fail({})},navigateToScene(){}},{checkScene(o){o.success({isExist:false})},navigateToScene(){}}]){
  const sidebar=createSidebar(api);assert.equal(sidebar.state.supported,false);
  let message;sidebar.open(value=>message=value);assert.ok(message);
 }
});
test('sidebar failure and exceptions clear pending state and allow retry',()=>{
 for(const navigateToScene of [o=>o.fail({errMsg:'fail'}),()=>{throw Error('fail')}]){
  const sidebar=createSidebar({checkScene:o=>o.success({isExist:true}),navigateToScene});
  let message;sidebar.open(value=>message=value);assert.ok(message);assert.equal(sidebar.state.busy,false);
  sidebar.open(value=>message=value);assert.ok(message);
 }
});
test('latest onShow replaces cold launch source including non-sidebar re-entry',()=>{
 const sidebar=createSidebar({getLaunchOptionsSync:()=>({launch_from:'homepage',location:'sidebar_card'})});
 assert.equal(sidebar.state.fromSidebar,true);
 sidebar.onShow({launch_from:'other',location:'sidebar_card'});assert.equal(sidebar.state.fromSidebar,false);
 sidebar.onShow({launch_from:'homepage',location:'sidebar_card'});assert.equal(sidebar.state.fromSidebar,true);
 sidebar.onShow();assert.equal(sidebar.state.fromSidebar,false);
});
