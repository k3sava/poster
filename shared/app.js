// shared/app.js — wires input → director.composePair → render → trace UI.
'use strict';

(function(){
const $ = sel => document.querySelector(sel);
const POSTER_W = 1080, POSTER_H = 1350; // 4:5 social default

let currentPair = null;
let currentPhrase = '';

function el(tag, attrs={}, children=[]){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k === 'class') node.className = v;
    else if(k === 'style') node.style.cssText = v;
    else if(k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c=>{
    if(c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function renderTrace(spec, host){
  host.innerHTML = '';
  host.appendChild(el('div', {class:'trace-head'}, [
    el('span', {class:'arch-dot', style:`background:${spec.palette.colors[0]}`}),
    el('strong', {}, spec.archetype.label),
    el('span', {class:'trace-template'}, ' · '+spec.template.name),
  ]));
  if(spec.conceit && spec.conceit !== 'no-conceit'){
    host.appendChild(el('div', {class:'trace-conceit'}, [
      el('span', {class:'trace-conceit-tag'}, 'CONCEIT'),
      el('span', {class:'trace-conceit-val'}, spec.conceit),
      el('span', {class:'trace-conceit-desc'}, window.__conceit.describe(spec.conceit)),
    ]));
  }
  spec.trace.forEach(t=>{
    host.appendChild(el('div', {class:'trace-row'}, [
      el('span', {class:'trace-step'}, t.step),
      el('span', {class:'trace-value'}, String(t.value)),
      el('span', {class:'trace-reason'}, t.reason),
    ]));
  });
}

async function regenerate(phrase){
  currentPhrase = phrase;
  $('#status').textContent = 'composing…';
  const pair = await window.__director.composePair(phrase);
  currentPair = pair;
  // Sync edit-strip text fields with the headline each director landed on.
  // (Article ingestion may have extracted a shorter headline from a long input.)
  $('#edit-a').value = pair.a.tree.raw || phrase;
  $('#edit-b').value = pair.b.tree.raw || phrase;
  const c1 = $('#poster-a'), c2 = $('#poster-b');
  window.__render.render(c1, pair.a);
  window.__render.render(c2, pair.b);
  renderTrace(pair.a, $('#trace-a'));
  renderTrace(pair.b, $('#trace-b'));
  $('#status').textContent = `seed: "${phrase.slice(0,60)}${phrase.length>60?'…':''}"`;
  buildCustomizePanel();
}

// Apply user-edited copy to one poster only. Reparses the new text but keeps
// every other decision (director, template, palette, treatment, params) intact.
function applyEditedCopy(key, newText){
  if(!currentPair) return;
  const spec = currentPair[key];
  const ingested = window.__article.ingest(newText);
  const composeText = ingested.kind === 'article' ? ingested.headline : newText;
  const tree = window.__parse.basic(composeText);
  tree.raw = newText;
  tree.ingested = ingested;
  spec.tree = tree;
  spec.ingested = ingested;
  spec.trace.push({ step:'edit', value:`copy → "${newText.slice(0,60)}${newText.length>60?'…':''}"`,
                    reason:'User edited the copy directly. Director / template / palette held constant.' });
  const c = key === 'a' ? $('#poster-a') : $('#poster-b');
  window.__render.render(c, spec);
  renderTrace(spec, key === 'a' ? $('#trace-a') : $('#trace-b'));
}

function downloadCanvas(canvas, name){
  canvas.toBlob(blob=>{
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

function buildCustomizePanel(){
  const host = $('#control-body');
  host.innerHTML = '';
  if(!currentPair) return;
  ['a','b'].forEach(key=>{
    const spec = currentPair[key];
    const sect = el('section', {class:'cust-sect'});
    sect.appendChild(el('h3', {}, 'Poster '+key.toUpperCase()+' · '+spec.archetype.label));
    // Template select
    const tplSel = el('select', {class:'cust-sel', onchange:e=>{
      const id = e.target.value;
      const t = window.__director.TEMPLATES.find(t=>t.id===id);
      spec.template = t;
      spec.trace.push({step:'override', value:'template → '+t.name, reason:'User override.'});
      const c = key==='a' ? $('#poster-a') : $('#poster-b');
      window.__render.render(c, spec);
      renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
    }});
    window.__director.TEMPLATES.forEach(t=>{
      const opt = el('option', {value:t.id}, t.name);
      if(t.id === spec.template.id) opt.selected = true;
      tplSel.appendChild(opt);
    });
    sect.appendChild(el('label', {class:'cust-row'}, [el('span',{},'Template'), tplSel]));

    // Background select
    const bgSel = el('select', {class:'cust-sel', onchange:e=>{
      spec.bg = e.target.value;
      spec.trace.push({step:'override', value:'background → '+spec.bg, reason:'User override.'});
      const c = key==='a' ? $('#poster-a') : $('#poster-b');
      window.__render.render(c, spec);
      renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
    }});
    ['solid','split','noise','grain','grid-ghost'].forEach(b=>{
      const opt = el('option', {value:b}, b);
      if(b === spec.bg) opt.selected = true;
      bgSel.appendChild(opt);
    });
    sect.appendChild(el('label', {class:'cust-row'}, [el('span',{},'Background'), bgSel]));

    // Treatment
    const trtSel = el('select', {class:'cust-sel', onchange:e=>{
      spec.treatment = e.target.value;
      spec.trace.push({step:'override', value:'treatment → '+spec.treatment, reason:'User override.'});
      const c = key==='a' ? $('#poster-a') : $('#poster-b');
      window.__render.render(c, spec);
      renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
    }});
    ['solid','outline','double-strike','shadow-hard','shadow-soft','halftone-fill','stencil-cut','mirror-y','split-color']
      .forEach(t=>{
        const opt = el('option', {value:t}, t);
        if(t === spec.treatment) opt.selected = true;
        trtSel.appendChild(opt);
      });
    sect.appendChild(el('label', {class:'cust-row'}, [el('span',{},'Treatment'), trtSel]));

    // Per-token treatment grid
    const tokenList = el('div', {class:'cust-tokens'});
    const tokens = (spec.tree.beats||[]).flatMap(b => b.tokens || (b.words||[]).map(w=>({w})));
    tokens.forEach(t=>{
      const word = t.w;
      const tSel = el('select', {class:'cust-sel', style:'flex:0 0 auto;font-size:11px;padding:3px 5px;',
        onchange:e=>{
          spec.tokenTreatments = spec.tokenTreatments || {};
          if(e.target.value === '_inherit') delete spec.tokenTreatments[word];
          else spec.tokenTreatments[word] = e.target.value;
          spec.trace.push({step:'override', value:`"${word}" treatment → ${e.target.value}`, reason:'User per-token override.'});
          const c = key==='a' ? $('#poster-a') : $('#poster-b');
          window.__render.render(c, spec);
          renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
        }});
      ['_inherit','solid','outline','double-strike','shadow-hard','halftone-fill','stencil-cut','split-color','mirror-y']
        .forEach(o => tSel.appendChild(el('option', {value:o}, o === '_inherit' ? 'inherit' : o)));
      const wrap = el('div', {class:'cust-token-row'}, [el('code', {class:'cust-token-w'}, word), tSel]);
      tokenList.appendChild(wrap);
    });
    sect.appendChild(el('div', {class:'cust-row', style:'flex-direction:column;align-items:stretch;'}, [
      el('span',{},'Per-token treatments'), tokenList
    ]));

    // Re-roll variant (re-sample parameters)
    const reroll = el('button', {class:'cust-dl', style:'background:transparent;color:var(--text);border:1px solid var(--border);margin-top:0', onclick:()=>{
      const r = window.__seed.rngFor(currentPhrase, 'reroll-'+key+'-'+Date.now());
      spec.params = window.__templateParams.paramsFor(spec.template.id, r);
      spec.treatment = spec.params.treatment || 'solid';
      spec.trace.push({step:'override', value:'variant → '+window.__templateParams.describeParams(spec.params), reason:'User re-rolled the parameter coordinates.'});
      const c = key==='a' ? $('#poster-a') : $('#poster-b');
      window.__render.render(c, spec);
      renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
    }}, 'Re-roll variant');
    sect.appendChild(reroll);

    // Case
    const capsSel = el('select', {class:'cust-sel', onchange:e=>{
      spec.caps = e.target.value;
      spec.trace.push({step:'override', value:'caps → '+spec.caps, reason:'User override.'});
      const c = key==='a' ? $('#poster-a') : $('#poster-b');
      window.__render.render(c, spec);
      renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
    }});
    ['all','sentence','title','mixed'].forEach(c=>{
      const opt = el('option', {value:c}, c);
      if(c === spec.caps) opt.selected = true;
      capsSel.appendChild(opt);
    });
    sect.appendChild(el('label', {class:'cust-row'}, [el('span',{},'Case'), capsSel]));

    // Palette swatches click-to-cycle
    const pal = el('div', {class:'cust-pal'});
    spec.palette.colors.forEach((c,i)=>{
      const sw = el('button', {class:'sw', style:`background:${c}`, title:c, onclick:()=>{
        // rotate: move this color to front
        spec.palette.colors = [c, ...spec.palette.colors.filter(x=>x!==c)];
        spec.trace.push({step:'override', value:'palette rotated → '+c+' first', reason:'User override.'});
        const cv = key==='a' ? $('#poster-a') : $('#poster-b');
        window.__render.render(cv, spec);
        renderTrace(spec, key==='a' ? $('#trace-a') : $('#trace-b'));
      }});
      pal.appendChild(sw);
    });
    sect.appendChild(el('label', {class:'cust-row'}, [el('span',{},'Palette'), pal]));

    // Export
    const dl = el('button', {class:'cust-dl', onclick:()=>{
      downloadCanvas(key==='a' ? $('#poster-a') : $('#poster-b'),
        `poster-${key}-${currentPhrase.slice(0,30).replace(/\W+/g,'-')}.png`);
    }}, 'Download PNG');
    sect.appendChild(dl);

    host.appendChild(sect);
  });
}

function loadImageAsField(file){
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{
      const max = 480;
      const ratio = Math.min(1, max/Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width*ratio));
      const h = Math.max(1, Math.round(img.height*ratio));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const cx = c.getContext('2d', { willReadFrequently:true });
      cx.drawImage(img, 0, 0, w, h);
      const id = cx.getImageData(0,0,w,h);
      const f = new Float32Array(w*h);
      for(let i=0;i<f.length;i++){
        const r = id.data[i*4], g = id.data[i*4+1], b = id.data[i*4+2];
        f[i] = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
      }
      window.__posterImage = { w, h, field:f, name:file.name };
      URL.revokeObjectURL(img.src);
      resolve();
    };
    img.src = URL.createObjectURL(file);
  });
}

function bind(){
  $('#go').addEventListener('click', ()=> regenerate($('#phrase').value.trim() || 'less is more'));
  $('#img-upload').addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    await loadImageAsField(f);
    $('#status').textContent = `image loaded: ${f.name} — pick Image Substrate to use it`;
    if(currentPair) regenerate(currentPhrase);
  });
  $('#phrase').addEventListener('keydown', e=>{
    if((e.metaKey||e.ctrlKey) && e.key === 'Enter') $('#go').click();
  });
  // Pixart's pattern: .wg.collapsed flips the panel; body.panel-collapsed
  // adjusts the stage padding. On mobile the .wg defaults to "sheet down";
  // toggling .collapsed slides it up.
  const isMobile = () => matchMedia('(max-width:640px)').matches;
  function setCollapsed(collapsed){
    const wg = document.querySelector('#panel');
    if(isMobile()){
      // On mobile, .wg.collapsed = sheet UP (open). Counter-intuitive but matches gui.css.
      wg.classList.toggle('collapsed', collapsed);
      document.body.classList.toggle('panel-collapsed', !collapsed);
    } else {
      wg.classList.toggle('collapsed', !collapsed);
      document.body.classList.toggle('panel-collapsed', !collapsed);
    }
    $('#panel-toggle').setAttribute('aria-pressed', collapsed ? 'true' : 'false');
  }
  function panelIsOpen(){
    const wg = document.querySelector('#panel');
    return isMobile() ? wg.classList.contains('collapsed') : !wg.classList.contains('collapsed');
  }
  $('#panel-toggle').addEventListener('click', ()=> setCollapsed(!panelIsOpen()));
  $('#wg-collapse').addEventListener('click', ()=> setCollapsed(!panelIsOpen()));
  document.querySelector('.wg-title').addEventListener('click', ()=> setCollapsed(!panelIsOpen()));
  // Default: open on desktop, closed on mobile.
  setCollapsed(!isMobile());
  // Edit mode toggle.
  $('#edit-toggle').addEventListener('click', ()=>{
    document.body.classList.toggle('edit-mode');
  });
  // Per-poster copy editing — debounced so each keystroke doesn't re-render.
  ['a','b'].forEach(key => {
    const ta = $('#edit-'+key);
    let timer = null;
    ta.addEventListener('input', ()=>{
      clearTimeout(timer);
      timer = setTimeout(()=> applyEditedCopy(key, ta.value), 220);
    });
    document.querySelectorAll('.edit-revert[data-key="'+key+'"]').forEach(btn => {
      btn.addEventListener('click', ()=>{
        ta.value = currentPhrase;
        applyEditedCopy(key, currentPhrase);
      });
    });
  });
  $('#dl-a').addEventListener('click', ()=> downloadCanvas($('#poster-a'),
    `poster-a-${currentPhrase.slice(0,30).replace(/\W+/g,'-')}.png`));
  $('#dl-b').addEventListener('click', ()=> downloadCanvas($('#poster-b'),
    `poster-b-${currentPhrase.slice(0,30).replace(/\W+/g,'-')}.png`));
  // Theme handled by shared/theme.js via .theme-switcher-pill in the wa-top.
}

window.addEventListener('DOMContentLoaded', ()=>{
  bind();
  const init = ($('#phrase').value || 'less is more').trim();
  regenerate(init);
});
})();
