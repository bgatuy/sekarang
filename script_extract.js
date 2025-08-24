// ====== Trackmate Extractor (FINAL) ======

// (Opsional) Set worker untuk pdf.js biar gak warning "GlobalWorkerOptions.workerSrc"
if (window.pdfjsLib && (!pdfjsLib.GlobalWorkerOptions.workerSrc || pdfjsLib.GlobalWorkerOptions.workerSrc === '')) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
}

/* ========= SIDEBAR ========= */
const sidebar   = document.querySelector('.sidebar');
const overlay   = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
const sidebarLinks = document.querySelectorAll('.sidebar a');

function openSidebar() { sidebar.classList.add('visible'); overlay?.classList.add('show'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { sidebar.classList.remove('visible'); overlay?.classList.remove('show'); document.body.style.overflow = ''; }
function toggleSidebar() { sidebar.classList.contains('visible') ? closeSidebar() : openSidebar(); }
window.toggleSidebar = toggleSidebar;

overlay?.addEventListener('click', closeSidebar);
document.addEventListener('click', (e) => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (!isMobile) return;
  const clickInsideSidebar = sidebar.contains(e.target);
  const clickOnToggle = e.target.closest('.sidebar-toggle-btn');
  if (sidebar.classList.contains('visible') && !clickInsideSidebar && !clickOnToggle) closeSidebar();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('visible')) closeSidebar(); });
sidebarLinks.forEach(a => a.addEventListener('click', closeSidebar));

document.addEventListener('DOMContentLoaded', function () {
  const title = document.querySelector('.dashboard-header h1')?.textContent?.toLowerCase() || "";
  const body = document.body;
  if (title.includes('trackmate'))      body.setAttribute('data-page', 'trackmate');
  else if (title.includes('appsheet'))  body.setAttribute('data-page', 'appsheet');
  else if (title.includes('serah'))     body.setAttribute('data-page', 'serah');
  else if (title.includes('merge'))     body.setAttribute('data-page', 'merge');
});

/* ========= Query DOM ========= */
const fileInput    = document.getElementById('pdfFile');
const output       = document.getElementById('output');
const copyBtn      = document.getElementById('copyBtn');
const lokasiSelect = document.getElementById('inputLokasi');

/* ========= IndexedDB ========= */
const DB_NAME = "PdfStorage";
const DB_VERSION = 1;
const STORE_NAME = "pdfs";
let db;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (event) => { db = event.target.result; resolve(db); };
    request.onerror   = (event) => { console.error("IndexedDB error:", event.target.errorCode); reject(event.target.errorCode); };
  });
}

async function savePdfToIndexedDB(fileOrBlob) {
  const blob = fileOrBlob instanceof Blob ? fileOrBlob : null;
  if (!blob) throw new Error('savePdfToIndexedDB: argumen harus File/Blob');
  if (blob.type !== 'application/pdf') throw new Error('Type bukan PDF');
  if (!blob.size) throw new Error('PDF kosong');

  const database = await openDb();
  await new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Tx error'));
    tx.objectStore(STORE_NAME).add({
      name: fileOrBlob.name || '(tanpa-nama)',
      dateAdded: new Date().toISOString(),
      data: blob
    });
  });
  console.log(`✅ Tersimpan: ${fileOrBlob.name} (${(blob.size/1024).toFixed(1)} KB)`);
}

/* ========= Helpers ========= */
const clean = (x) => x?.replace(/\s+/g, ' ').trim() || '';
function stripLeadingColon(s) { return (s || '').replace(/^\s*:+\s*/, ''); }
function formatTanggalIndonesia(tanggal) {
  if (!tanggal) return '-';
  const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const [dd, mm, yyyy] = tanggal.split('/');
  return `${dd} ${bulan[parseInt(mm,10)-1]} ${yyyy}`;
}
function extractFlexibleBlock(lines, startLabel, stopLabels = []) {
  const startIndex = lines.findIndex(line => line.toLowerCase().includes(startLabel.toLowerCase()));
  if (startIndex === -1) return '';
  let result = '';
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (stopLabels.some(label => line.toLowerCase().includes(label.toLowerCase()))) break;
    result += ' ' + line;
  }
  return result.replace(/\s+/g, ' ').trim();
}

/* ========= State ========= */
let unitKerja = "-", kantorCabang = "-", tanggalFormatted = "-", tanggalRaw = "",
    problem = "-", berangkat = "-", tiba = "-", mulai = "-", selesai = "-",
    solusi = "-", jenisPerangkat = "-", serial = "-", merk = "-", type = "-",
    pic = "-", status = "-";

/* ========= Events ========= */
lokasiSelect?.addEventListener("change", updateOutput);

fileInput?.addEventListener('change', async function () {
  const file = fileInput.files[0];
  if (!file || file.type !== 'application/pdf') return;

  const reader = new FileReader();
  reader.onload = async function () {
    try {
      const typedarray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;

      let rawText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        rawText += content.items.map(item => item.str).join('\n') + '\n';
      }

      const lines = rawText.split('\n');

      unitKerja       = stripLeadingColon(extractFlexibleBlock(lines,'Unit Kerja',['Kantor Cabang','Tanggal']) || '-');
      kantorCabang = stripLeadingColon(extractFlexibleBlock(lines, 'Kantor Cabang', ['Tanggal', 'Pelapor']) || '-');
      tanggalRaw      = rawText.match(/Tanggal(?:\sTiket)?\s*:\s*(\d{2}\/\d{2}\/\d{4})/)?.[1] || '';
      tanggalFormatted= tanggalRaw ? formatTanggalIndonesia(tanggalRaw) : '-';
      problem         = extractFlexibleBlock(lines,'Trouble Dilaporkan',['Masalah','Solusi','Progress']) || '-';

      const ambilJam = (text, label) => text.match(new RegExp(`${label}\\s+(\\d{2}:\\d{2})(?::\\d{2})?`))?.[1] || '';
      berangkat = ambilJam(rawText, 'Berangkat') || '-';
      tiba      = ambilJam(rawText, 'Tiba') || '-';
      mulai     = ambilJam(rawText, 'Mulai') || '-';
      selesai   = ambilJam(rawText, 'Selesai') || '-';

      solusi          = extractFlexibleBlock(lines,'Solusi/Perbaikan',['STATUS','Jenis Perangkat','SN','Merk','Type']) || '-';
      jenisPerangkat  = clean(rawText.match(/Jenis Perangkat\s*:\s*(.+)/)?.[1]) || '-';
      serial          = clean(rawText.match(/SN\s*:\s*(.+)/)?.[1]) || '-';
      merk            = clean(rawText.match(/Merk\s*:\s*(.+)/)?.[1]) || '-';
      type            = clean(rawText.match(/Type\s*:\s*(.+)/)?.[1]) || '-';
      pic             = clean(rawText.match(/Pelapor\s*:\s*([^\(]+)/)?.[1]) || '-';
      status          = clean(rawText.match(/STATUS PEKERJAAN\s*:\s*(.+)/)?.[1]) || '-';

      updateOutput();
    } catch (err) {
      console.error("Gagal memproses PDF:", err);
      alert("Terjadi kesalahan saat membaca PDF.");
    }
  };
  reader.readAsArrayBuffer(file);
});

/* ========= Output ========= */
function updateOutput() {
  const lokasiTerpilih = lokasiSelect?.value || '';
  const unitKerjaLengkap = (lokasiTerpilih && unitKerja !== '-') ? `${unitKerja} (${lokasiTerpilih})` : unitKerja;

  const finalOutput =
`Selamat Pagi/Siang/Sore Petugas Call Center, Update Pekerjaan

Unit Kerja : ${unitKerjaLengkap}
Kantor Cabang : ${kantorCabang}

Tanggal : ${tanggalFormatted}

Jenis Pekerjaan (Problem) : ${problem}

Berangkat : ${berangkat}
Tiba : ${tiba}
Mulai : ${mulai}
Selesai : ${selesai}

Progress : ${solusi}

Jenis Perangkat : ${jenisPerangkat}
Serial Number : ${serial}
Merk Perangkat : ${merk}
Type Perangkat : ${type}

PIC : ${pic}
Status : ${status}`;

  if (output) output.textContent = finalOutput;
}

/* ========= Copy & Save Histori ========= */
copyBtn?.addEventListener("click", async () => {
  const textarea = document.createElement("textarea");
  textarea.value = output?.textContent || '';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  copyBtn.textContent = "✔ Copied!";
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);

  const file = fileInput.files[0];
  if (!file) return;

  const namaUkerBersih = stripLeadingColon(unitKerja) || '-';
  const newEntry = {
    namaUker: namaUkerBersih,
    tanggalPekerjaan: tanggalRaw || '',
    fileName: file.name || '-'
  };

  const histori = JSON.parse(localStorage.getItem('pdfHistori')) || [];
  const keyNew = `${newEntry.namaUker}|${newEntry.tanggalPekerjaan}|${newEntry.fileName}`;
  const exists = histori.some(x => `${x.namaUker}|${x.tanggalPekerjaan}|${x.fileName}` === keyNew);

  if (!exists) {
    histori.push(newEntry);
    localStorage.setItem('pdfHistori', JSON.stringify(histori));
    await savePdfToIndexedDB(file); // Simpan File asli
    showToast(`✔ berhasil disimpan ke histori.`);
  } else {
    showToast(`ℹ sudah ada di histori.`);
  }
});

function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); };
  toast.addEventListener('click', remove);
  setTimeout(remove, duration);
}
