'use strict';

// Keep the native tt call explicit for Douyin's upload capability detection.
module.exports=function createSidebar(tt){
  const state={supported:false,fromSidebar:false,busy:false};
  function onShow(options={}){
    state.fromSidebar=options.launch_from==='homepage'&&options.location==='sidebar_card';
    state.busy=false;
  }
  try{if(tt.getLaunchOptionsSync)onShow(tt.getLaunchOptionsSync()||{});}catch(_){}
  if(typeof tt.checkScene==='function'&&typeof tt.navigateToScene==='function'){
    try{tt.checkScene({scene:'sidebar',success:r=>{state.supported=!!r.isExist;},fail:()=>{state.supported=false;}});}catch(_){}
  }
  return{
    state,onShow,
    open(done=()=>{}){
      if(state.busy)return;
      if(!state.supported){done('当前环境暂不支持侧边栏');return;}
      state.busy=true;
      const finish=message=>{state.busy=false;done(message);};
      try{
        tt.navigateToScene({scene:'sidebar',success:()=>finish(''),fail:()=>finish('暂时无法打开侧边栏，请稍后重试')});
      }catch(_){finish('暂时无法打开侧边栏，请稍后重试');}
    }
  };
};
