const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createMediaUpload,videoType}=require('../lib/media-upload');

async function mediaServer(t){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'discipline-media-'));
  const media=createMediaUpload({
    directory,maxImages:2,maxVideos:3,maxImageBytes:8,maxVideoBytes:16
  });
  const app=express();
  app.post('/upload',media.receive,(req,res)=>{
    res.json({
      images:media.requestImages(req).map(file=>file.filename),
      videos:media.requestVideos(req).map(file=>({id:file.filename,type:videoType(file)}))
    });
  });
  const server=await new Promise(resolve=>{
    const running=app.listen(0,'127.0.0.1',()=>resolve(running));
  });
  t.after(async()=>{
    await new Promise(resolve=>server.close(resolve));
    await fs.rm(directory,{recursive:true,force:true});
  });
  return{directory,media,url:`http://127.0.0.1:${server.address().port}/upload`};
}

async function upload(url,files){
  const body=new FormData();
  files.forEach(({field,name,type,bytes})=>{
    body.append(field,new Blob([bytes],{type}),name);
  });
  return fetch(url,{method:'POST',body});
}

test('stores MP4 and WebM files and identifies their container signatures',async t=>{
  const{directory,media,url}=await mediaServer(t);
  const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(4)]);
  const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(12)]);
  const response=await upload(url,[
    {field:'videos',name:'screen.mp4',type:'video/mp4',bytes:mp4},
    {field:'videos',name:'screen.webm',type:'video/webm',bytes:webm}
  ]);
  assert.equal(response.status,200);
  const saved=await response.json();
  assert.deepEqual(saved.videos.map(video=>video.type),['video/mp4','video/webm']);
  for(const video of saved.videos)await media.removeStoredMedia(video.id);
  assert.deepEqual(await fs.readdir(directory),[]);
});

test('rejects spoofed, oversized and excessive video uploads and preserves the image size cap',async t=>{
  const{directory,url}=await mediaServer(t);
  let response=await upload(url,[
    {field:'videos',name:'movie.mov',type:'video/quicktime',bytes:Buffer.alloc(8)}
  ]);
  assert.equal(response.status,400);
  await response.text();

  response=await upload(url,[
    {field:'videos',name:'large.mp4',type:'video/mp4',bytes:Buffer.alloc(17)}
  ]);
  assert.equal(response.status,413);
  await response.text();

  response=await upload(url,[
    {field:'images',name:'large.png',type:'image/png',bytes:Buffer.alloc(9)}
  ]);
  assert.equal(response.status,413);
  await response.text();

  const smallVideo={field:'videos',name:'clip.mp4',type:'video/mp4',bytes:Buffer.alloc(8)};
  response=await upload(url,[smallVideo,smallVideo,smallVideo,smallVideo]);
  assert.equal(response.status,400);
  await response.text();
  assert.deepEqual(await fs.readdir(directory),[]);
});
