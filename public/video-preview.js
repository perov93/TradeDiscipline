(()=>{
  const dialog=document.createElement('dialog');
  dialog.className='video-preview-dialog';
  dialog.setAttribute('aria-label','Screen recording preview');
  const toolbar=document.createElement('div');
  toolbar.className='video-preview-toolbar';
  const title=document.createElement('span');
  title.className='video-preview-dialog-title';
  title.textContent='SCREEN RECORDING';
  const closeForm=document.createElement('form');
  closeForm.method='dialog';
  const closeButton=document.createElement('button');
  closeButton.type='submit';
  closeButton.className='ghost';
  closeButton.textContent='CLOSE';
  closeForm.append(closeButton);
  toolbar.append(title,closeForm);
  const video=document.createElement('video');
  video.controls=true;
  video.playsInline=true;
  video.preload='metadata';
  dialog.append(toolbar,video);
  document.body.append(dialog);
  let activeTrigger=null;

  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-video-preview]');
    if(!trigger||dialog.open)return;
    activeTrigger=trigger;
    video.replaceChildren();
    const source=document.createElement('source');
    source.src=trigger.dataset.videoSrc;
    source.type=trigger.dataset.videoMime;
    video.append(source);
    title.textContent=trigger.getAttribute('aria-label')||'SCREEN RECORDING';
    dialog.showModal();
    video.load();
  });
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    video.pause();
    video.replaceChildren();
    video.load();
    if(activeTrigger&&activeTrigger.isConnected)activeTrigger.focus();
    activeTrigger=null;
  });
})();
