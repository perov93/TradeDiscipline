const imageDialog=document.getElementById('imagePreviewDialog');
const fullImage=document.getElementById('imagePreviewFull');
const imagePreviewStatus=document.getElementById('imagePreviewStatus');
const imageViewport=document.getElementById('imagePreviewViewport');
const imageZoomIn=document.getElementById('imageZoomIn');
const imageZoomOut=document.getElementById('imageZoomOut');
const imageZoomReset=document.getElementById('imageZoomReset');
const imagePreviewTradingView=document.getElementById('imagePreviewTradingView');
let imageZoom=1;
let imageDrag=null;
const updateImageZoom=()=>{
  const fitWidth=Math.min(fullImage.naturalWidth,imageViewport.clientWidth,
    imageViewport.clientHeight*fullImage.naturalWidth/fullImage.naturalHeight);
  fullImage.style.width=`${fitWidth*imageZoom}px`;
  imageZoomReset.textContent=`${Math.round(imageZoom*100)}%`;
  imageZoomOut.disabled=imageZoom<=1;
  imageZoomIn.disabled=imageZoom>=4;
  imageZoomReset.disabled=imageZoom===1;
  imageViewport.classList.toggle('is-zoomed',imageZoom>1);
};
const changeImageZoom=zoom=>{
  const oldWidth=fullImage.clientWidth,oldHeight=fullImage.clientHeight;
  const centerX=imageViewport.scrollLeft+imageViewport.clientWidth/2;
  const centerY=imageViewport.scrollTop+imageViewport.clientHeight/2;
  imageZoom=Math.max(1,Math.min(4,zoom));
  updateImageZoom();
  imageViewport.scrollLeft=centerX*fullImage.clientWidth/oldWidth-imageViewport.clientWidth/2;
  imageViewport.scrollTop=centerY*fullImage.clientHeight/oldHeight-imageViewport.clientHeight/2;
};
imageZoomIn.addEventListener('click',()=>changeImageZoom(imageZoom+0.25));
imageZoomOut.addEventListener('click',()=>changeImageZoom(imageZoom-0.25));
imageZoomReset.addEventListener('click',()=>changeImageZoom(1));
imageViewport.addEventListener('pointerdown',event=>{
  if(imageZoom<=1||!event.isPrimary||event.button!==0)return;
  imageDrag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:imageViewport.scrollLeft,top:imageViewport.scrollTop};
  imageViewport.setPointerCapture(event.pointerId);
  imageViewport.classList.add('is-dragging');
});
imageViewport.addEventListener('pointermove',event=>{
  if(!imageDrag||event.pointerId!==imageDrag.pointerId)return;
  imageViewport.scrollLeft=imageDrag.left+imageDrag.x-event.clientX;
  imageViewport.scrollTop=imageDrag.top+imageDrag.y-event.clientY;
});
const endImageDrag=event=>{
  if(!imageDrag||event.pointerId!==imageDrag.pointerId)return;
  imageDrag=null;
  imageViewport.classList.remove('is-dragging');
};
imageViewport.addEventListener('pointerup',endImageDrag);
imageViewport.addEventListener('pointercancel',endImageDrag);
imageViewport.addEventListener('lostpointercapture',endImageDrag);
window.addEventListener('resize',()=>{if(imageDialog.open&&!fullImage.hidden)updateImageZoom()});
fullImage.addEventListener('load',()=>{
  imagePreviewStatus.hidden=true;
  imageViewport.hidden=false;
  fullImage.hidden=false;
  imageZoom=1;
  imageViewport.scrollLeft=0;
  imageViewport.scrollTop=0;
  updateImageZoom();
});
fullImage.addEventListener('error',()=>{
  imagePreviewStatus.textContent='Could not load this image. Close the preview and try again.';
  imagePreviewStatus.hidden=false;
  imageViewport.hidden=true;
  fullImage.hidden=true;
  imageZoomIn.disabled=true;
  imageZoomOut.disabled=true;
  imageZoomReset.disabled=true;
});
function bindImagePreview(button){
  button.addEventListener('click',()=>{
    imagePreviewStatus.textContent='Loading image preview…';
    imagePreviewStatus.hidden=false;
    imageViewport.hidden=true;
    fullImage.hidden=true;
    imageZoomIn.disabled=true;
    imageZoomOut.disabled=true;
    imageZoomReset.disabled=true;
    imageZoomReset.textContent='100%';
    const snapshotId=button.dataset.tradingViewId||'';
    const validSnapshot=/^[a-z0-9]{8}$/i.test(snapshotId);
    imagePreviewTradingView.hidden=!validSnapshot;
    if(!validSnapshot)imagePreviewTradingView.removeAttribute('href');
    else imagePreviewTradingView.href=`https://www.tradingview.com/x/${snapshotId}/`;
    imageDialog.showModal();
    fullImage.src=button.dataset.imageSrc;
    if(fullImage.complete){
      if(fullImage.naturalWidth)fullImage.dispatchEvent(new Event('load'));
      else fullImage.dispatchEvent(new Event('error'));
    }
  });
}
document.querySelectorAll('button.image-preview-trigger[data-image-src]').forEach(bindImagePreview);
