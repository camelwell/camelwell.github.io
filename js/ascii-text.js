/* ================================================================
   ASCII TEXT ENGINE  — Three.js based
   ================================================================ */
Math.map = (n,s1,s2,s3,s4) => ((n-s1)/(s2-s1))*(s4-s3)+s3;

class AsciiFilter {
  constructor(renderer, {fontSize=8, fontFamily="'IBM Plex Mono',monospace", charset, invert=true}={}) {
    this.renderer=renderer; this.fontSize=fontSize; this.fontFamily=fontFamily; this.invert=invert;
    this.charset = charset ?? " .`'^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
    this.domElement = document.createElement('div');
    Object.assign(this.domElement.style,{position:'absolute',top:'0',left:'0',width:'100%',height:'100%'});
    this.pre = document.createElement('pre'); this.domElement.appendChild(this.pre);
    this.canvas = document.createElement('canvas'); this.context = this.canvas.getContext('2d');
    this.context.imageSmoothingEnabled = false;
    Object.assign(this.canvas.style,{position:'absolute',top:'0',left:'0',width:'100%',height:'100%',imageRendering:'pixelated',zIndex:'8'});
    this.domElement.appendChild(this.canvas);
    this.deg=0; this.mouse={x:0,y:0}; this.center={x:0,y:0};
    this._onMove = e => { this.mouse={x:e.clientX,y:e.clientY}; };
    document.addEventListener('mousemove', this._onMove);
  }
  setSize(w,h) {
    this.width=w; this.height=h; this.renderer.setSize(w,h);
    this.center={x:w/2,y:h/2}; this.mouse={...this.center}; this._reset();
  }
  _reset() {
    this.context.font=`${this.fontSize}px ${this.fontFamily}`;
    const cw=this.context.measureText('A').width;
    this.cols=Math.floor(this.width/cw); this.rows=Math.floor(this.height/this.fontSize);
    this.canvas.width=this.cols; this.canvas.height=this.rows;
    Object.assign(this.pre.style,{fontFamily:this.fontFamily,fontSize:`${this.fontSize}px`,
      margin:'0',padding:'0',lineHeight:'1em',position:'absolute',left:'0',top:'0',zIndex:'9',
      backgroundImage:'radial-gradient(circle, #ec7357 0%, #fdd692 50%, #e1ce7a 100%)',
      backgroundAttachment:'fixed',WebkitTextFillColor:'transparent',WebkitBackgroundClip:'text',
      mixBlendMode:'difference',userSelect:'none',whiteSpace:'pre',pointerEvents:'none'});
  }
  render(scene,camera) {
    this.renderer.render(scene,camera);
    const {width:w,height:h}=this.canvas;
    this.context.clearRect(0,0,w,h);
    if(w&&h) this.context.drawImage(this.renderer.domElement,0,0,w,h);
    this._asciify(w,h); this._hue();
  }
  _hue() {
    const dx=this.mouse.x-this.center.x, dy=this.mouse.y-this.center.y;
    const deg=(Math.atan2(dy,dx)*180)/Math.PI;
    this.deg+=(deg-this.deg)*0.075;
    this.domElement.style.filter=`hue-rotate(${this.deg.toFixed(1)}deg)`;
  }
  _asciify(w,h) {
    if(!w||!h) return;
    const data=this.context.getImageData(0,0,w,h).data; let str='';
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const i=(x+y*w)*4, [r,g,b,a]=[data[i],data[i+1],data[i+2],data[i+3]];
        if(a===0){str+=' ';continue;}
        let gray=(0.3*r+0.6*g+0.1*b)/255;
        let idx=Math.floor((1-gray)*(this.charset.length-1));
        if(this.invert) idx=this.charset.length-idx-1;
        str+=this.charset[idx];
      } str+='\n';
    } this.pre.textContent=str;
  }
  dispose() { document.removeEventListener('mousemove',this._onMove); }
}

class CanvasTxt {
  constructor(txt,{fontSize=110,fontFamily="'IBM Plex Mono',monospace",color='#fdf9f3'}={}) {
    this.canvas=document.createElement('canvas'); this.ctx=this.canvas.getContext('2d');
    this.txt=txt; this.fontSize=fontSize; this.fontFamily=fontFamily; this.color=color;
    this.font=`600 ${this.fontSize}px ${this.fontFamily}`;
  }
  resize() {
    this.ctx.font=this.font; const m=this.ctx.measureText(this.txt);
    this.canvas.width=Math.ceil(m.width)+20;
    this.canvas.height=Math.ceil(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)+20;
  }
  render() {
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.fillStyle=this.color; this.ctx.font=this.font;
    const m=this.ctx.measureText(this.txt);
    this.ctx.fillText(this.txt,10,10+m.actualBoundingBoxAscent);
  }
}

class CanvAscii {
  constructor({text,asciiFontSize,textFontSize,textColor,planeBaseHeight,enableWaves},container,w,h) {
    this.textString=text; this.asciiFontSize=asciiFontSize; this.textFontSize=textFontSize;
    this.textColor=textColor; this.planeBaseHeight=planeBaseHeight;
    this.container=container; this.width=w; this.height=h; this.enableWaves=enableWaves;
    this.camera=new THREE.PerspectiveCamera(45,w/h,1,1000); this.camera.position.z=30;
    this.scene=new THREE.Scene(); this.mouse={x:w/2,y:h/2};
    this._onMove=e=>{const b=container.getBoundingClientRect(); this.mouse={x:e.clientX-b.left,y:e.clientY-b.top};};
  }
  async init() {
    try{await document.fonts.load(`600 ${this.textFontSize}px "IBM Plex Mono"`);}catch(e){}
    await document.fonts.ready; this._setMesh(); this._setRenderer();
  }
  _setMesh() {
    this.textCanvas=new CanvasTxt(this.textString,{fontSize:this.textFontSize,fontFamily:"'IBM Plex Mono',monospace",color:this.textColor});
    this.textCanvas.resize(); this.textCanvas.render();
    this.texture=new THREE.CanvasTexture(this.textCanvas.canvas);
    this.texture.minFilter=THREE.NearestFilter;
    const aspect=this.textCanvas.canvas.width/this.textCanvas.canvas.height, h=this.planeBaseHeight;
    this.geometry=new THREE.PlaneGeometry(h*aspect,h,36,36);

    const vShader=`varying vec2 vUv;uniform float uTime;uniform float uEnableWaves;
void main(){vUv=uv;float t=uTime*5.;vec3 p=position;
p.x+=sin(t+position.y)*0.5*uEnableWaves;p.y+=cos(t+position.z)*0.15*uEnableWaves;
p.z+=sin(t+position.x)*uEnableWaves;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
    const fShader=`varying vec2 vUv;uniform float uTime;uniform sampler2D uTexture;
void main(){float t=uTime;vec2 p=vUv;
float r=texture2D(uTexture,p+cos(t*2.-t+p.x)*.01).r;
float g=texture2D(uTexture,p+tan(t*.5+p.x-t)*.01).g;
float b=texture2D(uTexture,p-cos(t*2.+t+p.y)*.01).b;
float a=texture2D(uTexture,p).a;gl_FragColor=vec4(r,g,b,a);}`;

    this.material=new THREE.ShaderMaterial({vertexShader:vShader,fragmentShader:fShader,transparent:true,
      uniforms:{uTime:{value:0},mouse:{value:1},uTexture:{value:this.texture},uEnableWaves:{value:this.enableWaves?1:0}}});
    this.mesh=new THREE.Mesh(this.geometry,this.material); this.scene.add(this.mesh);
  }
  _setRenderer() {
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true});
    this.renderer.setPixelRatio(1); this.renderer.setClearColor(0x000000,0);
    this.filter=new AsciiFilter(this.renderer,{fontFamily:"'IBM Plex Mono',monospace",fontSize:this.asciiFontSize,invert:true});
    this.container.appendChild(this.filter.domElement);
    this.filter.setSize(this.width,this.height);
    this.camera.aspect=this.width/this.height; this.camera.updateProjectionMatrix();
    this.container.addEventListener('mousemove',this._onMove);
  }
  load() { const tick=()=>{this._rafId=requestAnimationFrame(tick);this._render();}; tick(); }
  _render() {
    const time=performance.now()*0.001;
    this.textCanvas.render(); this.texture.needsUpdate=true;
    this.material.uniforms.uTime.value=Math.sin(time);
    const rx=Math.map(this.mouse.y,0,this.height,0.4,-0.4);
    const ry=Math.map(this.mouse.x,0,this.width,-0.4,0.4);
    this.mesh.rotation.x+=(rx-this.mesh.rotation.x)*0.05;
    this.mesh.rotation.y+=(ry-this.mesh.rotation.y)*0.05;
    this.filter.render(this.scene,this.camera);
  }
  setSize(w,h) {
    this.width=w; this.height=h; this.camera.aspect=w/h;
    this.camera.updateProjectionMatrix(); this.filter.setSize(w,h);
  }
  dispose() {
    cancelAnimationFrame(this._rafId); this.container.removeEventListener('mousemove',this._onMove);
    if(this.filter){this.filter.dispose();if(this.filter.domElement.parentNode)this.container.removeChild(this.filter.domElement);}
    this.scene.traverse(o=>{if(o.isMesh){o.material.dispose();o.geometry.dispose();}});
    if(this.renderer){this.renderer.dispose();this.renderer.forceContextLoss();}
  }
}

/* Mount ASCII as the section TITLE */
(function mountAsciiTitle() {
  const sect = document.getElementById('skills');
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    setTimeout(() => {
      const el = document.getElementById('ascii-title-stage');
      if (!el) return;
      const w = el.offsetWidth || 1100, h = el.offsetHeight || 260;
      const inst = new CanvAscii(
        { text:'TECHNICAL SKILLS', asciiFontSize:9, textFontSize:130,
          textColor:'#fdf9f3', planeBaseHeight:8, enableWaves:true },
        el, w, h
      );
      inst.init().then(() => {
        inst.load();
        const fb = el.querySelector('.ascii-title-fallback');
        if (fb) { fb.style.transition='opacity 0.7s'; fb.style.opacity='0'; }
        const ro = new ResizeObserver(entries => {
          if (!entries[0]) return;
          const {width:rw,height:rh} = entries[0].contentRect;
          if (rw>0 && rh>0) inst.setSize(rw, rh);
        });
        ro.observe(el);
      });
    }, 150);
  }, { threshold: 0.05 });
  if (sect) io.observe(sect);
})();
