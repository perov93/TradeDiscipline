const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const {Transform,pipeline}=require('stream');
const multer=require('multer');

const imageTypes=new Set(['image/jpeg','image/png','image/webp']);
const videoTypes=new Set(['video/mp4','video/webm']);

function createMediaUpload({directory,maxImages,maxVideos,maxImageBytes,maxVideoBytes}){
  fs.mkdirSync(directory,{recursive:true});
  const storage={
    _handleFile(req,file,callback){
      const filename=crypto.randomUUID();
      const filePath=path.join(directory,filename);
      const limit=file.fieldname==='videos'?maxVideoBytes:maxImageBytes;
      let size=0;
      const limiter=new Transform({
        transform(chunk,encoding,done){
          size+=chunk.length;
          if(size>limit)return done(new multer.MulterError('LIMIT_FILE_SIZE',file.fieldname));
          done(null,chunk);
        }
      });
      pipeline(file.stream,limiter,fs.createWriteStream(filePath,{flags:'wx'}),async error=>{
        if(error){
          try{
            await fs.promises.unlink(filePath);
          }catch(cleanupError){
            if(cleanupError.code!=='ENOENT')return callback(cleanupError);
          }
          return callback(error);
        }
        callback(null,{destination:directory,filename,path:filePath,size});
      });
    },
    _removeFile(req,file,callback){
      fs.unlink(file.path,error=>{
        if(error&&error.code!=='ENOENT')return callback(error);
        callback(null);
      });
    }
  };
  const upload=multer({
    storage,
    limits:{
      files:maxImages+maxVideos,
      fields:50,
      fieldSize:25*1024,
      fieldNameSize:100,
      parts:maxImages+maxVideos+50
    },
    fileFilter(req,file,done){
      const allowed=file.fieldname==='images'?imageTypes.has(file.mimetype):
        file.fieldname==='videos'?videoTypes.has(file.mimetype):false;
      if(allowed)return done(null,true);
      const error=new Error(file.fieldname==='videos'?
        'Only MP4 or WebM videos are supported.':
        'Only JPEG, PNG, or WebP images are supported.');
      error.code='INVALID_MEDIA_TYPE';
      done(error);
    }
  });
  const parse=upload.fields([
    {name:'images',maxCount:maxImages},
    {name:'videos',maxCount:maxVideos}
  ]);
  function receive(req,res,next){
    parse(req,res,error=>{
      if(!error)return next();
      if(error instanceof multer.MulterError){
        if(error.code==='LIMIT_FILE_SIZE'){
          const video=error.field==='videos';
          const bytes=video?maxVideoBytes:maxImageBytes;
          const limit=bytes>=1e9?`${bytes/1e9} GB`:`${Math.round(bytes/1048576)} MB`;
          return res.status(413).send(`${video?'Videos':'Images'} must be ${limit} or smaller.`);
        }
        if(error.code==='LIMIT_UNEXPECTED_FILE'){
          const video=error.field==='videos';
          return res.status(400).send(`You can upload up to ${video?maxVideos:maxImages} ${video?'videos':'images'} per record.`);
        }
        return res.status(400).send('The upload is invalid.');
      }
      if(error.code==='INVALID_MEDIA_TYPE')return res.status(400).send(error.message);
      next(error);
    });
  }
  function requestImages(req){
    return Array.isArray(req.files)?req.files:req.files?.images||[];
  }
  function requestVideos(req){
    return Array.isArray(req.files)?[]:req.files?.videos||[];
  }
  function requestUploads(req){
    return [...requestImages(req),...requestVideos(req)];
  }
  async function discardRequestUploads(req){
    for(const file of requestUploads(req)){
      await fs.promises.unlink(file.path).catch(error=>{
        if(error.code!=='ENOENT')throw error;
      });
    }
  }
  async function removeStoredMedia(id){
    if(!id)return;
    if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Invalid stored media identifier.');
    try{
      await fs.promises.unlink(path.join(directory,id));
    }catch(error){
      if(error.code!=='ENOENT')throw error;
    }
  }
  return{receive,requestImages,requestVideos,requestUploads,discardRequestUploads,removeStoredMedia};
}

function videoType(file){
  const descriptor=fs.openSync(file.path,'r');
  const bytes=Buffer.alloc(12);
  let length;
  try{
    length=fs.readSync(descriptor,bytes,0,bytes.length,0);
  }finally{
    fs.closeSync(descriptor);
  }
  if(length>=8&&bytes.toString('ascii',4,8)==='ftyp')return 'video/mp4';
  if(length>=4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'video/webm';
  return '';
}

module.exports={createMediaUpload,videoType};
