'use strict';
const video=document.getElementById('brand-film');
const play=document.getElementById('play-film');
const videoStatus=document.getElementById('video-status');
play.hidden=false;
play.addEventListener('click',async()=>{
  play.hidden=true;
  videoStatus.textContent='';
  try{await video.play()}catch{
    videoStatus.textContent='The film could not start. Use the video controls to try again.';
    video.controls=true;
  }
});
video.addEventListener('play',()=>{play.hidden=true;videoStatus.textContent=''});
video.addEventListener('error',()=>{
  play.hidden=true;
  videoStatus.replaceChildren(document.createTextNode('The film is temporarily unavailable. '));
  const link=document.createElement('a');link.href='/media/creator-rewards.mp4';link.textContent='Download the video';
  videoStatus.append(link);
});
const subsidy=document.getElementById('subsidy');
const money=value=>'$'+value;
function updateBudget(){
  const store=Math.max(0,Math.min(140,Number(subsidy.value)||0));
  const fan=140-store;
  document.getElementById('subsidy-value').value=money(store);
  document.getElementById('store-amount').textContent=money(store);
  document.getElementById('fan-amount').textContent=money(fan);
  document.getElementById('store-bar').style.width=(store/140*100)+'%';
  subsidy.setAttribute('aria-valuetext',`Your store covers ${store} dollars. Customer co-pay is ${fan} dollars.`);
  document.getElementById('scenario-message').textContent=fan===0?'The example reward is fully covered by your store.':store===0?'The customer covers the full example reward cost.':'Your store covers part of the reward.';
}
subsidy.addEventListener('input',updateBudget);
updateBudget();
// Read campaign identity only. Opening this page creates no provider jobs,
// operator sessions or events. Demo links survive an unavailable API.
fetch('/api/growth/public?campaign=main',{credentials:'omit',signal:AbortSignal.timeout(5000)})
  .then(response=>response.ok?response.json():null)
  .then(config=>{
    if(typeof config?.creator?.id!=='string'||!config.creator.id)return;
    for(const link of document.querySelectorAll('[data-demo]'))link.href='/shop?creator='+encodeURIComponent(config.creator.id);
  }).catch(()=>{});
