// ===== FORM SERAH TERIMA – render histori + generate PDF =====

const tbody = document.getElementById('historiBody');
const inputTanggalSerah = document.getElementById('tglSerahTerima');
const btnGenerate = document.getElementById('btnGenerate');
const btnReset = document.getElementById('btnReset');

// Spinner
const spinner = document.createElement('div');
spinner.className = 'loading-spinner';
spinner.innerHTML = '<div class="spinner"></div>';
document.body.appendChild(spinner);
spinner.style.display = 'none';
function showSpinner() { spinner.style.display = 'flex'; }
function hideSpinner()  { spinner.style.display = 'none'; }

// Spinner style
const style = document.createElement('style');
style.textContent = `
.loading-spinner{position:fixed;inset:0;background:rgba(255,255,255,.7);z-index:9999;display:flex;align-items:center;justify-content:center}
.spinner{width:40px;height:40px;border:4px solid #ccc;border-top-color:#007bff;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(style);

/* ========= SIDEBAR ========= */
const sidebar   = document.querySelector('.sidebar');
const overlay   = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
const sidebarLinks = document.querySelectorAll('.sidebar a');
function openSidebar(){sidebar.classList.add('visible');overlay?.classList.add('show');document.body.style.overflow='hidden';}
function closeSidebar(){sidebar.classList.remove('visible');overlay?.classList.remove('show');document.body.style.overflow='';}
function toggleSidebar(){sidebar.classList.contains('visible')?closeSidebar():openSidebar();}
window.toggleSidebar = toggleSidebar;
overlay?.addEventListener('click', closeSidebar);
document.addEventListener('click', (e)=>{const isMobile=window.matchMedia('(max-width:768px)').matches;if(!isMobile)return;if(sidebar.classList.contains('visible')&&!sidebar.contains(e.target)&&!e.target.closest('.sidebar-toggle-btn'))closeSidebar();});
document.addEventListener('keydown', e=>{if(e.key==='Escape'&&sidebar.classList.contains('visible'))closeSidebar();});
sidebarLinks.forEach(a=>a.addEventListener('click', closeSidebar));
document.addEventListener('DOMContentLoaded', function () {
  const title = document.querySelector('.dashboard-header h1')?.textContent?.toLowerCase() || "";
  const body = document.body;
  if (title.includes('trackmate')) body.setAttribute('data-page','trackmate');
  else if (title.includes('appsheet')) body.setAttribute('data-page','appsheet');
  else if (title.includes('serah')) body.setAttribute('data-page','serah');
  else if (title.includes('merge')) body.setAttribute('data-page','merge');
});

/* ========= Utilities ========= */
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const stripLeadingColon = (s) => (s || '').replace(/^\s*:+\s*/, '');
function toNumDateDMY(s){const m=(s||'').match(/(\d{2})\/(\d{2})\/(\d{4})/); if(!m) return 0; const ts=Date.parse(`${m[3]}-${m[2]}-${m[1]}`); return Number.isNaN(ts)?0:ts;}
function formatTanggalSerahForPdf(val){ if(!val||!/^\d{4}-\d{2}-\d{2}$/.test(val)) return '-'; const [y,m,d]=val.split('-'); return `${d}/${m}/${y}`;}
function getPdfHistori(){ const arr=JSON.parse(localStorage.getItem('pdfHistori')||'[]'); return Array.isArray(arr)?arr:[];}
function setPdfHistori(arr){ localStorage.setItem('pdfHistori', JSON.stringify(arr)); }


function collectRowsForPdf(){
  const rows=[];
  document.querySelectorAll('#historiBody tr').forEach((tr,i)=>{
    const cells = tr.querySelectorAll('td'); if(cells.length<6) return;

    const no = cells[0].textContent.trim() || `${i+1}`;

    // ⬇️ GANTI: ambil ISO dari data-attr kalau ada; fallback parse teks sel
    const cellTanggal = tr.querySelector('.tgl-serah') || cells[1];
    const raw = (cellTanggal?.dataset?.iso || cellTanggal?.textContent || '').trim();
    const tanggalSerah = /^\d{4}-\d{2}-\d{2}$/.test(raw) 
      ? formatTanggalSerahForPdf(raw)       // ISO -> dd/mm/yyyy
      : (raw || '-');                       // sudah dd/mm/yyyy atau kosong

    const namaUker = stripLeadingColon(cells[2].textContent.trim() || '-');
    const tanggalPekerjaan = cells[3].textContent.trim() || '-';

    rows.push({ no, tanggalSerah, namaUker, tanggalPekerjaan });
  });
  return rows;
}


/* ========= IndexedDB helper ========= */
function openDb(){
  return new Promise((res,rej)=>{
    const req=indexedDB.open('PdfStorage',1);
    req.onupgradeneeded=e=>{const db=e.target.result; if(!db.objectStoreNames.contains('pdfs')) db.createObjectStore('pdfs',{keyPath:'id',autoIncrement:true});};
    req.onsuccess=e=>res(e.target.result);
    req.onerror=()=>rej('Gagal buka DB');
  });
}
function clearIndexedDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.deleteDatabase("PdfStorage");
    request.onsuccess=()=>resolve(true);
    request.onerror =()=>reject("Gagal hapus database IndexedDB");
    request.onblocked=()=>reject("Hapus database diblokir oleh tab lain");
  });
}

/* ========= Generate & Merge ========= */
async function generatePdfSerahTerima(){
  const histori=getPdfHistori();
  if(!histori.length){ alert("Histori kosong. Tidak bisa generate PDF."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  const rows = collectRowsForPdf();
  if(rows.length===0){ alert('Tidak ada data untuk digenerate.'); return; }

  const chunkSize=50, chunks=[];
  for(let i=0;i<rows.length;i+=chunkSize) chunks.push(rows.slice(i,i+chunkSize));

  let globalIndex=0;
  chunks.forEach((chunk,idx)=>{
    if(idx>0) doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.setFont(undefined,'bold');
    doc.text('FORM TANDA TERIMA CM', pageWidth/2, 20, { align:'center' });

    doc.autoTable({
      head:[['NO.','TANGGAL SERAH TERIMA','NAMA UKER','TANGGAL PEKERJAAN']],
      body:chunk.map(r=>{globalIndex+=1; return [r.no||globalIndex, r.tanggalSerah||'-', r.namaUker||'-', r.tanggalPekerjaan||'-'];}),
      startY:28,
      styles:{
        fontSize:5,
        minCellHeight:4,
        cellPadding:0.5,
        halign:'center',
        valign:'middle',
        lineColor:[0,0,0],
        lineWidth:.2,
        textColor:[0,0,0]},
      headStyles:{
        fillColor:false,
        fontSize:7,
        fontStyle:'bold'},
      bodyStyles:{
        fontSize:5,
        textColor:[0,0,0],
        lineColor:[0,0,0]},
      columnStyles:{
        0:{cellWidth:10},
        1:{cellWidth:40},
        2:{cellWidth:90},
        3:{cellWidth:40}},
      theme:'grid', margin:{left:15,right:15}
    });

    const yAfter = (doc.lastAutoTable?.finalY || 32) + 3;
    doc.autoTable({
      head:[['TTD TEKNISI','TTD LEADER','TTD CALL CENTER']],
      body:[['','','']],
      startY:yAfter,
      styles:{
        fontSize:7,
        halign:'center',
        valign:'middle',
        lineColor:[0,0,0],
        lineWidth:.2,
        textColor:[0,0,0]},
      headStyles:{
        fontStyle:'bold',
        fontSize:7,
        textColor:[0,0,0],
        fillColor:false,
        minCellHeight:5},
      bodyStyles:{minCellHeight:24},
      columnStyles:{
        0:{cellWidth:60},
        1:{cellWidth:60},
        2:{cellWidth:60}},
      theme:'grid', margin:{left:15,right:15}
    });
  });

  // jsPDF -> buffer
  const mainPdfBlob = doc.output('blob');
  const mainPdfBuffer = await mainPdfBlob.arrayBuffer();

  // Ambil lampiran dari IndexedDB (urut sesuai histori)
  const prefer = getPdfHistori().map(h => h.fileName).filter(Boolean);
  const uploadBuffers = await getAllPdfBuffersFromIndexedDB(prefer);

  // Merge pakai pdf-lib
  const mergedPdf = await PDFLib.PDFDocument.create();
  const mainDoc = await PDFLib.PDFDocument.load(mainPdfBuffer);
  const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
  mainPages.forEach(p=>mergedPdf.addPage(p));

  for(const {name, buffer} of uploadBuffers){
    try{
      const donor = await PDFLib.PDFDocument.load(buffer);
      const pages = await mergedPdf.copyPages(donor, donor.getPageIndices());
      pages.forEach(p=>mergedPdf.addPage(p));
    }catch(e){ console.warn(`❌ Gagal merge file "${name}"`, e); }
  }

  const mergedBytes = await mergedPdf.save();
  const mergedBlob  = new Blob([mergedBytes], { type:'application/pdf' });
  const url = URL.createObjectURL(mergedBlob);
  const a = document.createElement('a'); a.href=url; a.download='Form_Terima_CM_merged.pdf'; a.click();
  URL.revokeObjectURL(url);
}

async function getAllPdfBuffersFromIndexedDB(preferredOrderNames=[]){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open('PdfStorage',1);
    request.onerror = () => reject('Gagal buka IndexedDB');
    request.onsuccess = async (event)=>{
      try{
        const db = event.target.result;
        const tx = db.transaction(['pdfs'],'readonly');
        const store = tx.objectStore('pdfs');
        const getAllReq = store.getAll();
        getAllReq.onerror = () => reject('Gagal getAll dari objectStore');
        getAllReq.onsuccess = async ()=>{
          const rows = getAllReq.result || [];
          const items=[];
          for(const entry of rows){
            const blob = entry?.data, name = entry?.name || '(tanpa-nama)';
            if(!(blob instanceof Blob) || blob.type!=='application/pdf' || !blob.size){
              console.warn(`⏭️ Skip "${name}" — invalid PDF`);
              continue;
            }
            try{ const buffer = await blob.arrayBuffer(); items.push({name, buffer}); }
            catch(err){ console.warn(`⏭️ Skip "${name}" — gagal baca`, err); }
          }
          if(Array.isArray(preferredOrderNames) && preferredOrderNames.length){
            items.sort((a,b)=>{
              const ia = preferredOrderNames.indexOf(a.name);
              const ib = preferredOrderNames.indexOf(b.name);
              return (ia===-1?9e6:ia) - (ib===-1?9e6:ib);
            });
          }
          console.log('📄 PDF valid siap merge:', items.map(x=>x.name));
          resolve(items);
        };
      }catch(e){ reject(e); }
    };
  });
}

/* ========= Render Tabel ========= */
function renderTabel(){
  if(!tbody) return;
  let data = getPdfHistori();
  if(!data.length){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada data histori. Unggah PDF di Trackmate atau AppSheet.</td></tr>`;
    return;
  }
  data = data.map((it,i)=>({
    ...it,
    _no: i+1,
    namaUker: stripLeadingColon(it.namaUker) // guard kolon saat render
  }));
  tbody.innerHTML = data.map((item, idx)=>`
    <tr data-i="${idx}">
      <td>${item._no}</td>
      <td contenteditable="true" class="tgl-serah"></td>
      <td>${clean(item.namaUker) || '-'}</td>
      <td>${item.tanggalPekerjaan || '-'}</td>
      <td>${item.fileName || '-'}</td>
      <td><button class="danger btn-del" data-i="${idx}">Hapus</button></td>
    </tr>
  `).join('');
}

inputTanggalSerah?.addEventListener('change', ()=>{
  const iso = inputTanggalSerah.value || '';
  document.querySelectorAll('.tgl-serah').forEach(td=>{
    td.dataset.iso = iso;                                   // simpan ISO rapi
    td.textContent = iso ? formatTanggalSerahForPdf(iso) : ''; // tampil dd/mm/yyyy
  });
  btnGenerate.disabled = !iso;
});


tbody?.addEventListener('click', async (e)=>{
  const btn = e.target.closest('.btn-del'); if(!btn) return;
  if(!confirm('Hapus entri ini dari histori?')) return;

    const isoNow = inputTanggalSerah?.value || '';
  if (isoNow) document.querySelectorAll('.tgl-serah').forEach(td=>{
    td.dataset.iso = isoNow;
    td.textContent = formatTanggalSerahForPdf(isoNow); // dd/mm/yyyy
  });


  const idx = parseInt(btn.dataset.i,10);
  const arr = getPdfHistori();
  if(!Number.isInteger(idx) || idx<0 || idx>=arr.length) return;

  const fileNameToDelete = arr[idx].fileName;
  arr.splice(idx,1); setPdfHistori(arr);

  const db = await openDb();
  const tx = db.transaction(['pdfs'],'readwrite');
  const store = tx.objectStore('pdfs');
  const cursorReq = store.openCursor();
  cursorReq.onsuccess = (e)=>{
    const cursor = e.target.result;
    if(cursor){
      const entry = cursor.value;
      if(entry.name === fileNameToDelete){ cursor.delete(); console.log(`🗑️ File ${fileNameToDelete} di IndexedDB dihapus.`); }
      else cursor.continue();
    }
  };

  renderTabel();
});

btnReset?.addEventListener('click', async ()=>{
  if(!confirm('Yakin reset semua histori (pdfHistori + IndexedDB)?')) return;
  localStorage.removeItem('pdfHistori');
  try{ await clearIndexedDB(); console.log('✅ IndexedDB sudah dihapus.'); }
  catch(err){ console.warn('⚠️ Gagal hapus IndexedDB:', err); }
  renderTabel();
});

window.addEventListener('storage', (e)=>{ if(e.key==='pdfHistori') renderTabel(); });

btnGenerate?.addEventListener('click', async ()=>{
  const tanggalInput = inputTanggalSerah.value;
  if(!tanggalInput){ alert('⚠️ Silakan isi tanggal serah terima terlebih dahulu.'); return; }
  try{ showSpinner(); await generatePdfSerahTerima(); }
  catch(err){ console.error(err); alert('Gagal generate PDF. Pastikan jsPDF & AutoTable sudah dimuat.'); }
  finally{ hideSpinner(); }
});

document.addEventListener('DOMContentLoaded', renderTabel);

async function debugListPDF(){
  const db = await openDb();
  const tx = db.transaction(['pdfs'],'readonly');
  const store = tx.objectStore('pdfs');
  const req = store.getAll();
  req.onsuccess = ()=>{ console.log('📂 File di IndexedDB:', req.result.map(x=>x.name)); };
}
window.debugListPDF = debugListPDF;
