const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('image preview zooms, resets, handles errors and opens another image at fit size',()=>{
  const listeners=()=>({
    handlers:{},
    addEventListener(event,callback){this.handlers[event]=callback},
    emit(event,data){this.handlers[event](data)}
  });
  const dialog={...listeners(),open:false,showModal(){this.open=true}};
  const image={...listeners(),hidden:true,naturalWidth:1600,naturalHeight:800,style:{},
    get clientWidth(){return parseFloat(this.style.width)||0},
    get clientHeight(){return this.clientWidth/2},
    complete:false
  };
  const classes=new Set();
  const viewport={...listeners(),hidden:true,clientWidth:800,clientHeight:500,scrollLeft:0,scrollTop:0,
    setPointerCapture(id){this.captured=id},
    classList:{
      add:name=>classes.add(name),
      remove:name=>classes.delete(name),
      toggle(name,value){if(value)classes.add(name);else classes.delete(name)}
    }
  };
  const zoomIn={...listeners()},zoomOut={...listeners()},reset={...listeners(),textContent:''};
  const status={hidden:false,textContent:''};
  const tradingViewLink={hidden:true,removeAttribute(name){delete this[name]}};
  const elements={
    imagePreviewDialog:dialog,imagePreviewFull:image,imagePreviewStatus:status,
    imagePreviewViewport:viewport,imageZoomIn:zoomIn,imageZoomOut:zoomOut,imageZoomReset:reset,
    imagePreviewTradingView:tradingViewLink
  };
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf("const imageDialog="),source.indexOf("document.querySelectorAll('.image-preview-trigger')"));
  const context={document:{getElementById:id=>elements[id]},window:listeners(),Event:class{}};
  vm.runInNewContext(block,context);
  const button={...listeners(),dataset:{imageSrc:'/trades/1/image'}};
  context.testButton=button;
  vm.runInNewContext('bindImagePreview(testButton)',context);
  button.emit('click');
  assert.equal(dialog.open,true);
  assert.equal(zoomIn.disabled,true);
  image.emit('load');
  assert.equal(viewport.hidden,false);
  assert.equal(image.style.width,'800px');
  assert.equal(reset.textContent,'100%');
  zoomIn.emit('click');
  assert.equal(image.style.width,'1000px');
  assert.equal(reset.textContent,'125%');
  assert.equal(zoomOut.disabled,false);
  assert.equal(viewport.scrollLeft,100);
  assert.equal(classes.has('is-zoomed'),true);
  viewport.emit('pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:200,clientY:100});
  assert.equal(viewport.captured,1);
  assert.equal(classes.has('is-dragging'),true);
  const initialTop=viewport.scrollTop;
  viewport.emit('pointermove',{pointerId:1,clientX:150,clientY:80});
  assert.equal(viewport.scrollLeft,150);
  assert.equal(viewport.scrollTop,initialTop+20);
  viewport.emit('pointerup',{pointerId:1});
  assert.equal(classes.has('is-dragging'),false);
  viewport.emit('pointermove',{pointerId:1,clientX:100,clientY:50});
  assert.equal(viewport.scrollLeft,150);
  for(let i=0;i<20;i++)zoomIn.emit('click');
  assert.equal(reset.textContent,'400%');
  assert.equal(zoomIn.disabled,true);
  reset.emit('click');
  assert.equal(image.style.width,'800px');
  assert.equal(zoomOut.disabled,true);
  assert.equal(reset.disabled,true);
  assert.equal(classes.has('is-zoomed'),false);
  zoomIn.emit('click');
  image.emit('error');
  assert.equal(viewport.hidden,true);
  assert.equal(zoomIn.disabled,true);
  assert.match(status.textContent,/Could not load/);
  button.dataset.imageSrc='/trades/2/image';
  button.emit('click');
  image.emit('load');
  assert.equal(image.src,'/trades/2/image');
  assert.equal(reset.textContent,'100%');
  assert.equal(image.style.width,'800px');
  const snapshot={...listeners(),dataset:{
    imageSrc:'https://s3.tradingview.com/snapshots/z/ZWvJ4X1B.png',tradingViewId:'ZWvJ4X1B'
  }};
  context.testSnapshot=snapshot;
  vm.runInNewContext('bindImagePreview(testSnapshot)',context);
  snapshot.emit('click');
  assert.equal(tradingViewLink.hidden,false);
  assert.equal(tradingViewLink.href,'https://www.tradingview.com/x/ZWvJ4X1B/');
  image.emit('error');
  assert.equal(tradingViewLink.hidden,false);
  snapshot.dataset.tradingViewId='AbCd1234';
  snapshot.emit('click');
  assert.equal(tradingViewLink.href,'https://www.tradingview.com/x/AbCd1234/');
  button.emit('click');
  assert.equal(tradingViewLink.hidden,true);
  assert.equal(tradingViewLink.href,undefined);
  snapshot.dataset.tradingViewId='javascript:alert(1)';
  snapshot.emit('click');
  assert.equal(tradingViewLink.hidden,true);
  assert.equal(tradingViewLink.href,undefined);
});

test('journal image upload previews multiple files and rejects more than ten',()=>{
  const element=()=>({
    handlers:{},children:[],dataset:{},hidden:false,value:'',files:[],
    addEventListener(event,callback){this.handlers[event]=callback},
    emit(event,data){this.handlers[event](data)},
    append(child){this.children.push(child)},
    replaceChildren(){this.children=[]},
    setAttribute(){}
  });
  const input=element(),preview=element(),error=element(),submit=element(),form=element();
  form.querySelector=selector=>({
    '[data-image-input]':input,
    '[data-upload-preview]':preview,
    '.upload-error':error,
    '[type="submit"]':submit
  })[selector];
  form.querySelectorAll=()=>[];
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf("document.querySelectorAll('[data-image-upload]')"),source.indexOf('const tradeFields={'));
  let nextUrl=0;
  const context={
    document:{
      querySelectorAll:()=>[form],
      createElement:element
    },
    URL:{
      createObjectURL:()=>`blob:image-${++nextUrl}`,
      revokeObjectURL(){}
    },
    bindImagePreview(){}
  };
  vm.runInNewContext(block,context);
  input.files=[{name:'first.png',size:100},{name:'second.png',size:200}];
  input.emit('change');
  assert.equal(preview.hidden,false);
  assert.equal(preview.children.length,2);
  assert.equal(preview.children[1].dataset.imageSrc,'blob:image-2');
  input.files=Array.from({length:11},(_,index)=>({name:`${index}.png`,size:100}));
  input.emit('change');
  assert.equal(preview.hidden,true);
  assert.equal(error.hidden,false);
  assert.match(error.textContent,/up to 10 images/);
});

test('TradingView links render a safe CDN image preview and reject other hosts',()=>{
  const node=()=>({
    children:[],dataset:{},attributes:{},hidden:false,textContent:'',className:'',
    append(...children){this.children.push(...children)},
    replaceChildren(){this.children=[];this.textContent=''},
    setAttribute(name,value){this.attributes[name]=value}
  });
  const input=node(),preview=node(),buttonBindings=[];
  input.value='https://www.tradingview.com/x/ZWvJ4X1B/';
  const form={querySelector:selector=>({
    '[data-tradingview-input]':input,
    '[data-tradingview-preview]':preview
  })[selector]};
  const source=fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
  const block=source.slice(source.indexOf('function tradingViewSnapshotId'),source.indexOf("document.querySelectorAll('.image-preview-trigger')"));
  const context={URL,document:{createElement:node},bindImagePreview:button=>buttonBindings.push(button),form};
  vm.runInNewContext(`${block}\nupdateTradingViewPreview(form)`,context);
  assert.equal(preview.hidden,false);
  assert.equal(preview.children[0].dataset.imageSrc,'https://s3.tradingview.com/snapshots/z/ZWvJ4X1B.png');
  assert.equal(preview.children[0].dataset.tradingViewId,'ZWvJ4X1B');
  assert.equal(preview.children[1].href,'https://www.tradingview.com/x/ZWvJ4X1B/');
  assert.equal(buttonBindings.length,1);

  input.value='https://example.com/x/ZWvJ4X1B/';
  vm.runInNewContext('updateTradingViewPreview(form)',context);
  assert.match(preview.textContent,/valid public TradingView snapshot URL/);
  assert.equal(preview.children.length,0);
});
